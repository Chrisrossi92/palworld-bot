const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getCurrentWeeklyServerGoal,
  getUtcWeekStartDate,
  getWeeklyServerGoalStatus,
  incrementWeeklyServerGoalProgress,
  normalizeWeeklyServerGoalState,
  weeklyServerGoalDefinition,
} = require("../src/systems/weeklyServerGoalSystem");

test("getUtcWeekStartDate calculates Monday UTC week starts", () => {
  assert.equal(
    getUtcWeekStartDate(new Date("2026-06-08T00:00:00.000Z")),
    "2026-06-08"
  );
  assert.equal(
    getUtcWeekStartDate(new Date("2026-06-10T18:30:00.000Z")),
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

test("getCurrentWeeklyServerGoal keeps the same guild week goal stable", () => {
  const options = { now: new Date("2026-06-10T12:00:00.000Z") };
  const first = getCurrentWeeklyServerGoal(null, options);
  const second = getCurrentWeeklyServerGoal(first, options);

  assert.deepEqual(second, first);
  assert.equal(second.weekStartDate, "2026-06-08");
  assert.equal(second.goalKey, weeklyServerGoalDefinition.key);
});

test("normalizeWeeklyServerGoalState resets on a new week", () => {
  const previous = normalizeWeeklyServerGoalState(null, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });
  const updated = {
    ...previous,
    progress: 42,
  };
  const nextWeek = normalizeWeeklyServerGoalState(updated, {
    now: new Date("2026-06-15T00:00:00.000Z"),
  });

  assert.equal(nextWeek.weekStartDate, "2026-06-15");
  assert.equal(nextWeek.progress, 0);
  assert.equal(nextWeek.completedAt, null);
});

test("successful capture increments weekly server goal progress", () => {
  const result = incrementWeeklyServerGoalProgress(null, 1, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(result.previousProgress, 0);
  assert.equal(result.progress, 1);
  assert.equal(result.incrementedBy, 1);
  assert.equal(result.state.progress, 1);
});

test("failed capture can leave weekly server goal unchanged", () => {
  const result = incrementWeeklyServerGoalProgress(
    {
      weekStartDate: "2026-06-08",
      goalKey: weeklyServerGoalDefinition.key,
      progress: 7,
      target: weeklyServerGoalDefinition.target,
      completedAt: null,
    },
    0,
    {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }
  );

  assert.equal(result.previousProgress, 7);
  assert.equal(result.progress, 7);
  assert.equal(result.incrementedBy, 0);
});

test("weekly server goal progress caps at target", () => {
  const result = incrementWeeklyServerGoalProgress(
    {
      weekStartDate: "2026-06-08",
      goalKey: weeklyServerGoalDefinition.key,
      progress: 99,
      target: weeklyServerGoalDefinition.target,
      completedAt: null,
    },
    5,
    {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }
  );

  assert.equal(result.progress, 100);
  assert.equal(result.incrementedBy, 1);
  assert.equal(result.completed, true);
  assert.equal(result.newlyCompleted, true);
});

test("completedAt is set once when target is reached", () => {
  const completed = incrementWeeklyServerGoalProgress(
    {
      weekStartDate: "2026-06-08",
      goalKey: weeklyServerGoalDefinition.key,
      progress: 99,
      target: weeklyServerGoalDefinition.target,
      completedAt: null,
    },
    1,
    {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }
  );
  const repeated = incrementWeeklyServerGoalProgress(completed.state, 1, {
    now: new Date("2026-06-11T12:00:00.000Z"),
  });

  assert.equal(completed.state.completedAt, "2026-06-10T12:00:00.000Z");
  assert.equal(repeated.state.completedAt, "2026-06-10T12:00:00.000Z");
  assert.equal(repeated.newlyCompleted, false);
});

test("guild scoping stays isolated when keyed by guild", () => {
  const guildGoals = {
    "guild-a": getCurrentWeeklyServerGoal(null, {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }),
    "guild-b": getCurrentWeeklyServerGoal(null, {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }),
  };

  guildGoals["guild-a"] = incrementWeeklyServerGoalProgress(
    guildGoals["guild-a"],
    3,
    {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }
  ).state;

  assert.equal(guildGoals["guild-a"].progress, 3);
  assert.equal(guildGoals["guild-b"].progress, 0);
});

test("empty or missing weekly server goal state normalizes safely", () => {
  const status = getWeeklyServerGoalStatus(null, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(status.state.weekStartDate, "2026-06-08");
  assert.equal(status.state.progress, 0);
  assert.equal(status.state.target, 100);
  assert.equal(status.completionPercentage, 0);
  assert.equal(status.complete, false);
});
