const { Pool } = require("pg");
const {
  DEFAULT_SPAWN_INTERVAL_MINUTES,
  getNextSpawnAt,
  normalizeSpawnSettings,
  validateSpawnSettings,
} = require("../systems/spawnSettings");

function rowToSpawnSettings(row) {
  return normalizeSpawnSettings({
    guildId: row.discord_guild_id,
    enabled: row.enabled,
    channelId: row.channel_id,
    intervalMinutes: row.interval_minutes,
    lastSpawnAt: row.last_spawn_at,
    nextSpawnAt: row.next_spawn_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function createSpawnSettingsService({
  pool,
  env = process.env,
  logger = console,
} = {}) {
  const connectionString = env.SUPABASE_DB_URL;
  const managedPool = pool || (connectionString ? new Pool({ connectionString }) : null);

  async function query(sql, params = []) {
    if (!managedPool) {
      throw new Error("Spawn settings require SUPABASE_DB_URL.");
    }

    return managedPool.query(sql, params);
  }

  function isConfigured() {
    return Boolean(managedPool);
  }

  async function ensureDefaultSpawnSettings(guild) {
    if (!isConfigured()) {
      return null;
    }

    const guildId = typeof guild === "string" ? guild : guild.id;
    const guildName = typeof guild === "string" ? null : guild.name || null;
    const memberCount = typeof guild === "string" ? null : guild.memberCount ?? null;

    const result = await query(`
      with upserted_guild as (
        insert into public.discord_guilds (
          discord_guild_id,
          name,
          member_count
        )
        values ($1, $2, $3)
        on conflict (discord_guild_id) do update set
          removed_at = null,
          name = coalesce(excluded.name, public.discord_guilds.name),
          member_count = coalesce(excluded.member_count, public.discord_guilds.member_count)
        returning id
      )
      insert into public.guild_spawn_settings (
        guild_id,
        enabled,
        interval_minutes
      )
      select id, false, $4
      from upserted_guild
      on conflict (guild_id) do nothing
      returning
        enabled,
        channel_id,
        interval_minutes,
        last_spawn_at,
        next_spawn_at,
        created_at,
        updated_at;
    `, [guildId, guildName, memberCount, DEFAULT_SPAWN_INTERVAL_MINUTES]);

    const row = result.rows[0];

    if (row) {
      logger.log(`[spawnSettings] Created disabled default settings for guild ${guildId}.`);
      return rowToSpawnSettings({ ...row, discord_guild_id: guildId });
    }

    logger.log(`[spawnSettings] Default settings already exist for guild ${guildId}.`);
    return null;
  }

  async function getSpawnSettings(guildId) {
    if (!isConfigured()) {
      return normalizeSpawnSettings({
        guildId,
        enabled: false,
        intervalMinutes: DEFAULT_SPAWN_INTERVAL_MINUTES,
      });
    }

    await ensureDefaultSpawnSettings(guildId);

    const result = await query(`
      select
        guilds.discord_guild_id,
        settings.enabled,
        settings.channel_id,
        settings.interval_minutes,
        settings.last_spawn_at,
        settings.next_spawn_at,
        settings.created_at,
        settings.updated_at
      from public.guild_spawn_settings settings
      join public.discord_guilds guilds on guilds.id = settings.guild_id
      where guilds.discord_guild_id = $1;
    `, [guildId]);

    return result.rows[0]
      ? rowToSpawnSettings(result.rows[0])
      : normalizeSpawnSettings({
        guildId,
        enabled: false,
        intervalMinutes: DEFAULT_SPAWN_INTERVAL_MINUTES,
      });
  }

  async function updateSpawnSettings(guildId, updates, now = new Date()) {
    if (!isConfigured()) {
      throw new Error("Spawn settings require SUPABASE_DB_URL.");
    }

    const current = await getSpawnSettings(guildId);
    const nextSettings = normalizeSpawnSettings({
      ...current,
      guildId,
      enabled: updates.enabled,
      channelId: updates.channelId ?? updates.channel_id ?? null,
      intervalMinutes: updates.intervalMinutes ?? updates.interval_minutes,
    });
    const validation = validateSpawnSettings(nextSettings);

    if (!validation.valid) {
      const error = new Error(validation.errors.join(" "));
      error.statusCode = 400;
      error.validationErrors = validation.errors;
      throw error;
    }

    let nextSpawnAt = nextSettings.nextSpawnAt;

    if (
      nextSettings.enabled &&
      (!nextSpawnAt || nextSpawnAt.getTime() <= now.getTime())
    ) {
      nextSpawnAt = getNextSpawnAt(now, nextSettings.intervalMinutes);
    }

    const result = await query(`
      update public.guild_spawn_settings settings
      set
        enabled = $2,
        channel_id = $3,
        interval_minutes = $4,
        next_spawn_at = $5
      from public.discord_guilds guilds
      where settings.guild_id = guilds.id
        and guilds.discord_guild_id = $1
      returning
        guilds.discord_guild_id,
        settings.enabled,
        settings.channel_id,
        settings.interval_minutes,
        settings.last_spawn_at,
        settings.next_spawn_at,
        settings.created_at,
        settings.updated_at;
    `, [
      guildId,
      nextSettings.enabled,
      nextSettings.channelId || null,
      nextSettings.intervalMinutes,
      nextSpawnAt ? nextSpawnAt.toISOString() : null,
    ]);

    return result.rows[0] ? rowToSpawnSettings(result.rows[0]) : getSpawnSettings(guildId);
  }

  async function listDueSpawnSettings(now = new Date()) {
    if (!isConfigured()) {
      return [];
    }

    const result = await query(`
      select
        guilds.discord_guild_id,
        settings.enabled,
        settings.channel_id,
        settings.interval_minutes,
        settings.last_spawn_at,
        settings.next_spawn_at,
        settings.created_at,
        settings.updated_at
      from public.guild_spawn_settings settings
      join public.discord_guilds guilds on guilds.id = settings.guild_id
      where settings.enabled = true
        and settings.channel_id is not null
        and settings.next_spawn_at is not null
        and settings.next_spawn_at <= $1
      order by settings.next_spawn_at asc;
    `, [now.toISOString()]);

    return result.rows.map(rowToSpawnSettings);
  }

  async function recordSpawnAttempt(guildId, at = new Date()) {
    if (!isConfigured()) {
      return null;
    }

    const currentSettings = await query(`
      select settings.interval_minutes
      from public.guild_spawn_settings settings
      join public.discord_guilds guilds on guilds.id = settings.guild_id
      where guilds.discord_guild_id = $1;
    `, [guildId]);

    if (!currentSettings.rows[0]) {
      return null;
    }

    const intervalMinutes = currentSettings.rows[0].interval_minutes;
    const nextSpawnAt = getNextSpawnAt(at, intervalMinutes);
    const result = await query(`
      update public.guild_spawn_settings settings
      set
        last_spawn_at = $2,
        next_spawn_at = $3
      from public.discord_guilds guilds
      where settings.guild_id = guilds.id
        and guilds.discord_guild_id = $1
      returning
        guilds.discord_guild_id,
        settings.enabled,
        settings.channel_id,
        settings.interval_minutes,
        settings.last_spawn_at,
        settings.next_spawn_at,
        settings.created_at,
        settings.updated_at;
    `, [guildId, at.toISOString(), nextSpawnAt.toISOString()]);

    return result.rows[0] ? rowToSpawnSettings(result.rows[0]) : null;
  }

  async function close() {
    if (!pool && managedPool) {
      await managedPool.end();
    }
  }

  return {
    close,
    ensureDefaultSpawnSettings,
    getSpawnSettings,
    isConfigured,
    listDueSpawnSettings,
    recordSpawnAttempt,
    updateSpawnSettings,
  };
}

module.exports = {
  createSpawnSettingsService,
  rowToSpawnSettings,
};
