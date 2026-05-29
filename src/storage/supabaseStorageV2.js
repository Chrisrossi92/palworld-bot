const { Pool } = require("pg");

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    updatedAt: toIsoString(row.updated_at),
    lastDailyAt: toIsoString(row.last_daily_at),
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
    caughtAt:
      toIsoString(row.last_caught_at) ||
      toIsoString(row.first_caught_at) ||
      new Date(0).toISOString(),
    stars: row.stars,
    essence: row.essence,
    extraEssence: row.extra_essence,
  };
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Supabase V2 adapter backed by pg. It intentionally exposes the same method
// names as jsonStorage, but runtime is not cut over to this async adapter yet.
function createSupabaseStorageV2({
  defaultPalCatalog,
  normalizeUserRecord,
  normalizeUserPals,
  pool,
}) {
  const managedPool = pool || new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
  });

  if (!pool && !process.env.SUPABASE_DB_URL) {
    throw new Error("supabaseStorageV2 requires SUPABASE_DB_URL.");
  }

  async function query(sql, params = [], client = managedPool) {
    return client.query(sql, params);
  }

  async function withTransaction(callback) {
    const client = typeof managedPool.connect === "function"
      ? await managedPool.connect()
      : managedPool;

    try {
      await client.query("begin");
      const result = await callback(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      if (typeof client.release === "function") {
        client.release();
      }
    }
  }

  async function close() {
    if (!pool) {
      await managedPool.end();
    }
  }

  async function readPalCatalog() {
    const result = await query(`
      select name, rarity, unlock_level, image_url
      from public.pal_catalog
      order by unlock_level, name;
    `);

    if (result.rows.length > 0) {
      return result.rows.map(palRowToCatalogEntry);
    }

    return defaultPalCatalog;
  }

  async function readPlayerRecordWithClient(client, guildId, userId) {
    const result = await query(`
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
      where guilds.discord_guild_id = $1
        and users.discord_user_id = $2
      limit 1;
    `, [guildId, userId], client);

    return result.rows.length > 0 ? playerRowToUserRecord(result.rows[0]) : null;
  }

  async function readPlayerRecord(guildId, userId) {
    return readPlayerRecordWithClient(managedPool, guildId, userId);
  }

  async function getGuildPlayerRecord(guildId, userId) {
    return normalizeUserRecord(await readPlayerRecord(guildId, userId));
  }

  async function readGuildPlayers(guildId) {
    const result = await query(`
      select
        users.discord_user_id,
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
      where guilds.discord_guild_id = $1
      order by users.discord_user_id;
    `, [guildId]);
    const players = {};

    for (const row of result.rows) {
      players[row.discord_user_id] = normalizeUserRecord(playerRowToUserRecord(row));
    }

    return players;
  }

  async function readUsers() {
    const result = await query(`
      select
        guilds.discord_guild_id,
        users.discord_user_id,
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
      order by guilds.discord_guild_id, users.discord_user_id;
    `);
    const users = {};

    for (const row of result.rows) {
      if (!users[row.discord_guild_id]) {
        users[row.discord_guild_id] = {};
      }

      users[row.discord_guild_id][row.discord_user_id] = normalizeUserRecord(
        playerRowToUserRecord(row)
      );
    }

    return users;
  }

  async function getSphereInventory(guildId, userId) {
    return {
      ...(await getGuildPlayerRecord(guildId, userId)).spheres,
    };
  }

  async function getDailyQuestState(guildId, userId) {
    return {
      ...(await getGuildPlayerRecord(guildId, userId)).dailyQuests,
    };
  }

  async function readGuildOwnedPals(guildId, client = managedPool) {
    const result = await query(`
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
      where guilds.discord_guild_id = $1
      order by users.discord_user_id, owned.last_caught_at desc;
    `, [guildId], client);
    const guildPals = {};

    for (const row of result.rows) {
      if (!guildPals[row.discord_user_id]) {
        guildPals[row.discord_user_id] = [];
      }

      guildPals[row.discord_user_id].push(ownedPalRowToEntry(row));
    }

    for (const [userId, pals] of Object.entries(guildPals)) {
      guildPals[userId] = normalizeUserPals(pals);
    }

    return guildPals;
  }

  async function readUserPals() {
    const result = await query(`
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
      order by guilds.discord_guild_id, users.discord_user_id, owned.last_caught_at desc;
    `);
    const userPals = {};

    for (const row of result.rows) {
      if (!userPals[row.discord_guild_id]) {
        userPals[row.discord_guild_id] = {};
      }

      if (!userPals[row.discord_guild_id][row.discord_user_id]) {
        userPals[row.discord_guild_id][row.discord_user_id] = [];
      }

      userPals[row.discord_guild_id][row.discord_user_id].push(ownedPalRowToEntry(row));
    }

    for (const guildPals of Object.values(userPals)) {
      for (const [userId, pals] of Object.entries(guildPals)) {
        guildPals[userId] = normalizeUserPals(pals);
      }
    }

    return userPals;
  }

  async function getGuildOwnedPals(guildId, userId) {
    const guildUserPals = await readGuildOwnedPals(guildId);

    return Array.isArray(guildUserPals[userId]) ? guildUserPals[userId] : [];
  }

  async function ensureGuildAndUser(client, guildId, userId) {
    await query(`
      insert into public.discord_guilds (discord_guild_id)
      values ($1)
      on conflict (discord_guild_id) do update set removed_at = null;
    `, [guildId], client);

    await query(`
      insert into public.discord_users (discord_user_id)
      values ($1)
      on conflict (discord_user_id) do nothing;
    `, [userId], client);
  }

  async function writeSphereInventoryWithClient(client, guildId, userId, spheres) {
    for (const [sphereType, quantity] of Object.entries(spheres || {})) {
      await query(`
        insert into public.player_sphere_inventory (player_id, sphere_type, quantity)
        select players.id, $3, $4
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        where guilds.discord_guild_id = $1
          and users.discord_user_id = $2
        on conflict (player_id, sphere_type) do update set
          quantity = excluded.quantity;
      `, [guildId, userId, sphereType, quantity], client);
    }
  }

  async function writeDailyQuestStateWithClient(client, guildId, userId, dailyQuests) {
    if (!dailyQuests || !dailyQuests.date) {
      return;
    }

    await query(`
      insert into public.player_daily_quests (
        player_id,
        quest_date,
        capture_attempts,
        successful_captures,
        claimed
      )
      select
        players.id,
        $3::date,
        $4,
        $5,
        $6
      from public.guild_players players
      join public.discord_guilds guilds on guilds.id = players.guild_id
      join public.discord_users users on users.id = players.user_id
      where guilds.discord_guild_id = $1
        and users.discord_user_id = $2
      on conflict (player_id, quest_date) do update set
        capture_attempts = excluded.capture_attempts,
        successful_captures = excluded.successful_captures,
        claimed = excluded.claimed;
    `, [
      guildId,
      userId,
      dailyQuests.date,
      dailyQuests.captureAttempts || 0,
      dailyQuests.successfulCaptures || 0,
      Boolean(dailyQuests.claimed),
    ], client);
  }

  async function ensurePlayer(client, guildId, userId, userRecord) {
    await ensureGuildAndUser(client, guildId, userId);

    const normalized = normalizeUserRecord(userRecord);

    await query(`
      insert into public.guild_memberships (guild_id, user_id, discord_user_id)
      select guilds.id, users.id, users.discord_user_id
      from public.discord_guilds guilds
      cross join public.discord_users users
      where guilds.discord_guild_id = $1
        and users.discord_user_id = $2
      on conflict (guild_id, user_id) do update set
        discord_user_id = excluded.discord_user_id;
    `, [guildId, userId], client);

    await query(`
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
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::timestamptz
      from public.discord_guilds guilds
      cross join public.discord_users users
      where guilds.discord_guild_id = $1
        and users.discord_user_id = $2
      on conflict (guild_id, user_id) do update set
        xp = excluded.xp,
        coins = excluded.coins,
        level = excluded.level,
        captures = excluded.captures,
        failed_captures = excluded.failed_captures,
        streak = excluded.streak,
        starter_claimed = excluded.starter_claimed,
        last_daily_at = excluded.last_daily_at;
    `, [
      guildId,
      userId,
      normalized.xp,
      normalized.coins,
      normalized.level,
      normalized.captures,
      normalized.failedCaptures,
      normalized.streak,
      normalized.starterClaimed,
      normalized.lastDailyAt,
    ], client);

    await writeSphereInventoryWithClient(client, guildId, userId, normalized.spheres);
    await writeDailyQuestStateWithClient(client, guildId, userId, normalized.dailyQuests);

    return normalized;
  }

  async function ensurePalCatalogEntry(client, pal) {
    await query(`
      insert into public.pal_catalog (slug, name, rarity, unlock_level, image_url, metadata)
      values ($1, $2, $3, $4, $5, '{"source":"runtime-v2"}'::jsonb)
      on conflict (slug) do update set
        name = excluded.name,
        rarity = excluded.rarity,
        unlock_level = excluded.unlock_level,
        image_url = excluded.image_url,
        metadata = public.pal_catalog.metadata || excluded.metadata;
    `, [
      slugify(pal.slug || pal.name),
      pal.name,
      pal.rarity || "common",
      pal.unlockLevel || pal.unlock_level || 1,
      pal.imageUrl || pal.image_url || null,
    ], client);
  }

  async function writeOwnedPalsWithClient(client, guildId, userId, ownedPals) {
    await ensurePlayer(client, guildId, userId, await readPlayerRecordWithClient(client, guildId, userId));

    for (const pal of normalizeUserPals(ownedPals)) {
      await ensurePalCatalogEntry(client, pal);

      await query(`
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
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::timestamptz,
          $10::timestamptz
        from public.guild_players players
        join public.discord_guilds guilds on guilds.id = players.guild_id
        join public.discord_users users on users.id = players.user_id
        join public.pal_catalog catalog on catalog.name = $11
        where guilds.discord_guild_id = $1
          and users.discord_user_id = $2
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
      `, [
        guildId,
        userId,
        pal.level || 1,
        pal.rarity || "common",
        Boolean(pal.isShiny),
        pal.imageUrl || null,
        pal.stars || 0,
        pal.essence || 0,
        pal.extraEssence || 0,
        pal.caughtAt || new Date(0).toISOString(),
        pal.name,
      ], client);
    }
  }

  async function writeUsers(data) {
    return withTransaction(async (client) => {
      for (const [guildId, guildUsers] of Object.entries(data || {})) {
        for (const [userId, userRecord] of Object.entries(guildUsers || {})) {
          await ensurePlayer(client, guildId, userId, userRecord);
        }
      }
    });
  }

  async function writeUserPals(data) {
    return withTransaction(async (client) => {
      for (const [guildId, guildUserPals] of Object.entries(data || {})) {
        for (const [userId, ownedPals] of Object.entries(guildUserPals || {})) {
          await writeOwnedPalsWithClient(client, guildId, userId, ownedPals);
        }
      }
    });
  }

  async function updateGuildPlayerRecord(guildId, userId, updater) {
    return withTransaction(async (client) => {
      const userRecord = normalizeUserRecord(
        await readPlayerRecordWithClient(client, guildId, userId)
      );
      const result = updater(userRecord);

      await ensurePlayer(client, guildId, userId, userRecord);

      return result === undefined ? userRecord : result;
    });
  }

  async function updateSphereInventory(guildId, userId, updater) {
    return updateGuildPlayerRecord(guildId, userId, (userRecord) =>
      updater(userRecord.spheres, userRecord)
    );
  }

  async function updateDailyQuestState(guildId, userId, updater) {
    return updateGuildPlayerRecord(guildId, userId, (userRecord) =>
      updater(userRecord.dailyQuests, userRecord)
    );
  }

  async function updateGuildOwnedPals(guildId, userId, updater) {
    return withTransaction(async (client) => {
      const guildUserPals = await readGuildOwnedPals(guildId, client);
      const ownedPals = Array.isArray(guildUserPals[userId]) ? guildUserPals[userId] : [];
      const result = updater(ownedPals);

      await writeOwnedPalsWithClient(client, guildId, userId, ownedPals);

      return result === undefined ? ownedPals : result;
    });
  }

  const storage = {
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

  Object.defineProperty(storage, "close", {
    value: close,
    enumerable: false,
  });

  return storage;
}

module.exports = {
  createSupabaseStorageV2,
};
