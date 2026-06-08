const rarityRank = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

const trainerTitleDefinitions = [
  { key: "rookie_tamer", minLevel: 1, maxLevel: 5, label: "Rookie Tamer" },
  { key: "junior_tamer", minLevel: 6, maxLevel: 15, label: "Junior Tamer" },
  { key: "skilled_tamer", minLevel: 16, maxLevel: 30, label: "Skilled Tamer" },
  { key: "elite_tamer", minLevel: 31, maxLevel: 50, label: "Elite Tamer" },
  { key: "master_tamer", minLevel: 51, maxLevel: 70, label: "Master Tamer" },
];

const trainerBackgroundDefinitions = {
  field_journal: {
    key: "field_journal",
    label: "Field Journal",
    primaryColor: "#101820",
    accentColor: "#d6a84f",
  },
};

const trainerFrameDefinitions = {
  standard: {
    key: "standard",
    label: "Standard Frame",
    accentColor: "#d6a84f",
  },
};

function getTrainerTitleDefinition(level) {
  const safeLevel = Number.isInteger(level) && level > 0 ? level : 1;

  return trainerTitleDefinitions.find((definition) =>
    safeLevel >= definition.minLevel && safeLevel <= definition.maxLevel
  ) || trainerTitleDefinitions[0];
}

function normalizeTrainerIdentity(identity = {}) {
  const titleKey = trainerTitleDefinitions.some((definition) =>
    definition.key === identity.titleKey
  )
    ? identity.titleKey
    : null;
  const backgroundKey =
    trainerBackgroundDefinitions[identity.backgroundKey]
      ? identity.backgroundKey
      : "field_journal";
  const frameKey =
    trainerFrameDefinitions[identity.frameKey]
      ? identity.frameKey
      : "standard";

  return {
    titleKey,
    favoritePalName:
      typeof identity.favoritePalName === "string" && identity.favoritePalName.trim()
        ? identity.favoritePalName.trim()
        : null,
    backgroundKey,
    frameKey,
    updatedAt:
      typeof identity.updatedAt === "string" ? identity.updatedAt : null,
  };
}

function getCaughtAtTime(pal) {
  const timestamp = new Date(pal?.caughtAt).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareFavoriteCandidates(a, b) {
  const rankDelta = (rarityRank[b?.rarity] || 0) - (rarityRank[a?.rarity] || 0);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return getCaughtAtTime(b) - getCaughtAtTime(a);
}

function deriveFavoritePal(ownedPals = [], identity = {}) {
  const pals = Array.isArray(ownedPals) ? ownedPals.filter(Boolean) : [];
  const normalizedIdentity = normalizeTrainerIdentity(identity);

  if (normalizedIdentity.favoritePalName) {
    const favorite = pals.find((pal) =>
      String(pal?.name || "").toLowerCase() ===
        normalizedIdentity.favoritePalName.toLowerCase()
    );

    if (favorite) {
      return {
        pal: favorite,
        source: "stored",
      };
    }
  }

  if (pals.length === 0) {
    return {
      pal: null,
      source: "none",
    };
  }

  const sorted = [...pals].sort(compareFavoriteCandidates);

  return {
    pal: sorted[0],
    source: (rarityRank[sorted[0]?.rarity] || 0) > 0 ? "rarest" : "recent",
  };
}

function buildTrainerSummary({
  username,
  userRecord,
  ownedPals,
  paldeckSummary,
  journalSummary,
  trainerIdentity,
} = {}) {
  const safeUserRecord = userRecord || {};
  const level =
    Number.isInteger(safeUserRecord.level) && safeUserRecord.level > 0
      ? safeUserRecord.level
      : 1;
  const identity = normalizeTrainerIdentity(
    trainerIdentity || safeUserRecord.trainerIdentity
  );
  const levelTitle = getTrainerTitleDefinition(level);
  const titleDefinition = identity.titleKey
    ? trainerTitleDefinitions.find((definition) => definition.key === identity.titleKey) ||
      levelTitle
    : levelTitle;
  const favorite = deriveFavoritePal(ownedPals, identity);

  return {
    username: typeof username === "string" && username.trim()
      ? username.trim()
      : "Trainer",
    level,
    title: titleDefinition.label,
    titleKey: titleDefinition.key,
    favoritePal: favorite.pal,
    favoriteSource: favorite.source,
    paldeck: {
      ownedSpeciesCount: Number.isInteger(paldeckSummary?.ownedSpeciesCount)
        ? paldeckSummary.ownedSpeciesCount
        : 0,
      totalSpeciesCount: Number.isInteger(paldeckSummary?.totalSpeciesCount)
        ? paldeckSummary.totalSpeciesCount
        : 0,
      completionPercentage: Number.isFinite(paldeckSummary?.completionPercentage)
        ? paldeckSummary.completionPercentage
        : 0,
    },
    journal: {
      unlockedCount: Number.isInteger(journalSummary?.unlockedCount)
        ? journalSummary.unlockedCount
        : 0,
      totalDefinitions: Number.isInteger(journalSummary?.totalDefinitions)
        ? journalSummary.totalDefinitions
        : 0,
      completionPercentage: Number.isFinite(journalSummary?.completionPercentage)
        ? journalSummary.completionPercentage
        : 0,
    },
    background:
      trainerBackgroundDefinitions[identity.backgroundKey] ||
      trainerBackgroundDefinitions.field_journal,
    frame:
      trainerFrameDefinitions[identity.frameKey] ||
      trainerFrameDefinitions.standard,
  };
}

module.exports = {
  buildTrainerSummary,
  deriveFavoritePal,
  getTrainerTitleDefinition,
  normalizeTrainerIdentity,
  trainerBackgroundDefinitions,
  trainerFrameDefinitions,
  trainerTitleDefinitions,
};
