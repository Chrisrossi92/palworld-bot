const spawnCommand = require("../commands/spawn");

const MINUTE_MS = 60_000;

let spawnTimer = null;

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

function scheduleNextSpawn(client) {
  const nextSpawnTime = getNextSpawnTime();
  const delay = Math.max(0, nextSpawnTime.getTime() - Date.now());

  console.log(`Next spawn scheduled at ${formatTime(nextSpawnTime)}`);

  spawnTimer = setTimeout(async () => {
    try {
      const channelId = process.env.SPAWN_CHANNEL_ID;

      if (!channelId) {
        return;
      }

      const channel = await client.channels.fetch(channelId);

      if (!channel || typeof channel.send !== "function") {
        return;
      }

      const result = await spawnCommand.startPublicSpawn(channel);

      if (!result.started) {
        if (result.reason === "active_spawn") {
          console.log("Spawn skipped (active spawn exists)");
        }
      } else {
        console.log("Spawn triggered");
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
    "[spawnSystem] Auto spawn system started. One spawn attempt will run each hour."
  );
  scheduleNextSpawn(client);
}

module.exports = {
  startSpawnSystem,
};
