const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildResolvedEmbed,
  getWeeklyServerGoalCompletionField,
} = require("../src/commands/capture");
const { formatServerGoal } = require("../src/commands/quests");
const { weeklyServerGoalDefinition } = require("../src/systems/weeklyServerGoalSystem");

function buildCaptureResult(weeklyServerGoal) {
  return {
    pal: {
      name: "Lamball",
      level: 3,
      rarity: "common",
      isShiny: false,
    },
    sphere: "basic",
    captureChance: 70,
    success: true,
    progression: {
      leveledUp: false,
      xpGained: 25,
      coinsGained: 20,
      level: 1,
      xp: 25,
      coins: 120,
      streak: 1,
      oldLevel: 1,
      trainerTitle: "Rookie Tamer",
      unlockMessages: [],
    },
    collectionUpdate: {
      outcome: "new",
      stars: 0,
      essence: 0,
      extraEssence: 0,
      nextStarThreshold: 2,
      starIncreased: false,
    },
    journal: {
      newlyUnlocked: [],
    },
    weeklyServerGoal,
  };
}

function getEmbedField(embed, name) {
  return embed.toJSON().fields.find((field) => field.name === name);
}

test("capture result shows weekly server goal completion on completing capture", () => {
  const result = buildCaptureResult({
    newlyCompleted: true,
    completed: true,
    progress: 100,
    previousProgress: 99,
  });
  const field = getWeeklyServerGoalCompletionField(result);
  const embed = buildResolvedEmbed(result, 9);
  const progressField = getEmbedField(embed, "Progress");

  assert.deepEqual(field, {
    name: "Server Goal Complete",
    value: "Together, the server captured 100 Pals this week.",
  });
  assert.equal(getEmbedField(embed, "Server Goal Complete").value, field.value);
  assert.match(progressField.value, /Server Goal Complete/);
});

test("capture result does not repeat weekly server goal completion after completion", () => {
  const result = buildCaptureResult({
    newlyCompleted: false,
    completed: true,
    progress: 100,
    previousProgress: 100,
  });
  const embed = buildResolvedEmbed(result, 9);

  assert.equal(getWeeklyServerGoalCompletionField(result), null);
  assert.equal(getEmbedField(embed, "Server Goal Complete"), undefined);
});

test("failed capture does not show weekly server goal completion", () => {
  const result = {
    ...buildCaptureResult({
      newlyCompleted: true,
      completed: true,
      progress: 100,
      previousProgress: 99,
    }),
    success: false,
    collectionUpdate: null,
  };

  assert.equal(getWeeklyServerGoalCompletionField(result), null);
});

test("formatServerGoal includes completed state, completedAt, and reset copy", () => {
  const summary = formatServerGoal({
    definition: { ...weeklyServerGoalDefinition },
    state: {
      weekStartDate: "2026-06-08",
      goalKey: weeklyServerGoalDefinition.key,
      progress: 100,
      target: 100,
      completedAt: "2026-06-10T12:34:56.000Z",
    },
    complete: true,
    completionPercentage: 100,
    resetLabel: "Resets Monday at 00:00 UTC",
  });

  assert.match(summary, /Together, capture 100 Pals this week\./);
  assert.match(summary, /100\/100/);
  assert.match(summary, /Completion: 100%/);
  assert.match(summary, /Reset: Resets Monday at 00:00 UTC/);
  assert.match(summary, /Status: ✅ Complete \(2026-06-10 12:34 UTC\)/);
});
