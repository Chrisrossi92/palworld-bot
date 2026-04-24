const spawnCommand = require("../commands/spawn");

const MIN_SPAWN_INTERVAL_MS = 60_000;
const MAX_SPAWN_INTERVAL_MS = 120_000;
const SPAWN_CHANCE = 0.2;

let spawnTimer = null;

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
        console.log("[spawnSystem] SPAWN_CHANNEL_ID not set. Skipping auto spawn.");
        scheduleNextSpawn(client);
        return;
      }

      if (Math.random() >= SPAWN_CHANCE) {
        console.log("[spawnSystem] Auto spawn roll missed.");
        scheduleNextSpawn(client);
        return;
      }

      const channel = await client.channels.fetch(channelId);

      if (!channel || typeof channel.send !== "function") {
        console.log("[spawnSystem] Spawn channel is unavailable or not sendable.");
        scheduleNextSpawn(client);
        return;
      }

      const result = await spawnCommand.startPublicSpawn(channel);

      if (!result.started) {
        console.log("[spawnSystem] Auto spawn skipped because a spawn is already active.");
      } else {
        console.log(`[spawnSystem] Auto spawn created in channel ${channelId}.`);
      }
    } catch (error) {
      console.error("[spawnSystem] Failed to process auto spawn:", error);
    } finally {
      scheduleNextSpawn(client);
    }
  }, delay);
}

function startSpawnSystem(client) {
  if (spawnTimer) {
    clearTimeout(spawnTimer);
  }

  scheduleNextSpawn(client);
}

module.exports = {
  startSpawnSystem,
};
