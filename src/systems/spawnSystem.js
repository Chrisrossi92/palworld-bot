const spawnCommand = require("../commands/spawn");

const MIN_SPAWN_INTERVAL_MS = 10 * 60_000;
const MAX_SPAWN_INTERVAL_MS = 20 * 60_000;
const SPAWN_CHANCE = 0.15;
const ACTIVE_SPAWN_LOG_COOLDOWN_MS = 10 * 60_000;

let spawnTimer = null;
let lastActiveSpawnLogAt = 0;

function getRandomIntervalMs() {
  return (
    MIN_SPAWN_INTERVAL_MS +
    Math.floor(Math.random() * (MAX_SPAWN_INTERVAL_MS - MIN_SPAWN_INTERVAL_MS + 1))
  );
}

function scheduleNextSpawn(client) {
  const delay = getRandomIntervalMs();

  spawnTimer = setTimeout(async () => {
    try {
      const channelId = process.env.SPAWN_CHANNEL_ID;

      if (!channelId) {
        scheduleNextSpawn(client);
        return;
      }

      if (Math.random() >= SPAWN_CHANCE) {
        scheduleNextSpawn(client);
        return;
      }

      const channel = await client.channels.fetch(channelId);

      if (!channel || typeof channel.send !== "function") {
        scheduleNextSpawn(client);
        return;
      }

      const result = await spawnCommand.startPublicSpawn(channel);

      if (!result.started) {
        const now = Date.now();

        if (now - lastActiveSpawnLogAt >= ACTIVE_SPAWN_LOG_COOLDOWN_MS) {
          console.log("[spawnSystem] Auto spawn skipped because a spawn is already active.");
          lastActiveSpawnLogAt = now;
        }
      } else {
        lastActiveSpawnLogAt = 0;
        console.log(`[spawnSystem] Auto spawn created in channel ${channelId}.`);
      }
    } catch (error) {
      console.error("[spawnSystem] Failed to process auto spawn:", error?.stack || error);
    } finally {
      scheduleNextSpawn(client);
    }
  }, delay);
}

function startSpawnSystem(client) {
  if (spawnTimer) {
    clearTimeout(spawnTimer);
  }

  console.log(
    `[spawnSystem] Auto spawn system started. Next rolls every 10-20 minutes at 15% chance.`
  );
  scheduleNextSpawn(client);
}

module.exports = {
  startSpawnSystem,
};
