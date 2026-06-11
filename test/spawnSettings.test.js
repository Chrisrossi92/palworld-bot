const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getDueSpawnSettings,
  getNextSpawnAt,
  isSpawnSettingDue,
  validateSpawnSettings,
} = require("../src/systems/spawnSettings");

test("spawn settings default to disabled and a 60 minute interval", () => {
  const result = validateSpawnSettings({ guildId: "guild-1" });

  assert.equal(result.valid, true);
  assert.equal(result.settings.enabled, false);
  assert.equal(result.settings.intervalMinutes, 60);
});

test("enabled spawn settings require a channel id", () => {
  const result = validateSpawnSettings({
    guildId: "guild-1",
    enabled: true,
    intervalMinutes: 60,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["channel_id is required when enabled is true."]);
});

test("spawn settings enforce a 30 minute minimum interval", () => {
  const result = validateSpawnSettings({
    guildId: "guild-1",
    enabled: false,
    intervalMinutes: 29,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["interval_minutes must be at least 30."]);
});

test("spawn setting due check requires enabled settings with a due next spawn", () => {
  const now = new Date("2026-06-11T12:00:00.000Z");

  assert.equal(
    isSpawnSettingDue({
      guildId: "guild-1",
      enabled: true,
      channelId: "channel-1",
      intervalMinutes: 60,
      nextSpawnAt: "2026-06-11T11:59:00.000Z",
    }, now),
    true
  );
  assert.equal(
    isSpawnSettingDue({
      guildId: "guild-1",
      enabled: false,
      channelId: "channel-1",
      intervalMinutes: 60,
      nextSpawnAt: "2026-06-11T11:59:00.000Z",
    }, now),
    false
  );
});

test("due spawn settings filter invalid and future settings", () => {
  const now = new Date("2026-06-11T12:00:00.000Z");
  const due = getDueSpawnSettings([
    {
      guildId: "guild-1",
      enabled: true,
      channelId: "channel-1",
      intervalMinutes: 60,
      nextSpawnAt: "2026-06-11T11:59:00.000Z",
    },
    {
      guildId: "guild-2",
      enabled: true,
      channelId: "channel-2",
      intervalMinutes: 60,
      nextSpawnAt: "2026-06-11T12:01:00.000Z",
    },
    {
      guildId: "guild-3",
      enabled: true,
      intervalMinutes: 60,
      nextSpawnAt: "2026-06-11T11:59:00.000Z",
    },
  ], now);

  assert.deepEqual(due.map((settings) => settings.guildId), ["guild-1"]);
});

test("next spawn time uses the configured interval", () => {
  const now = new Date("2026-06-11T12:00:00.000Z");

  assert.equal(
    getNextSpawnAt(now, 45).toISOString(),
    "2026-06-11T12:45:00.000Z"
  );
});
