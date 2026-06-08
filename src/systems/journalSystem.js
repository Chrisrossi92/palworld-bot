const journalDefinitions = [
  {
    key: "discovery-first-capture",
    category: "Discovery",
    title: "First Field Note",
    description: "Capture your first Pal.",
    metric: "captures",
    target: 1,
  },
  {
    key: "discovery-10-captures",
    category: "Discovery",
    title: "Trail Familiar",
    description: "Reach 10 successful captures.",
    metric: "captures",
    target: 10,
  },
  {
    key: "discovery-50-captures",
    category: "Discovery",
    title: "Expedition Regular",
    description: "Reach 50 successful captures.",
    metric: "captures",
    target: 50,
  },
  {
    key: "discovery-100-captures",
    category: "Discovery",
    title: "Field Researcher",
    description: "Reach 100 successful captures.",
    metric: "captures",
    target: 100,
  },
  {
    key: "collector-10-species",
    category: "Collector",
    title: "Growing Paldeck",
    description: "Own 10 unique Pal species.",
    metric: "uniqueSpecies",
    target: 10,
  },
  {
    key: "collector-25-species",
    category: "Collector",
    title: "Catalog Keeper",
    description: "Own 25 unique Pal species.",
    metric: "uniqueSpecies",
    target: 25,
  },
  {
    key: "collector-50-species",
    category: "Collector",
    title: "Paldeck Archivist",
    description: "Own 50 unique Pal species.",
    metric: "uniqueSpecies",
    target: 50,
  },
  {
    key: "progression-level-5",
    category: "Progression",
    title: "Rookie No More",
    description: "Reach trainer level 5.",
    metric: "level",
    target: 5,
  },
  {
    key: "progression-level-10",
    category: "Progression",
    title: "Steady Climber",
    description: "Reach trainer level 10.",
    metric: "level",
    target: 10,
  },
  {
    key: "progression-level-25",
    category: "Progression",
    title: "Seasoned Tamer",
    description: "Reach trainer level 25.",
    metric: "level",
    target: 25,
  },
  {
    key: "progression-level-50",
    category: "Progression",
    title: "Veteran Tamer",
    description: "Reach trainer level 50.",
    metric: "level",
    target: 50,
  },
  {
    key: "rare-hunter-first-rare",
    category: "Rare Hunter",
    title: "Rare Sighting",
    description: "Capture your first rare, epic, or legendary Pal.",
    metric: "rareCaptures",
    target: 1,
  },
  {
    key: "rare-hunter-10-rare",
    category: "Rare Hunter",
    title: "Rare Hunter",
    description: "Own 10 rare, epic, or legendary Pal species.",
    metric: "rareCaptures",
    target: 10,
  },
];

const journalDefinitionsByKey = new Map(
  journalDefinitions.map((definition) => [definition.key, definition])
);

const metricLabels = {
  captures: "captures",
  uniqueSpecies: "unique species",
  level: "trainer level",
  rareCaptures: "rare Pals",
};

function isRarePal(pal) {
  return ["rare", "epic", "legendary"].includes(String(pal?.rarity || "").toLowerCase());
}

function normalizeJournal(existingJournal) {
  const unlocked = existingJournal && existingJournal.unlocked;
  const normalizedUnlocked = {};

  if (unlocked && typeof unlocked === "object" && !Array.isArray(unlocked)) {
    for (const [key, entry] of Object.entries(unlocked)) {
      if (!journalDefinitionsByKey.has(key)) {
        continue;
      }

      const definition = journalDefinitionsByKey.get(key);
      const unlockedAt =
        entry && typeof entry.unlockedAt === "string"
          ? entry.unlockedAt
          : new Date(0).toISOString();

      normalizedUnlocked[key] = {
        key,
        category: definition.category,
        title: definition.title,
        unlockedAt,
      };
    }
  }

  return {
    unlocked: normalizedUnlocked,
  };
}

function buildJournalMetrics(userRecord, ownedPals) {
  const pals = Array.isArray(ownedPals) ? ownedPals : [];

  return {
    captures: Number.isInteger(userRecord?.captures) ? userRecord.captures : 0,
    uniqueSpecies: new Set(
      pals
        .filter((pal) => pal && typeof pal.name === "string")
        .map((pal) => pal.name)
    ).size,
    level: Number.isInteger(userRecord?.level) ? userRecord.level : 1,
    rareCaptures: pals.filter(isRarePal).length,
  };
}

function evaluateJournal({ userRecord, ownedPals, journal, now = new Date() }) {
  const normalizedJournal = normalizeJournal(journal);
  const metrics = buildJournalMetrics(userRecord, ownedPals);
  const newlyUnlocked = [];
  const unlockedAt = now.toISOString();

  for (const definition of journalDefinitions) {
    if (normalizedJournal.unlocked[definition.key]) {
      continue;
    }

    const value = metrics[definition.metric] || 0;

    if (value < definition.target) {
      continue;
    }

    const entry = {
      key: definition.key,
      category: definition.category,
      title: definition.title,
      unlockedAt,
    };

    normalizedJournal.unlocked[definition.key] = entry;
    newlyUnlocked.push({
      ...entry,
      description: definition.description,
      target: definition.target,
      metric: definition.metric,
      value,
    });
  }

  return {
    journal: normalizedJournal,
    metrics,
    newlyUnlocked,
    totalDefinitions: journalDefinitions.length,
    unlockedCount: Object.keys(normalizedJournal.unlocked).length,
  };
}

function getNextJournalMilestones({
  userRecord,
  ownedPals,
  journal,
  limit = 3,
}) {
  const normalizedJournal = normalizeJournal(journal);
  const metrics = buildJournalMetrics(userRecord, ownedPals);

  return journalDefinitions
    .filter((definition) => !normalizedJournal.unlocked[definition.key])
    .map((definition) => {
      const value = metrics[definition.metric] || 0;
      const remaining = Math.max(0, definition.target - value);
      const progressPercentage = definition.target > 0
        ? Math.min(100, Number(((value / definition.target) * 100).toFixed(1)))
        : 0;

      return {
        key: definition.key,
        category: definition.category,
        title: definition.title,
        description: definition.description,
        metric: definition.metric,
        metricLabel: metricLabels[definition.metric] || definition.metric,
        value,
        target: definition.target,
        remaining,
        progressPercentage,
      };
    })
    .filter((milestone) => milestone.remaining > 0)
    .sort((first, second) => {
      if (second.progressPercentage !== first.progressPercentage) {
        return second.progressPercentage - first.progressPercentage;
      }

      if (first.remaining !== second.remaining) {
        return first.remaining - second.remaining;
      }

      return first.target - second.target;
    })
    .slice(0, limit);
}

function summarizeJournal(journal, options = {}) {
  const normalizedJournal = normalizeJournal(journal);
  const unlockedEntries = Object.values(normalizedJournal.unlocked)
    .sort((first, second) => {
      const firstTime = new Date(first.unlockedAt).getTime();
      const secondTime = new Date(second.unlockedAt).getTime();

      return (Number.isNaN(secondTime) ? 0 : secondTime) -
        (Number.isNaN(firstTime) ? 0 : firstTime);
    });

  const unlockedCount = unlockedEntries.length;
  const totalDefinitions = journalDefinitions.length;

  return {
    completionPercentage: totalDefinitions > 0
      ? Number(((unlockedCount / totalDefinitions) * 100).toFixed(1))
      : 0,
    nextMilestones: getNextJournalMilestones({
      userRecord: options.userRecord,
      ownedPals: options.ownedPals,
      journal: normalizedJournal,
      limit: options.nextMilestoneLimit || 3,
    }),
    unlockedCount: unlockedEntries.length,
    totalDefinitions,
    recentUnlocks: unlockedEntries.slice(0, 3),
  };
}

module.exports = {
  buildJournalMetrics,
  evaluateJournal,
  getNextJournalMilestones,
  journalDefinitions,
  normalizeJournal,
  summarizeJournal,
};
