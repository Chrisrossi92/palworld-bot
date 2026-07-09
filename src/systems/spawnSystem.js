const spawnCommand = require("../commands/spawn");
const { createSpawnSettingsService } = require("../services/spawnSettingsService");

const MINUTE_MS = 60_000;
const SPAWN_SETTINGS_POLL_MS = 60_000;

let spawnTimer = null;
let spawnSettingsTimer = null;
let spawnSettingsService = null;

function getNextSpawnTime(now = new Date()) {
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  const randomOffsetMinutes = Math.floor(Math.random() * 60);
  return new Date(nextHour.getTime() + randomOffsetMinutes * MINUTE_MS);
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

async function processLegacySpawn(client, logger = console) {
  const channelId = process.env.SPAWN_CHANNEL_ID;

  if (!channelId) {
    return;
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel || typeof channel.send !== "function") {
    logger.warn(`[spawnSystem] Legacy spawn channel ${channelId} is not sendable.`);
    return;
  }

  logger.log(
    `[spawnSystem] Processing legacy scheduled spawn guild=legacy channel=${channelId} interval=random-hourly source=env:SPAWN_CHANNEL_ID`
  );

  const result = await spawnCommand.startPublicSpawn(channel);

  if (!result.started) {
    if (result.reason === "active_spawn") {
      logger.log("Spawn skipped (active spawn exists)");
    }
  } else {
    logger.log("Spawn triggered");
  }
}

async function processDueSpawnSettings(client, service, {
  now = new Date(),
  logger = console,
  startPublicSpawn = spawnCommand.startPublicSpawn,
} = {}) {
  if (!service || !service.isConfigured()) {
    return 0;
  }

  const dueSettings = await service.listDueSpawnSettings(now);
  const settingsSource = typeof service.getSettingsSource === "function"
    ? service.getSettingsSource()
    : "unknown";
  let processedCount = 0;

  for (const dueSetting of dueSettings) {
    let settings = dueSetting;

    try {
      settings = typeof service.getSpawnSettings === "function"
        ? await service.getSpawnSettings(dueSetting.guildId)
        : dueSetting;

      if (!settings.enabled || !settings.channelId) {
        logger.log(
          `[spawnSystem] Scheduled spawn skipped guild=${dueSetting.guildId} reason=settings-disabled-or-missing-channel source=${settingsSource}`
        );
        continue;
      }

      if (
        settings.nextSpawnAt instanceof Date &&
        settings.nextSpawnAt.getTime() > now.getTime()
      ) {
        logger.log(
          `[spawnSystem] Scheduled spawn skipped guild=${settings.guildId} reason=no-longer-due nextSpawnAt=${settings.nextSpawnAt.toISOString()} source=${settingsSource}`
        );
        continue;
      }

      logger.log(
        `[spawnSystem] Processing scheduled spawn guild=${settings.guildId} configuredChannel=${settings.channelId} interval=${settings.intervalMinutes} source=${settingsSource}`
      );

      const channel = await client.channels.fetch(settings.channelId);

      if (!channel || typeof channel.send !== "function") {
        logger.warn(
          `[spawnSystem] Scheduled spawn channel is not sendable guild=${settings.guildId} channel=${settings.channelId}`
        );
        await service.recordSpawnAttempt(settings.guildId, now);
        processedCount += 1;
        continue;
      }

      const result = await startPublicSpawn(channel);

      if (!result.started) {
        if (result.reason === "active_spawn") {
          logger.log(`[spawnSystem] Scheduled spawn skipped; active spawn exists guild=${settings.guildId}`);
        } else {
          logger.log(`[spawnSystem] Scheduled spawn skipped guild=${settings.guildId} reason=${result.reason || "unknown"}`);
        }
      } else {
        logger.log(`[spawnSystem] Scheduled spawn triggered guild=${settings.guildId} channel=${settings.channelId}`);
      }

      await service.recordSpawnAttempt(settings.guildId, now);
      processedCount += 1;
    } catch (error) {
      logger.error(
        `[spawnSystem] Failed to process scheduled spawn guild=${settings.guildId} channel=${settings.channelId}:`,
        error?.stack || error
      );
    }
  }

  return processedCount;
}

function scheduleNextSpawn(client) {
  const nextSpawnTime = getNextSpawnTime();
  const delay = Math.max(0, nextSpawnTime.getTime() - Date.now());

  console.log(`Next spawn scheduled at ${formatTime(nextSpawnTime)}`);

  spawnTimer = setTimeout(async () => {
    try {
      await processLegacySpawn(client);
    } catch (error) {
      console.error("[spawnSystem] Failed to process auto spawn:", error?.stack || error);
    } finally {
      scheduleNextSpawn(client);
    }
  }, delay);
}

function startSpawnSettingsPoller(client, service = spawnSettingsService) {
  if (!service || !service.isConfigured()) {
    console.log("[spawnSystem] Per-guild spawn settings disabled; SUPABASE_DB_URL is not configured.");
    return;
  }

  const runTick = async () => {
    try {
      await processDueSpawnSettings(client, service);
    } catch (error) {
      console.error("[spawnSystem] Failed to poll per-guild spawn settings:", error?.stack || error);
    }
  };

  if (spawnSettingsTimer) {
    clearInterval(spawnSettingsTimer);
  }

  spawnSettingsTimer = setInterval(runTick, SPAWN_SETTINGS_POLL_MS);
  void runTick();

  console.log("[spawnSystem] Per-guild spawn settings poller started.");
}

async function ensureDefaultSpawnSettingsForGuild(guild, service = spawnSettingsService) {
  if (!service || !service.isConfigured()) {
    return null;
  }

  try {
    return await service.ensureDefaultSpawnSettings(guild);
  } catch (error) {
    console.error(
      `[spawnSystem] Failed to ensure disabled spawn settings for guild id=${guild.id}:`,
      error?.stack || error
    );
    return null;
  }
}

function startSpawnSystem(client, {
  service = createSpawnSettingsService(),
} = {}) {
  if (spawnTimer) {
    clearTimeout(spawnTimer);
  }

  spawnSettingsService = service;

  startSpawnSettingsPoller(client, service);

  if (service?.isConfigured()) {
    if (process.env.SPAWN_CHANNEL_ID) {
      console.log(
        "[spawnSystem] Ignoring SPAWN_CHANNEL_ID legacy fallback because per-guild spawn settings are configured."
      );
    }
  } else if (process.env.SPAWN_CHANNEL_ID) {
    console.log(
      "[spawnSystem] Legacy single-channel auto spawn fallback started. One spawn attempt will run each hour."
    );
    scheduleNextSpawn(client);
  } else {
    console.log("[spawnSystem] Legacy single-channel auto spawn fallback disabled; SPAWN_CHANNEL_ID is not configured.");
  }
}

module.exports = {
  ensureDefaultSpawnSettingsForGuild,
  getNextSpawnTime,
  processDueSpawnSettings,
  startSpawnSystem,
};
