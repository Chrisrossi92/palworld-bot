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

module.exports = {
  getEngagementSnapshot,
  getGuildMetrics,
  getPaldeckHealth,
  getRecentActivity,
  getTopCollectors,
  listInstalledGuildsForDiscordIds,
  listGuilds,
  upsertDiscordUserIdentity,
};
