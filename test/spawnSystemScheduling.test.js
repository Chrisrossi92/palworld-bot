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

test("scheduled spawn processing refreshes current channel before posting", async () => {
  const now = new Date("2026-06-11T12:00:00.000Z");
  const attempts = [];
  const service = {
    attempts,
    isConfigured() {
      return true;
    },
    getSettingsSource() {
      return "test";
    },
    async listDueSpawnSettings() {
      return [
        {
          guildId: "guild-1",
          channelId: "old-channel",
          enabled: true,
          intervalMinutes: 60,
          nextSpawnAt: now,
        },
      ];
    },
    async getSpawnSettings(guildId) {
      return {
        guildId,
        channelId: "new-channel",
        enabled: true,
        intervalMinutes: 60,
        nextSpawnAt: now,
      };
    },
    async recordSpawnAttempt(guildId, at) {
      attempts.push({ guildId, at });
      return null;
    },
  };
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
  assert.deepEqual(fetchedChannels, ["new-channel"]);
  assert.deepEqual(startedChannels, ["new-channel"]);
  assert.deepEqual(service.attempts, [{ guildId: "guild-1", at: now }]);
});

test("scheduled spawn processing skips when refreshed settings are disabled", async () => {
  const now = new Date("2026-06-11T12:00:00.000Z");
  const service = {
    isConfigured() {
      return true;
    },
    getSettingsSource() {
      return "test";
    },
    async listDueSpawnSettings() {
      return [
        {
          guildId: "guild-1",
          channelId: "old-channel",
          enabled: true,
          intervalMinutes: 60,
          nextSpawnAt: now,
        },
      ];
    },
    async getSpawnSettings(guildId) {
      return {
        guildId,
        channelId: "new-channel",
        enabled: false,
        intervalMinutes: 60,
        nextSpawnAt: now,
      };
    },
    async recordSpawnAttempt() {
      throw new Error("recordSpawnAttempt should not be called");
    },
  };
  let fetchCount = 0;
  const client = {
    channels: {
      async fetch() {
        fetchCount += 1;
        return null;
      },
    },
  };

  const processed = await processDueSpawnSettings(client, service, {
    now,
    logger: { log() {}, warn() {}, error() {} },
    async startPublicSpawn() {
      throw new Error("startPublicSpawn should not be called");
    },
  });

  assert.equal(processed, 0);
  assert.equal(fetchCount, 0);
});
