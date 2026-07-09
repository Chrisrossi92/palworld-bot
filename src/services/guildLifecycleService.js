const { Pool } = require("pg");

function createGuildLifecycleService({
  env = process.env,
  pool = null,
  logger = console,
} = {}) {
  const connectionString = env.SUPABASE_DB_URL;
  const managedPool = pool || (connectionString ? new Pool({ connectionString }) : null);

  function isConfigured() {
    return Boolean(managedPool);
  }

  async function markGuildRemoved(guildId, removedAt = new Date()) {
    if (!isConfigured()) {
      return { marked: false, reason: "supabase-not-configured" };
    }

    const result = await managedPool.query(
      `
        update public.discord_guilds
        set removed_at = $2
        where discord_guild_id = $1
          and removed_at is null;
      `,
      [guildId, removedAt.toISOString()]
    );

    return {
      marked: result.rowCount > 0,
      reason: result.rowCount > 0 ? "marked-removed" : "not-found-or-already-removed",
    };
  }

  async function close() {
    if (!pool && managedPool) {
      await managedPool.end();
    }
  }

  return {
    close,
    isConfigured,
    markGuildRemoved,
    logger,
  };
}

module.exports = {
  createGuildLifecycleService,
};
