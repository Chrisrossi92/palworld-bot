const { spawnSync } = require("child_process");

const REQUIRED_SPHERES = ["basic", "mega", "giga", "hyper", "ultra", "legendary"];

function quoteSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlText(value) {
  if (value === undefined || value === null || value === "") {
    return "null";
  }

  return quoteSqlLiteral(value);
}

function sqlInt(value, fallback = 0) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return String(fallback);
}

function sqlBool(value) {
  return value ? "true" : "false";
}

function sqlTimestamp(value) {
  if (!value) {
    return "null";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "null";
  }

  return `${quoteSqlLiteral(date.toISOString())}::timestamptz`;
}

function sqlDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "null";
  }

  return `${quoteSqlLiteral(value)}::date`;
}

function runPsql(sql, options = {}) {
  const dbUrl = process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    throw new Error("STORAGE_PROVIDER=supabase requires SUPABASE_DB_URL.");
  }

  const transaction = options.readOnly
    ? `begin read only;\n${sql}\ncommit;`
    : `begin;\n${sql}\ncommit;`;
  const result = spawnSync(
    "psql",
    [
      dbUrl,
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      transaction,
    ],
    {
      encoding: "utf8",
      env: process.env,
    }
  );

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error("STORAGE_PROVIDER=supabase requires the psql CLI on PATH.");
    }

    throw result.error;
  }

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || "psql command failed.";
    throw new Error(message);
  }

  return result.stdout.trim();
}

function parseJsonOutput(output, fallback) {
  if (!output) {
    return fallback;
  }

  return JSON.parse(output);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function palRowToCatalogEntry(row) {
  return {
    name: row.name,
    rarity: row.rarity,
    unlockLevel: row.unlock_level,
    imageUrl: row.image_url || "",
  };
}

function playerRowToUserRecord(row) {
  if (!row) {
    return null;
  }

  return {
    xp: row.xp,
    coins: row.coins,
    level: row.level,
    captures: row.captures,
    streak: row.streak,
    failedCaptures: row.failed_captures,
    updatedAt: row.updated_at,
    lastDailyAt: row.last_daily_at,
    starterClaimed: row.starter_claimed,
    dailyQuests: row.daily_quests || null,
    spheres: row.spheres || {},
  };
}

function ownedPalRowToEntry(row) {
  return {
    name: row.name,
    level: row.level,
    rarity: row.rarity,
    isShiny: row.is_shiny,
    imageUrl: row.image_url || "",
    caughtAt: row.last_caught_at || row.first_caught_at || new Date(0).toISOString(),
    stars: row.stars,
    essence: row.essence,
    extraEssence: row.extra_essence,
  };
}

// Future Supabase runtime backend. This adapter intentionally mirrors
// jsonStorage's synchronous interface so command modules do not need to change
// when runtime storage is cut over later.
function createSupabaseStorage({
  defaultPalCatalog,
  normalizeUserRecord,
  normalizeUserPals,
}) {
  function readJson(sql, fallback, readOnly = true) {
    return parseJsonOutput(runPsql(sql, { readOnly }), fallback);
  }

  function readPalCatalog() {
    const rows = readJson(`
      select coalesce(jsonb_agg(to_jsonb(pals) order by pals.unlock_level, pals.name), '[]'::jsonb)::text
      from (
        select name, rarity, unlock_level, image_url
        from public.pal_catalog
      ) pals;
    `, []);

    if (rows.length > 0) {
      return rows.map(palRowToCatalogEntry);
    }

    return defaultPalCatalog;
  }

  function ensurePalCatalogEntry(pal) {
    const slug = slugify(pal.slug || pal.name);

    runPsql(`
      insert into public.pal_catalog (slug, name, rarity, unlock_level, image_url, metadata)
      values (
        ${sqlText(slug)},
        ${sqlText(pal.name)},
        ${sqlText(pal.rarity || "common")},
        ${sqlInt(pal.unlockLevel ?? pal.unlock_level, 1)},
        ${sqlText(pal.imageUrl || pal.image_url)},
        '{"source":"runtime"}'::jsonb
      )
      on conflict (slug) do update set
        name = excluded.name,
        rarity = excluded.rarity,
        unlock_level = excluded.unlock_level,
        image_url = excluded.image_url,
        metadata = public.pal_catalog.metadata || excluded.metadata;
    `);
  }

  function ensureGuildAndUser(guildId, userId) {
    runPsql(`
      insert into public.discord_guilds (discord_guild_id)
      values (${sqlText(guildId)})
      on conflict (discord_guild_id) do update set removed_at = null;

      insert into public.discord_users (discord_user_id)
      values (${sqlText(userId)})
      on conflict (discord_user_id) do nothing;
    `);
  }

  function ensurePlayer(guildId, userId, userRecord) {
    ensureGuildAndUser(guildId, userId);
    const normalized = normalizeUserRecord(userRecord);

    runPsql(`
      insert into public.guild_memberships (guild_id, user_id, discord_user_id)
      select guilds.id, users.id, users.discord_user_id
      from public.discord_guilds guilds
      cross join public.discord_users users
      where guilds.discord_guild_id = ${sqlText(guildId)}
        and users.discord_user_id = ${sqlText(userId)}
      on conflict (guild_id, user_id) do update set
        discord_user_id = excluded.discord_user_id;

      insert into public.guild_players (
        guild_id,
        user_id,
        xp,
        coins,
        level,
        captures,
        failed_captures,
        streak,
        starter_claimed,
        last_daily_at
      )
      select
        guilds.id,
        users.id,
        ${sqlInt(normalized.xp, 0)},
        ${sqlInt(normalized.coins, 100)},
        ${sqlInt(normalized.level, 1)},
        ${sqlInt(normalized.captures, 0)},
        ${sqlInt(normalized.failedCaptures, 0)},
        ${sqlInt(normalized.streak, 0)},
        ${sqlBool(normalized.starterClaimed)},
        ${sqlTimestamp(normalized.lastDailyAt)}
      from public.discord_guilds guilds
      cross join public.discord_users users
      where guilds.discord_guild_id = ${sqlText(guildId)}
        and users.discord_user_id = ${sqlText(userId)}
      on conflict (guild_id, user_id) do update set
        xp = excluded.xp,
        coins = excluded.coins,
        level = excluded.level,
        captures = excluded.captures,
        failed_captures = excluded.failed_captures,
        streak = excluded.streak,
        starter_claimed = excluded.starter_claimed,
        last_daily_at = excluded.last_daily_at;
    `);

    writeSphereInventory(guildId, userId, normalized.spheres);
    writeDailyQuestState(guildId, userId, normalized.dailyQuests);
  }

  function readPlayerRecord(guildId, userId) {
    const rows = readJson(`
      select coalesce(jsonb_agg(to_jsonb(player_row)), '[]'::jsonb)::text
      from (
        select
          players.xp,
          players.coins,
          players.level,
          players.captures,
          players.failed_captures,
          players.streak,
          players.starter_claimed,
          players.last_daily_at,
          players.updated_at,
          coalesce(
            (
              select jsonb_object_agg(inv.sphere_type, inv.quantity)
              from public.player_sphere_inventory inv
              where inv.player_id = players.id
            ),
            '{}'::jsonb
          ) as spheres,
          (
            select jsonb_build_object(
              'date', quests.quest_date::text,
              'captureAttempts', quests.capture_attempts,
              'successfulCaptures', quests.successful_captures,
              'claimed', quests.claimed
            )
            from public.player_daily_quests quests
            where quests.player_id = players.id
            order by quests.quest_date desc
            limit 1
          ) as daily_quests
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        where guilds.discord_guild_id = ${sqlText(guildId)}
          and users.discord_user_id = ${sqlText(userId)}
        limit 1
      ) player_row;
    `, []);

    return rows.length > 0 ? playerRowToUserRecord(rows[0]) : null;
  }

  function getGuildPlayerRecord(guildId, userId) {
    return normalizeUserRecord(readPlayerRecord(guildId, userId));
  }

  function readGuildPlayers(guildId) {
    const rows = readJson(`
      select coalesce(jsonb_agg(to_jsonb(player_rows)), '[]'::jsonb)::text
      from (
        select
          users.discord_user_id,
          players.*,
          coalesce(
            (
              select jsonb_object_agg(inv.sphere_type, inv.quantity)
              from public.player_sphere_inventory inv
              where inv.player_id = players.id
            ),
            '{}'::jsonb
          ) as spheres,
          (
            select jsonb_build_object(
              'date', quests.quest_date::text,
              'captureAttempts', quests.capture_attempts,
              'successfulCaptures', quests.successful_captures,
              'claimed', quests.claimed
            )
            from public.player_daily_quests quests
            where quests.player_id = players.id
            order by quests.quest_date desc
            limit 1
          ) as daily_quests
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        where guilds.discord_guild_id = ${sqlText(guildId)}
        order by users.discord_user_id
      ) player_rows;
    `, []);
    const result = {};

    for (const row of rows) {
      result[row.discord_user_id] = normalizeUserRecord(playerRowToUserRecord(row));
    }

    return result;
  }

  function readUsers() {
    const rows = readJson(`
      select coalesce(jsonb_agg(to_jsonb(player_rows)), '[]'::jsonb)::text
      from (
        select
          guilds.discord_guild_id,
          users.discord_user_id,
          players.*,
          coalesce(
            (
              select jsonb_object_agg(inv.sphere_type, inv.quantity)
              from public.player_sphere_inventory inv
              where inv.player_id = players.id
            ),
            '{}'::jsonb
          ) as spheres,
          (
            select jsonb_build_object(
              'date', quests.quest_date::text,
              'captureAttempts', quests.capture_attempts,
              'successfulCaptures', quests.successful_captures,
              'claimed', quests.claimed
            )
            from public.player_daily_quests quests
            where quests.player_id = players.id
            order by quests.quest_date desc
            limit 1
          ) as daily_quests
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        order by guilds.discord_guild_id, users.discord_user_id
      ) player_rows;
    `, []);
    const result = {};

    for (const row of rows) {
      if (!result[row.discord_guild_id]) {
        result[row.discord_guild_id] = {};
      }

      result[row.discord_guild_id][row.discord_user_id] = normalizeUserRecord(
        playerRowToUserRecord(row)
      );
    }

    return result;
  }

  function writeUsers(data) {
    for (const [guildId, guildUsers] of Object.entries(data || {})) {
      for (const [userId, userRecord] of Object.entries(guildUsers || {})) {
        ensurePlayer(guildId, userId, userRecord);
      }
    }
  }

  function writeSphereInventory(guildId, userId, spheres) {
    const values = REQUIRED_SPHERES.map((sphereType) => {
      return `(${sqlText(sphereType)}, ${sqlInt(spheres && spheres[sphereType], 0)})`;
    }).join(",\n");

    runPsql(`
      with target_player as (
        select players.id
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        where guilds.discord_guild_id = ${sqlText(guildId)}
          and users.discord_user_id = ${sqlText(userId)}
      ),
      incoming(sphere_type, quantity) as (
        values ${values}
      )
      insert into public.player_sphere_inventory (player_id, sphere_type, quantity)
      select target_player.id, incoming.sphere_type, incoming.quantity
      from target_player
      cross join incoming
      on conflict (player_id, sphere_type) do update set
        quantity = excluded.quantity;
    `);
  }

  function getSphereInventory(guildId, userId) {
    return {
      ...getGuildPlayerRecord(guildId, userId).spheres,
    };
  }

  function updateGuildPlayerRecord(guildId, userId, updater) {
    const userRecord = getGuildPlayerRecord(guildId, userId);
    const result = updater(userRecord);

    ensurePlayer(guildId, userId, userRecord);

    return result === undefined ? userRecord : result;
  }

  function updateSphereInventory(guildId, userId, updater) {
    return updateGuildPlayerRecord(guildId, userId, (userRecord) =>
      updater(userRecord.spheres, userRecord)
    );
  }

  function writeDailyQuestState(guildId, userId, dailyQuests) {
    if (!dailyQuests || !dailyQuests.date) {
      return;
    }

    runPsql(`
      insert into public.player_daily_quests (
        player_id,
        quest_date,
        capture_attempts,
        successful_captures,
        claimed
      )
      select
        players.id,
        ${sqlDate(dailyQuests.date)},
        ${sqlInt(dailyQuests.captureAttempts, 0)},
        ${sqlInt(dailyQuests.successfulCaptures, 0)},
        ${sqlBool(dailyQuests.claimed)}
      from public.guild_players players
      join public.discord_guilds guilds on guilds.id = players.guild_id
      join public.discord_users users on users.id = players.user_id
      where guilds.discord_guild_id = ${sqlText(guildId)}
        and users.discord_user_id = ${sqlText(userId)}
        and ${sqlDate(dailyQuests.date)} is not null
      on conflict (player_id, quest_date) do update set
        capture_attempts = excluded.capture_attempts,
        successful_captures = excluded.successful_captures,
        claimed = excluded.claimed;
    `);
  }

  function getDailyQuestState(guildId, userId) {
    return {
      ...getGuildPlayerRecord(guildId, userId).dailyQuests,
    };
  }

  function updateDailyQuestState(guildId, userId, updater) {
    return updateGuildPlayerRecord(guildId, userId, (userRecord) =>
      updater(userRecord.dailyQuests, userRecord)
    );
  }

  function readGuildOwnedPals(guildId) {
    const rows = readJson(`
      select coalesce(jsonb_agg(to_jsonb(pal_rows)), '[]'::jsonb)::text
      from (
        select
          users.discord_user_id,
          catalog.name,
          owned.level,
          owned.rarity,
          owned.is_shiny,
          owned.image_url,
          owned.stars,
          owned.essence,
          owned.extra_essence,
          owned.first_caught_at,
          owned.last_caught_at
        from public.player_owned_pals owned
        join public.guild_players players on players.id = owned.player_id
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        join public.pal_catalog catalog on catalog.id = owned.pal_id
        where guilds.discord_guild_id = ${sqlText(guildId)}
        order by users.discord_user_id, owned.last_caught_at desc
      ) pal_rows;
    `, []);
    const result = {};

    for (const row of rows) {
      if (!result[row.discord_user_id]) {
        result[row.discord_user_id] = [];
      }

      result[row.discord_user_id].push(ownedPalRowToEntry(row));
    }

    for (const userId of Object.keys(result)) {
      result[userId] = normalizeUserPals(result[userId]);
    }

    return result;
  }

  function readUserPals() {
    const rows = readJson(`
      select coalesce(jsonb_agg(to_jsonb(pal_rows)), '[]'::jsonb)::text
      from (
        select
          guilds.discord_guild_id,
          users.discord_user_id,
          catalog.name,
          owned.level,
          owned.rarity,
          owned.is_shiny,
          owned.image_url,
          owned.stars,
          owned.essence,
          owned.extra_essence,
          owned.first_caught_at,
          owned.last_caught_at
        from public.player_owned_pals owned
        join public.guild_players players on players.id = owned.player_id
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        join public.pal_catalog catalog on catalog.id = owned.pal_id
        order by guilds.discord_guild_id, users.discord_user_id, owned.last_caught_at desc
      ) pal_rows;
    `, []);
    const result = {};

    for (const row of rows) {
      if (!result[row.discord_guild_id]) {
        result[row.discord_guild_id] = {};
      }

      if (!result[row.discord_guild_id][row.discord_user_id]) {
        result[row.discord_guild_id][row.discord_user_id] = [];
      }

      result[row.discord_guild_id][row.discord_user_id].push(ownedPalRowToEntry(row));
    }

    for (const guildPals of Object.values(result)) {
      for (const [userId, pals] of Object.entries(guildPals)) {
        guildPals[userId] = normalizeUserPals(pals);
      }
    }

    return result;
  }

  function getGuildOwnedPals(guildId, userId) {
    const guildUserPals = readGuildOwnedPals(guildId);

    return Array.isArray(guildUserPals[userId]) ? guildUserPals[userId] : [];
  }

  function writeOwnedPals(guildId, userId, ownedPals) {
    ensurePlayer(guildId, userId, readPlayerRecord(guildId, userId));

    for (const pal of normalizeUserPals(ownedPals)) {
      ensurePalCatalogEntry(pal);

      runPsql(`
        insert into public.player_owned_pals (
          player_id,
          pal_id,
          level,
          rarity,
          is_shiny,
          image_url,
          stars,
          essence,
          extra_essence,
          first_caught_at,
          last_caught_at
        )
        select
          players.id,
          catalog.id,
          ${sqlInt(pal.level, 1)},
          ${sqlText(pal.rarity || "common")},
          ${sqlBool(pal.isShiny)},
          ${sqlText(pal.imageUrl)},
          ${sqlInt(pal.stars, 0)},
          ${sqlInt(pal.essence, 0)},
          ${sqlInt(pal.extraEssence, 0)},
          ${sqlTimestamp(pal.caughtAt)},
          ${sqlTimestamp(pal.caughtAt)}
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        join public.pal_catalog catalog on catalog.name = ${sqlText(pal.name)}
        where guilds.discord_guild_id = ${sqlText(guildId)}
          and users.discord_user_id = ${sqlText(userId)}
        on conflict (player_id, pal_id) do update set
          level = excluded.level,
          rarity = excluded.rarity,
          is_shiny = excluded.is_shiny,
          image_url = excluded.image_url,
          stars = excluded.stars,
          essence = excluded.essence,
          extra_essence = excluded.extra_essence,
          first_caught_at = coalesce(public.player_owned_pals.first_caught_at, excluded.first_caught_at),
          last_caught_at = excluded.last_caught_at;
      `);
    }
  }

  function writeUserPals(data) {
    for (const [guildId, guildUserPals] of Object.entries(data || {})) {
      for (const [userId, ownedPals] of Object.entries(guildUserPals || {})) {
        writeOwnedPals(guildId, userId, ownedPals);
      }
    }
  }

  function updateGuildOwnedPals(guildId, userId, updater) {
    const ownedPals = getGuildOwnedPals(guildId, userId);
    const result = updater(ownedPals);

    writeOwnedPals(guildId, userId, ownedPals);

    return result === undefined ? ownedPals : result;
  }

  return {
    getDailyQuestState,
    getGuildOwnedPals,
    getGuildPlayerRecord,
    getSphereInventory,
    readGuildOwnedPals,
    readGuildPlayers,
    readPalCatalog,
    readUserPals,
    readUsers,
    updateDailyQuestState,
    updateGuildOwnedPals,
    updateGuildPlayerRecord,
    updateSphereInventory,
    writeUserPals,
    writeUsers,
  };
}

module.exports = {
  createSupabaseStorage,
};
