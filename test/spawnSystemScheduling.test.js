const test = require("node:test");
const assert = require("node:assert/strict");
const { processDueSpawnSettings } = require("../src/systems/spawnSystem");

function createMockService(settings) {
  const attempts = [];

  return {
    attempts,
    isConfigured() {
      return true;
    },
    async listDueSpawnSettings() {
      return settings;
    },
    async recordSpawnAttempt(guildId, at) {
      attempts.push({ guildId, at });
      return null;
    },
  };
}

test("scheduled spawn processing starts due spawns and records attempts", async () => {
  const now = new Date("2026-06-11T12:00:00.000Z");
  const service = createMockService([
    {
      guildId: "guild-1",
      channelId: "channel-1",
      enabled: true,
      intervalMinutes: 60,
    },
  ]);
  const fetchedChannels = [];
  const client = {
    channels: {
      async fetch(channelId) {
        fetchedChannels.push(channelId);
        return {
          id: channelId,
          send() {},
        };
      },
    },
  };
  const startedChannels = [];

  const processed = await processDueSpawnSettings(client, service, {
    now,
    logger: { log() {}, warn() {}, error() {} },
    async startPublicSpawn(channel) {
      startedChannels.push(channel.id);
      return { started: true };
    },
  });

  assert.equal(processed, 1);
  assert.deepEqual(fetchedChannels, ["channel-1"]);
  assert.deepEqual(startedChannels, ["channel-1"]);
  assert.deepEqual(service.attempts, [{ guildId: "guild-1", at: now }]);
});

test("scheduled spawn processing records invalid channel attempts without starting", async () => {
  const now = new Date("2026-06-11T12:00:00.000Z");
  const service = createMockService([
    {
      guildId: "guild-1",
      channelId: "channel-1",
      enabled: true,
      intervalMinutes: 60,
    },
  ]);
  const client = {
    channels: {
      async fetch() {
        return null;
      },
    },
  };
  let startCount = 0;

  const processed = await processDueSpawnSettings(client, service, {
    now,
    logger: { log() {}, warn() {}, error() {} },
    async startPublicSpawn() {
      startCount += 1;
      return { started: true };
    },
  });

  assert.equal(processed, 1);
  assert.equal(startCount, 0);
  assert.deepEqual(service.attempts, [{ guildId: "guild-1", at: now }]);
});
