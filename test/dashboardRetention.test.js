const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getRetentionSnapshot,
  getUtcWeekStartDate,
} = require("../dashboard/services/supabaseMetricsService");

test("dashboard retention helper uses Monday UTC week starts", () => {
  assert.equal(
    getUtcWeekStartDate(new Date("2026-06-08T00:00:00.000Z")),
    "2026-06-08"
  );
  assert.equal(
    getUtcWeekStartDate(new Date("2026-06-14T23:59:59.000Z")),
    "2026-06-08"
  );
  assert.equal(
    getUtcWeekStartDate(new Date("2026-06-15T00:00:00.000Z")),
    "2026-06-15"
  );
});

test("dashboard retention snapshot returns empty state without Supabase", async () => {
  const snapshot = await getRetentionSnapshot("guild-1", null);

  assert.equal(snapshot.dailyResearchToday.participants, 0);
  assert.equal(snapshot.weeklyServerGoal.progress, 0);
  assert.equal(snapshot.weeklyServerGoal.target, 100);
  assert.equal(snapshot.journalMomentum.totalUnlocks, 0);
  assert.equal(snapshot.recentCollectionActivity.recentOwnedPalUpdates, 0);
  assert.deepEqual(snapshot.warnings, ["No Supabase connection."]);
});
