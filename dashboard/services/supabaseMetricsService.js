const { Pool } = require("pg");

let sharedPool = null;

function createPool() {
  if (!process.env.SUPABASE_DB_URL) {
    return null;
  }

  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
    });
  }

  return sharedPool;
}

function normalizeMetricRow(row) {
  return {
    totalPlayers: Number(row.total_players || 0),
    totalCaptures: Number(row.total_captures || 0),
    totalOwnedPals: Number(row.total_owned_pals || 0),
    dailyQuestActivity: Number(row.daily_quest_activity || 0),
    recentCapturesCount: Number(row.recent_captures_count || 0),
  };
}

function emptyEngagementSnapshot() {
  return {
    totalPlayers: 0,
    totalCaptures: 0,
    totalOwnedPals: 0,
    dailyQuestActivity: 0,
    recentCapturesCount: 0,
  };
}

function emptyTopCollectors() {
  return {
    topCaptures: [],
    highestLevelPlayers: [],
    shinyCollectorsCount: 0,
  };
}

function emptyPaldeckHealth() {
  return {
    catalogSize: 0,
    uniqueSpeciesOwned: 0,
    completionPercentage: 0,
  };
}

function emptyRecentActivity() {
  return {
    latestCaptures: [],
    latestPlayerActivity: [],
  };
}

function emptyRetentionSnapshot(warnings = []) {
  return {
    dailyResearchToday: {
      participants: 0,
      completed: 0,
      claimed: 0,
    },
    weeklyServerGoal: {
      progress: 0,
      target: 100,
      percentage: 0,
      complete: false,
      completedAt: null,
      weekStartDate: getUtcWeekStartDate(),
    },
    journalMomentum: {
      totalUnlocks: 0,
      playersWithUnlocks: 0,
      recentUnlocks: 0,
    },
    recentCollectionActivity: {
      recentOwnedPalUpdates: 0,
      activeCollectors: 0,
      latestActivityAt: null,
    },
    warnings,
  };
}

function getUtcDateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function getUtcWeekStartDate(value = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const day = utcDate.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);

  return utcDate.toISOString().slice(0, 10);
}

function isMissingRelationError(error) {
  return error && error.code === "42P01";
}

async function queryOptionalTable(pool, sql, params, warning, warnings, fallback) {
  try {
    const result = await pool.query(sql, params);
    return result.rows[0] || fallback;
  } catch (error) {
    if (isMissingRelationError(error)) {
      warnings.push(warning);
      return fallback;
    }

    throw error;
  }
}

function getGuildDisplayName(row) {
  if (row.name) {
    return row.name;
  }

  if (row.discord_guild_id === "1323324192627888339") {
    return "CDawg's Fantasy World";
  }

  return "Connected Discord Server";
}

async function listGuilds(allowedGuildIds = null, pool = createPool()) {
  if (!pool) {
    return [];
  }

  if (Array.isArray(allowedGuildIds) && allowedGuildIds.length === 0) {
    return [];
  }

  const params = [];
  const allowedGuildClause = Array.isArray(allowedGuildIds)
    ? "and discord_guild_id = any($1)"
    : "";

  if (Array.isArray(allowedGuildIds)) {
    params.push(allowedGuildIds);
  }

  const result = await pool.query(`
    select discord_guild_id, name
    from public.discord_guilds
    where removed_at is null
      ${allowedGuildClause}
    order by coalesce(name, discord_guild_id);
  `, params);

  return result.rows.map((row) => ({
    id: row.discord_guild_id,
    name: getGuildDisplayName(row),
    storedName: row.name || null,
    hasStoredName: Boolean(row.name),
  }));
}

async function listInstalledGuildsForDiscordIds(guildIds, pool = createPool()) {
  return listGuilds(guildIds, pool);
}

async function upsertDiscordUserIdentity(user, pool = createPool()) {
  if (!pool || !user || !user.id) {
    return;
  }

  await pool.query(
    `
      insert into public.discord_users (
        discord_user_id,
        username,
        global_name,
        avatar_url
      )
      values ($1, $2, $3, $4)
      on conflict (discord_user_id) do update set
        username = excluded.username,
        global_name = excluded.global_name,
        avatar_url = excluded.avatar_url;
    `,
    [
      user.id,
      user.username || null,
      user.globalName || null,
      user.avatarUrl || null,
    ]
  );
}

async function getGuildMetrics(guildId, pool = createPool()) {
  return getEngagementSnapshot(guildId, pool);
}

async function getEngagementSnapshot(guildId, pool = createPool()) {
  if (!pool) {
    return emptyEngagementSnapshot();
  }

  const result = await pool.query(
    `
      with selected_guild as (
        select id
        from public.discord_guilds
        where discord_guild_id = $1
      ),
      players as (
        select players.id, players.captures
        from public.guild_players players
        join selected_guild guilds on guilds.id = players.guild_id
      )
      select
        (select count(*) from players)::integer as total_players,
        coalesce((select sum(captures) from players), 0)::integer as total_captures,
        (
          select count(*)::integer
          from public.player_owned_pals owned
          join players on players.id = owned.player_id
        ) as total_owned_pals,
        (
          select count(*)::integer
          from public.player_daily_quests quests
          join players on players.id = quests.player_id
          where quests.quest_date = current_date
        ) as daily_quest_activity,
        (
          select count(*)::integer
          from public.player_owned_pals owned
          join players on players.id = owned.player_id
          where owned.last_caught_at >= now() - interval '7 days'
        ) as recent_captures_count;
    `,
    [guildId]
  );

  return normalizeMetricRow(result.rows[0] || {});
}

async function getTopCollectors(guildId, pool = createPool()) {
  if (!pool) {
    return emptyTopCollectors();
  }

  const [topCapturesResult, highestLevelResult, shinyCollectorsResult] = await Promise.all([
    pool.query(
      `
        select
          users.discord_user_id,
          coalesce(users.global_name, users.username, users.discord_user_id) as display_name,
          players.captures,
          players.level
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        where guilds.discord_guild_id = $1
        order by players.captures desc, players.level desc, users.discord_user_id
        limit 10;
      `,
      [guildId]
    ),
    pool.query(
      `
        select
          users.discord_user_id,
          coalesce(users.global_name, users.username, users.discord_user_id) as display_name,
          players.level,
          players.xp,
          players.captures
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        where guilds.discord_guild_id = $1
        order by players.level desc, players.xp desc, users.discord_user_id
        limit 10;
      `,
      [guildId]
    ),
    pool.query(
      `
        select count(distinct players.id)::integer as shiny_collectors_count
        from public.player_owned_pals owned
        join public.guild_players players on players.id = owned.player_id
        join public.discord_guilds guilds on guilds.id = players.guild_id
        where guilds.discord_guild_id = $1
          and owned.is_shiny = true;
      `,
      [guildId]
    ),
  ]);

  return {
    topCaptures: topCapturesResult.rows.map((row) => ({
      userId: row.discord_user_id,
      displayName: row.display_name,
      captures: Number(row.captures || 0),
      level: Number(row.level || 1),
    })),
    highestLevelPlayers: highestLevelResult.rows.map((row) => ({
      userId: row.discord_user_id,
      displayName: row.display_name,
      level: Number(row.level || 1),
      xp: Number(row.xp || 0),
      captures: Number(row.captures || 0),
    })),
    shinyCollectorsCount: Number(shinyCollectorsResult.rows[0]?.shiny_collectors_count || 0),
  };
}

async function getPaldeckHealth(guildId, pool = createPool()) {
  if (!pool) {
    return emptyPaldeckHealth();
  }

  const result = await pool.query(
    `
      with selected_guild as (
        select id
        from public.discord_guilds
        where discord_guild_id = $1
      ),
      players as (
        select players.id
        from public.guild_players players
        join selected_guild guilds on guilds.id = players.guild_id
      )
      select
        (select count(*) from public.pal_catalog)::integer as catalog_size,
        (
          select count(distinct owned.pal_id)::integer
          from public.player_owned_pals owned
          join players on players.id = owned.player_id
        ) as unique_species_owned;
    `,
    [guildId]
  );
  const row = result.rows[0] || {};
  const catalogSize = Number(row.catalog_size || 0);
  const uniqueSpeciesOwned = Number(row.unique_species_owned || 0);

  return {
    catalogSize,
    uniqueSpeciesOwned,
    completionPercentage: catalogSize > 0
      ? Number(((uniqueSpeciesOwned / catalogSize) * 100).toFixed(1))
      : 0,
  };
}

async function getRecentActivity(guildId, pool = createPool()) {
  if (!pool) {
    return emptyRecentActivity();
  }

  const [latestCapturesResult, latestPlayerActivityResult] = await Promise.all([
    pool.query(
      `
        select
          users.discord_user_id,
          coalesce(users.global_name, users.username, users.discord_user_id) as display_name,
          catalog.name as pal_name,
          owned.rarity,
          owned.level,
          owned.is_shiny,
          owned.image_url,
          owned.last_caught_at
        from public.player_owned_pals owned
        join public.guild_players players on players.id = owned.player_id
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        join public.pal_catalog catalog on catalog.id = owned.pal_id
        where guilds.discord_guild_id = $1
          and owned.last_caught_at is not null
        order by owned.last_caught_at desc
        limit 10;
      `,
      [guildId]
    ),
    pool.query(
      `
        select
          users.discord_user_id,
          coalesce(users.global_name, users.username, users.discord_user_id) as display_name,
          players.level,
          players.xp,
          players.captures,
          players.updated_at
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        where guilds.discord_guild_id = $1
        order by players.updated_at desc
        limit 10;
      `,
      [guildId]
    ),
  ]);

  return {
    latestCaptures: latestCapturesResult.rows.map((row) => ({
      userId: row.discord_user_id,
      displayName: row.display_name,
      palName: row.pal_name,
      rarity: row.rarity,
      level: Number(row.level || 1),
      isShiny: Boolean(row.is_shiny),
      imageUrl: row.image_url || "",
      caughtAt: row.last_caught_at ? row.last_caught_at.toISOString() : null,
    })),
    latestPlayerActivity: latestPlayerActivityResult.rows.map((row) => ({
      userId: row.discord_user_id,
      displayName: row.display_name,
      level: Number(row.level || 1),
      xp: Number(row.xp || 0),
      captures: Number(row.captures || 0),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    })),
  };
}

async function getRetentionSnapshot(guildId, pool = createPool()) {
  if (!pool) {
    return emptyRetentionSnapshot(["No Supabase connection."]);
  }

  const today = getUtcDateKey();
  const weekStartDate = getUtcWeekStartDate();
  const warnings = [];
  const [
    dailyResearchRow,
    weeklyGoalRow,
    journalRow,
    collectionRow,
  ] = await Promise.all([
    queryOptionalTable(
      pool,
      `
        with selected_guild as (
          select id
          from public.discord_guilds
          where discord_guild_id = $1
        ),
        players as (
          select players.id
          from public.guild_players players
          join selected_guild guilds on guilds.id = players.guild_id
        )
        select
          count(*)::integer as participants,
          count(*) filter (where research.progress >= research.target)::integer as completed,
          count(*) filter (where research.claimed = true)::integer as claimed
        from public.player_daily_research research
        join players on players.id = research.player_id
        where research.research_date = $2::date;
      `,
      [guildId, today],
      "Daily Research table is not available.",
      warnings,
      { participants: 0, completed: 0, claimed: 0 }
    ),
    queryOptionalTable(
      pool,
      `
        select
          goals.progress,
          goals.target,
          goals.completed_at,
          goals.week_start_date::text
        from public.guild_weekly_goals goals
        join public.discord_guilds guilds on guilds.id = goals.guild_id
        where guilds.discord_guild_id = $1
          and goals.week_start_date = $2::date
          and goals.goal_key = 'weekly-capture-100'
        limit 1;
      `,
      [guildId, weekStartDate],
      "Weekly Server Goal table is not available.",
      warnings,
      {
        progress: 0,
        target: 100,
        completed_at: null,
        week_start_date: weekStartDate,
      }
    ),
    queryOptionalTable(
      pool,
      `
        with selected_guild as (
          select id
          from public.discord_guilds
          where discord_guild_id = $1
        ),
        players as (
          select players.id
          from public.guild_players players
          join selected_guild guilds on guilds.id = players.guild_id
        )
        select
          count(*)::integer as total_unlocks,
          count(distinct journal.player_id)::integer as players_with_unlocks,
          count(*) filter (where journal.unlocked_at >= now() - interval '7 days')::integer as recent_unlocks
        from public.player_journal_entries journal
        join players on players.id = journal.player_id;
      `,
      [guildId],
      "Journal table is not available.",
      warnings,
      {
        total_unlocks: 0,
        players_with_unlocks: 0,
        recent_unlocks: 0,
      }
    ),
    queryOptionalTable(
      pool,
      `
        with selected_guild as (
          select id
          from public.discord_guilds
          where discord_guild_id = $1
        ),
        players as (
          select players.id
          from public.guild_players players
          join selected_guild guilds on guilds.id = players.guild_id
        )
        select
          count(*) filter (where owned.last_caught_at >= now() - interval '7 days')::integer as recent_owned_pal_updates,
          count(distinct owned.player_id) filter (where owned.last_caught_at >= now() - interval '7 days')::integer as active_collectors,
          max(owned.last_caught_at) as latest_activity_at
        from public.player_owned_pals owned
        join players on players.id = owned.player_id;
      `,
      [guildId],
      "Owned Pal table is not available.",
      warnings,
      {
        recent_owned_pal_updates: 0,
        active_collectors: 0,
        latest_activity_at: null,
      }
    ),
  ]);

  const weeklyProgress = Number(weeklyGoalRow.progress || 0);
  const weeklyTarget = Number(weeklyGoalRow.target || 100);

  return {
    dailyResearchToday: {
      participants: Number(dailyResearchRow.participants || 0),
      completed: Number(dailyResearchRow.completed || 0),
      claimed: Number(dailyResearchRow.claimed || 0),
    },
    weeklyServerGoal: {
      progress: weeklyProgress,
      target: weeklyTarget,
      percentage: weeklyTarget > 0
        ? Number(((Math.min(weeklyProgress, weeklyTarget) / weeklyTarget) * 100).toFixed(1))
        : 0,
      complete: weeklyTarget > 0 && weeklyProgress >= weeklyTarget,
      completedAt: weeklyGoalRow.completed_at
        ? weeklyGoalRow.completed_at.toISOString()
        : null,
      weekStartDate: String(weeklyGoalRow.week_start_date || weekStartDate).slice(0, 10),
    },
    journalMomentum: {
      totalUnlocks: Number(journalRow.total_unlocks || 0),
      playersWithUnlocks: Number(journalRow.players_with_unlocks || 0),
      recentUnlocks: Number(journalRow.recent_unlocks || 0),
    },
    recentCollectionActivity: {
      recentOwnedPalUpdates: Number(collectionRow.recent_owned_pal_updates || 0),
      activeCollectors: Number(collectionRow.active_collectors || 0),
      latestActivityAt: collectionRow.latest_activity_at
        ? collectionRow.latest_activity_at.toISOString()
        : null,
    },
    warnings,
  };
}

module.exports = {
  getEngagementSnapshot,
  getGuildMetrics,
  getPaldeckHealth,
  getRecentActivity,
  getRetentionSnapshot,
  getTopCollectors,
  getUtcWeekStartDate,
  listInstalledGuildsForDiscordIds,
  listGuilds,
  upsertDiscordUserIdentity,
};
