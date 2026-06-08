const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  claimDailyResearchState,
  chooseDailyResearchDefinition,
  dailyResearchDefinitions,
  getDailyResearchStatus,
  incrementDailyResearchProgress,
  normalizeDailyResearchState,
} = require("../src/systems/dailyResearchSystem");

test("normalizes old users without dailyResearch safely", () => {
  const state = normalizeDailyResearchState(null, {
    date: "2026-06-08",
  });

  assert.deepEqual(state, {
    date: "2026-06-08",
    assignmentKey: "field-research-3-captures",
    progress: 0,
    target: 3,
    claimed: false,
    claimedAt: null,
  });
});

test("keeps a stable assignment for the same date", () => {
  const first = normalizeDailyResearchState(null, {
    date: "2026-06-08",
  });
  const second = normalizeDailyResearchState(
    {
      ...first,
      progress: 2,
    },
    {
      date: "2026-06-08",
    }
  );

  assert.equal(second.assignmentKey, first.assignmentKey);
  assert.equal(second.date, "2026-06-08");
  assert.equal(second.progress, 2);
});

test("deterministically selects the same assignment for player, guild, and date", () => {
  const first = chooseDailyResearchDefinition({
    guildId: "guild-1",
    userId: "user-1",
    date: "2026-06-08",
  });
  const second = chooseDailyResearchDefinition({
    guildId: "guild-1",
    userId: "user-1",
    date: "2026-06-08",
  });

  assert.equal(first.key, second.key);
  assert.ok(dailyResearchDefinitions.some((definition) => definition.key === first.key));
});

test("assignment pool includes only capture attempt and catch assignments", () => {
  assert.deepEqual(
    dailyResearchDefinitions.map((definition) => definition.key),
    [
      "field-research-3-captures",
      "field-research-5-captures",
      "field-research-catch-1-pal",
      "field-research-catch-2-pals",
      "field-research-3-attempts",
    ]
  );
});

test("resets assignment progress on a new UTC date", () => {
  const state = normalizeDailyResearchState(
    {
      date: "2026-06-08",
      assignmentKey: "field-research-3-captures",
      progress: 3,
      target: 3,
      claimed: true,
      claimedAt: "2026-06-08T12:00:00.000Z",
    },
    {
      date: "2026-06-09",
    }
  );

  assert.equal(state.date, "2026-06-09");
  assert.equal(state.progress, 0);
  assert.equal(state.claimed, false);
  assert.equal(state.claimedAt, null);
});

test("preserves an existing same-day assignment instead of rerolling it", () => {
  const state = normalizeDailyResearchState(
    {
      date: "2026-06-08",
      assignmentKey: "field-research-catch-2-pals",
      progress: 1,
      target: 2,
      claimed: false,
      claimedAt: null,
    },
    {
      guildId: "guild-1",
      userId: "user-1",
      date: "2026-06-08",
    }
  );

  assert.equal(state.assignmentKey, "field-research-catch-2-pals");
  assert.equal(state.progress, 1);
  assert.equal(state.target, 2);
});

test("increments progress and caps at target", () => {
  const state = incrementDailyResearchProgress(
    {
      date: "2026-06-08",
      assignmentKey: "field-research-3-captures",
      progress: 2,
      target: 3,
      claimed: false,
      claimedAt: null,
    },
    5,
    {
      date: "2026-06-08",
    }
  );

  assert.equal(state.progress, 3);
});

test("successful captures also advance attempt assignments", () => {
  const state = incrementDailyResearchProgress(
    {
      date: "2026-06-08",
      assignmentKey: "field-research-5-captures",
      progress: 1,
      target: 5,
      claimed: false,
      claimedAt: null,
    },
    1,
    {
      date: "2026-06-08",
      eventType: "capture_success",
    }
  );

  assert.equal(state.progress, 2);
});

test("failed capture attempts do not advance catch assignments", () => {
  const state = incrementDailyResearchProgress(
    {
      date: "2026-06-08",
      assignmentKey: "field-research-catch-1-pal",
      progress: 0,
      target: 1,
      claimed: false,
      claimedAt: null,
    },
    1,
    {
      date: "2026-06-08",
      eventType: "capture_attempt",
    }
  );

  assert.equal(state.progress, 0);
});

test("successful captures advance catch assignments", () => {
  const state = incrementDailyResearchProgress(
    {
      date: "2026-06-08",
      assignmentKey: "field-research-catch-1-pal",
      progress: 0,
      target: 1,
      claimed: false,
      claimedAt: null,
    },
    1,
    {
      date: "2026-06-08",
      eventType: "capture_success",
    }
  );

  assert.equal(state.progress, 1);
});

test("incomplete claim fails without mutating claimed state", () => {
  const originalState = {
    date: "2026-06-08",
    assignmentKey: "field-research-3-captures",
    progress: 2,
    target: 3,
    claimed: false,
    claimedAt: null,
  };
  const result = claimDailyResearchState(
    originalState,
    {
      date: "2026-06-08",
      now: new Date("2026-06-08T12:00:00.000Z"),
    }
  );

  assert.equal(result.claimed, false);
  assert.equal(result.complete, false);
  assert.deepEqual(result.state, originalState);
});

test("complete claim succeeds once", () => {
  const result = claimDailyResearchState(
    {
      date: "2026-06-08",
      assignmentKey: "field-research-3-captures",
      progress: 3,
      target: 3,
      claimed: false,
      claimedAt: null,
    },
    {
      date: "2026-06-08",
      now: new Date("2026-06-08T12:00:00.000Z"),
    }
  );

  assert.equal(result.claimed, true);
  assert.equal(result.complete, true);
  assert.equal(result.state.claimed, true);
  assert.equal(result.state.claimedAt, "2026-06-08T12:00:00.000Z");
  assert.deepEqual(result.rewards, {
    coins: 75,
    xp: 35,
  });
});

test("duplicate claim does not double-pay", () => {
  const firstClaim = claimDailyResearchState(
    {
      date: "2026-06-08",
      assignmentKey: "field-research-3-captures",
      progress: 3,
      target: 3,
      claimed: false,
      claimedAt: null,
    },
    {
      date: "2026-06-08",
      now: new Date("2026-06-08T12:00:00.000Z"),
    }
  );
  const secondClaim = claimDailyResearchState(firstClaim.state, {
    date: "2026-06-08",
    now: new Date("2026-06-08T13:00:00.000Z"),
  });

  assert.equal(firstClaim.claimed, true);
  assert.equal(secondClaim.claimed, false);
  assert.equal(secondClaim.alreadyClaimed, true);
  assert.equal(secondClaim.state.claimedAt, "2026-06-08T12:00:00.000Z");
});

test("status exposes claimability for scoped state", () => {
  const guildAUserState = incrementDailyResearchProgress(null, 3, {
    date: "2026-06-08",
  });
  const guildBUserState = normalizeDailyResearchState(null, {
    date: "2026-06-08",
  });

  assert.equal(getDailyResearchStatus(guildAUserState, {
    date: "2026-06-08",
  }).claimable, true);
  assert.equal(getDailyResearchStatus(guildBUserState, {
    date: "2026-06-08",
  }).claimable, false);
});

test("migration defines the Daily Research persistence table and uniqueness", () => {
  const migrationPath = path.join(
    __dirname,
    "../supabase/migrations/20260608010000_player_daily_research.sql"
  );
  const migration = fs.readFileSync(migrationPath, "utf8");

  assert.match(migration, /create table public\.player_daily_research/);
  assert.match(migration, /player_id uuid not null references public\.guild_players\(id\) on delete cascade/);
  assert.match(migration, /research_date date not null/);
  assert.match(migration, /constraint player_daily_research_player_date_unique unique \(player_id, research_date\)/);
});
