const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateJournal,
  getJournalCategorySummary,
  getNextJournalMilestones,
  journalDefinitions,
  normalizeJournal,
  summarizeJournal,
} = require("../src/systems/journalSystem");

test("evaluateJournal unlocks capture, collection, progression, and rare milestones", () => {
  const result = evaluateJournal({
    userRecord: {
      captures: 10,
      level: 10,
    },
    ownedPals: [
      { name: "Lamball", rarity: "common" },
      { name: "Cattiva", rarity: "common" },
      { name: "Chikipi", rarity: "common" },
      { name: "Foxparks", rarity: "uncommon" },
      { name: "Pengullet", rarity: "uncommon" },
      { name: "Direhowl", rarity: "rare" },
      { name: "Anubis", rarity: "epic" },
      { name: "Jetragon", rarity: "legendary" },
      { name: "Mossanda", rarity: "common" },
      { name: "Tanzee", rarity: "common" },
    ],
    journal: normalizeJournal(null),
    now: new Date("2026-06-08T12:00:00.000Z"),
  });

  assert.equal(result.totalDefinitions, journalDefinitions.length);
  assert.equal(result.metrics.captures, 10);
  assert.equal(result.metrics.uniqueSpecies, 10);
  assert.equal(result.metrics.level, 10);
  assert.equal(result.metrics.rareCaptures, 3);
  assert.ok(result.journal.unlocked["discovery-first-capture"]);
  assert.ok(result.journal.unlocked["discovery-10-captures"]);
  assert.ok(result.journal.unlocked["collector-10-species"]);
  assert.ok(result.journal.unlocked["progression-level-5"]);
  assert.ok(result.journal.unlocked["progression-level-10"]);
  assert.ok(result.journal.unlocked["rare-hunter-first-rare"]);
  assert.equal(result.journal.unlocked["discovery-10-captures"].unlockedAt, "2026-06-08T12:00:00.000Z");
});

test("evaluateJournal does not return existing unlocks again", () => {
  const firstPass = evaluateJournal({
    userRecord: {
      captures: 1,
      level: 1,
    },
    ownedPals: [{ name: "Lamball", rarity: "common" }],
    journal: normalizeJournal(null),
    now: new Date("2026-06-08T12:00:00.000Z"),
  });

  const secondPass = evaluateJournal({
    userRecord: {
      captures: 1,
      level: 1,
    },
    ownedPals: [{ name: "Lamball", rarity: "common" }],
    journal: firstPass.journal,
    now: new Date("2026-06-09T12:00:00.000Z"),
  });

  assert.equal(firstPass.newlyUnlocked.length, 1);
  assert.equal(secondPass.newlyUnlocked.length, 0);
  assert.equal(
    secondPass.journal.unlocked["discovery-first-capture"].unlockedAt,
    "2026-06-08T12:00:00.000Z"
  );
});

test("evaluateJournal preserves one stored entry per unlocked key", () => {
  const firstPass = evaluateJournal({
    userRecord: {
      captures: 10,
      level: 10,
    },
    ownedPals: Array.from({ length: 10 }, (_value, index) => ({
      name: `Pal ${index + 1}`,
      rarity: index === 0 ? "rare" : "common",
    })),
    journal: normalizeJournal(null),
    now: new Date("2026-06-08T12:00:00.000Z"),
  });
  const secondPass = evaluateJournal({
    userRecord: {
      captures: 10,
      level: 10,
    },
    ownedPals: Array.from({ length: 10 }, (_value, index) => ({
      name: `Pal ${index + 1}`,
      rarity: index === 0 ? "rare" : "common",
    })),
    journal: firstPass.journal,
    now: new Date("2026-06-09T12:00:00.000Z"),
  });

  assert.equal(secondPass.newlyUnlocked.length, 0);
  assert.equal(
    Object.keys(secondPass.journal.unlocked).length,
    Object.keys(firstPass.journal.unlocked).length
  );
});

test("summarizeJournal reports recent unlocks and total definitions", () => {
  const summary = summarizeJournal({
    unlocked: {
      "discovery-first-capture": {
        key: "discovery-first-capture",
        category: "Discovery",
        title: "First Field Note",
        unlockedAt: "2026-06-08T12:00:00.000Z",
      },
      "progression-level-5": {
        key: "progression-level-5",
        category: "Progression",
        title: "Rookie No More",
        unlockedAt: "2026-06-09T12:00:00.000Z",
      },
    },
  });

  assert.equal(summary.unlockedCount, 2);
  assert.equal(summary.totalDefinitions, journalDefinitions.length);
  assert.equal(summary.completionPercentage, Number(((2 / journalDefinitions.length) * 100).toFixed(1)));
  assert.equal(summary.recentUnlocks[0].key, "progression-level-5");
  assert.deepEqual(
    summary.categoryBreakdown.map((entry) => [
      entry.category,
      entry.unlockedCount,
      entry.totalDefinitions,
    ]),
    [
      ["Discovery", 1, 4],
      ["Collector", 0, 3],
      ["Progression", 1, 4],
      ["Rare Hunter", 0, 2],
    ]
  );
});

test("getJournalCategorySummary handles empty Journal state", () => {
  const categories = getJournalCategorySummary(null);

  assert.deepEqual(
    categories.map((entry) => [
      entry.category,
      entry.unlockedCount,
      entry.totalDefinitions,
    ]),
    [
      ["Discovery", 0, 4],
      ["Collector", 0, 3],
      ["Progression", 0, 4],
      ["Rare Hunter", 0, 2],
    ]
  );
});

test("summarizeJournal includes next milestone progress math", () => {
  const summary = summarizeJournal(
    {
      unlocked: {
        "discovery-first-capture": {
          key: "discovery-first-capture",
          category: "Discovery",
          title: "First Field Note",
          unlockedAt: "2026-06-08T12:00:00.000Z",
        },
      },
    },
    {
      userRecord: {
        captures: 8,
        level: 4,
      },
      ownedPals: [
        { name: "Lamball", rarity: "common" },
        { name: "Cattiva", rarity: "common" },
        { name: "Direhowl", rarity: "rare" },
      ],
    }
  );

  assert.equal(summary.unlockedCount, 1);
  assert.equal(summary.totalDefinitions, journalDefinitions.length);
  assert.equal(summary.completionPercentage, Number(((1 / journalDefinitions.length) * 100).toFixed(1)));
  assert.equal(summary.nextMilestones[0].key, "progression-level-5");
  assert.equal(summary.nextMilestones[0].value, 4);
  assert.equal(summary.nextMilestones[0].target, 5);
  assert.equal(summary.nextMilestones[0].remaining, 1);
  assert.equal(summary.nextMilestones[0].progressPercentage, 80);
});

test("getNextJournalMilestones ranks closest locked milestones", () => {
  const nextMilestones = getNextJournalMilestones({
    userRecord: {
      captures: 9,
      level: 9,
    },
    ownedPals: Array.from({ length: 9 }, (_value, index) => ({
      name: `Pal ${index + 1}`,
      rarity: "common",
    })),
    journal: {
      unlocked: {
        "discovery-first-capture": {
          key: "discovery-first-capture",
          category: "Discovery",
          title: "First Field Note",
          unlockedAt: "2026-06-08T12:00:00.000Z",
        },
      },
    },
    limit: 3,
  });

  assert.deepEqual(
    nextMilestones.map((milestone) => milestone.key),
    ["discovery-10-captures", "collector-10-species", "progression-level-10"]
  );
});

test("rare, progression, and collection thresholds evaluate independently", () => {
  const result = evaluateJournal({
    userRecord: {
      captures: 49,
      level: 25,
    },
    ownedPals: [
      ...Array.from({ length: 24 }, (_value, index) => ({
        name: `Common ${index + 1}`,
        rarity: "common",
      })),
      { name: "Rare 1", rarity: "rare" },
      { name: "Rare 2", rarity: "rare" },
      { name: "Rare 3", rarity: "rare" },
      { name: "Rare 4", rarity: "rare" },
      { name: "Rare 5", rarity: "rare" },
      { name: "Rare 6", rarity: "rare" },
      { name: "Rare 7", rarity: "rare" },
      { name: "Rare 8", rarity: "rare" },
      { name: "Rare 9", rarity: "rare" },
      { name: "Rare 10", rarity: "rare" },
    ],
    journal: normalizeJournal(null),
    now: new Date("2026-06-08T12:00:00.000Z"),
  });
  const unlockedKeys = Object.keys(result.journal.unlocked);

  assert.ok(unlockedKeys.includes("progression-level-25"));
  assert.ok(unlockedKeys.includes("collector-25-species"));
  assert.ok(unlockedKeys.includes("rare-hunter-10-rare"));
  assert.equal(unlockedKeys.includes("discovery-50-captures"), false);
});
