const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildJournalEmbed,
  formatNextMilestones,
  formatRecentUnlocks,
} = require("../src/commands/journal");

function buildSummary(overrides = {}) {
  return {
    unlockedCount: 0,
    totalDefinitions: 13,
    completionPercentage: 0,
    categoryBreakdown: [
      { category: "Discovery", unlockedCount: 0, totalDefinitions: 4 },
      { category: "Collector", unlockedCount: 0, totalDefinitions: 3 },
      { category: "Progression", unlockedCount: 0, totalDefinitions: 4 },
      { category: "Rare Hunter", unlockedCount: 0, totalDefinitions: 2 },
    ],
    recentUnlocks: [],
    nextMilestones: [],
    ...overrides,
  };
}

test("buildJournalEmbed renders empty Journal state compactly", () => {
  const embed = buildJournalEmbed("Tester", buildSummary()).toJSON();

  assert.equal(embed.title, "Tester's Journal");
  assert.equal(embed.fields.find((field) => field.name === "Summary").value, "0/13 unlocked\n0% complete");
  assert.match(embed.fields.find((field) => field.name === "Categories").value, /Discovery: 0\/4/);
  assert.equal(embed.fields.find((field) => field.name === "Recent Unlocks").value, "None yet.");
  assert.equal(
    embed.fields.find((field) => field.name === "Next Milestones").value,
    "All current Journal entries complete."
  );
  assert.equal(
    embed.footer.text,
    "Journal updates after captures and progression changes."
  );
});

test("Journal command formatting caps recent unlocks and next milestones", () => {
  const summary = buildSummary({
    recentUnlocks: [
      { category: "Discovery", title: "One" },
      { category: "Collector", title: "Two" },
      { category: "Progression", title: "Three" },
      { category: "Rare Hunter", title: "Four" },
    ],
    nextMilestones: [
      { category: "Discovery", title: "A", value: 1, target: 10, metricLabel: "captures" },
      { category: "Collector", title: "B", value: 2, target: 10, metricLabel: "unique species" },
      { category: "Progression", title: "C", value: 3, target: 5, metricLabel: "trainer level" },
      { category: "Rare Hunter", title: "D", value: 0, target: 1, metricLabel: "rare Pals" },
    ],
  });

  assert.equal(formatRecentUnlocks(summary).split("\n").length, 3);
  assert.equal(formatNextMilestones(summary).split("\n").length, 3);
  assert.doesNotMatch(formatRecentUnlocks(summary), /Four/);
  assert.doesNotMatch(formatNextMilestones(summary), /Rare Hunter: D/);
});
