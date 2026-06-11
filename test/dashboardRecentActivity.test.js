const test = require("node:test");
const assert = require("node:assert/strict");
const { getRecentActivity } = require("../dashboard/services/supabaseMetricsService");

function createMockPool(results) {
  return {
    async query() {
      return results.shift() || { rows: [] };
    },
  };
}

test("recent activity exposes Pal image URLs for latest captures", async () => {
  const pool = createMockPool([
    {
      rows: [
        {
          discord_user_id: "user-1",
          display_name: "Collector",
          pal_name: "Lamball",
          rarity: "common",
          level: 7,
          is_shiny: false,
          image_url: "https://example.com/lamball.png",
          last_caught_at: new Date("2026-06-11T12:00:00.000Z"),
        },
      ],
    },
    {
      rows: [],
    },
  ]);

  const activity = await getRecentActivity("guild-1", pool);

  assert.deepEqual(activity.latestCaptures, [
    {
      userId: "user-1",
      displayName: "Collector",
      palName: "Lamball",
      rarity: "common",
      level: 7,
      isShiny: false,
      imageUrl: "https://example.com/lamball.png",
      caughtAt: "2026-06-11T12:00:00.000Z",
    },
  ]);
});
