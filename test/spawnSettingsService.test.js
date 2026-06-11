const test = require("node:test");
const assert = require("node:assert/strict");
const { createSpawnSettingsService } = require("../src/services/spawnSettingsService");

function createMockPool(results) {
  const calls = [];

  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      const result = results.shift();

      if (!result) {
        return { rows: [] };
      }

      return result;
    },
  };
}

test("updating enabled spawn settings schedules next spawn when missing", async () => {
  const pool = createMockPool([
    { rows: [] },
    {
      rows: [
        {
          discord_guild_id: "guild-1",
          enabled: false,
          channel_id: null,
          interval_minutes: 60,
          last_spawn_at: null,
          next_spawn_at: null,
          created_at: "2026-06-11T11:00:00.000Z",
          updated_at: "2026-06-11T11:00:00.000Z",
        },
      ],
    },
    {
      rows: [
        {
          discord_guild_id: "guild-1",
          enabled: true,
          channel_id: "channel-1",
          interval_minutes: 60,
          last_spawn_at: null,
          next_spawn_at: "2026-06-11T13:00:00.000Z",
          created_at: "2026-06-11T11:00:00.000Z",
          updated_at: "2026-06-11T12:00:00.000Z",
        },
      ],
    },
  ]);
  const service = createSpawnSettingsService({ pool, logger: { log() {} } });

  const settings = await service.updateSpawnSettings(
    "guild-1",
    {
      enabled: true,
      channelId: "channel-1",
      intervalMinutes: 60,
    },
    new Date("2026-06-11T12:00:00.000Z")
  );

  assert.equal(settings.enabled, true);
  assert.equal(settings.channelId, "channel-1");
  assert.equal(settings.nextSpawnAt.toISOString(), "2026-06-11T13:00:00.000Z");
  assert.equal(pool.calls[2].params[4], "2026-06-11T13:00:00.000Z");
});

test("updating enabled spawn settings rejects missing channel id", async () => {
  const pool = createMockPool([
    { rows: [] },
    {
      rows: [
        {
          discord_guild_id: "guild-1",
          enabled: false,
          channel_id: null,
          interval_minutes: 60,
          last_spawn_at: null,
          next_spawn_at: null,
          created_at: "2026-06-11T11:00:00.000Z",
          updated_at: "2026-06-11T11:00:00.000Z",
        },
      ],
    },
  ]);
  const service = createSpawnSettingsService({ pool, logger: { log() {} } });

  await assert.rejects(
    () => service.updateSpawnSettings(
      "guild-1",
      {
        enabled: true,
        channelId: null,
        intervalMinutes: 60,
      },
      new Date("2026-06-11T12:00:00.000Z")
    ),
    /channel_id is required when enabled is true/
  );
});
