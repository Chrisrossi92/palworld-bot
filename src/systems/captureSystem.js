const { createStorage } = require("../storage");
const {
  claimDailyResearchState,
  getDailyResearchStatus: buildDailyResearchStatus,
  incrementDailyResearchProgress,
  normalizeDailyResearchState,
} = require("./dailyResearchSystem");
const {
  evaluateJournal,
  normalizeJournal,
  summarizeJournal,
} = require("./journalSystem");
const { buildPaldeckSummary } = require("./paldeckSystem");
const {
  getUtcWeekStartDate,
  getWeeklyServerGoalStatus: buildWeeklyServerGoalStatus,
  incrementWeeklyServerGoalProgress,
  weeklyServerGoalDefinition,
} = require("./weeklyServerGoalSystem");

const MAX_LEVEL = 70;

const defaultPalCatalog = [
  { name: "Lamball", rarity: "common", unlockLevel: 1 },
  { name: "Cattiva", rarity: "common", unlockLevel: 1 },
  { name: "Chikipi", rarity: "common", unlockLevel: 1 },
  { name: "Foxparks", rarity: "uncommon", unlockLevel: 5 },
  { name: "Pengullet", rarity: "uncommon", unlockLevel: 8 },
  { name: "Direhowl", rarity: "rare", unlockLevel: 15 },
  { name: "Anubis", rarity: "epic", unlockLevel: 35 },
  { name: "Jetragon", rarity: "legendary", unlockLevel: 60 },
];

const rarityWeights = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

const rarityBaseChance = {
  common: 70,
  uncommon: 55,
  rare: 40,
  epic: 25,
  legendary: 12,
};

const sphereBonus = {
  basic: 0,
  mega: 8,
  giga: 14,
  hyper: 20,
  ultra: 28,
  legendary: 38,
};

const defaultSphereInventory = {
  basic: 10,
  mega: 3,
  giga: 1,
  hyper: 0,
  ultra: 0,
  legendary: 0,
};

const defaultStartingCoins = 100;
const starterRewards = {
  coins: 250,
  spheres: {
    basic: 10,
    mega: 3,
    giga: 1,
  },
};
const dailyQuestGoals = {
  captureAttempts: 3,
  successfulCaptures: 1,
};
const dailyQuestRewards = {
  coins: 100,
  xp: 50,
  spheres: {
    basic: 3,
    mega: 1,
  },
};
const starThresholds = [2, 5, 10, 20];
const trainerTitleTiers = [
  { minLevel: 1, maxLevel: 5, title: "Rookie Tamer" },
  { minLevel: 6, maxLevel: 15, title: "Junior Tamer" },
  { minLevel: 16, maxLevel: 30, title: "Skilled Tamer" },
  { minLevel: 31, maxLevel: 50, title: "Elite Tamer" },
  { minLevel: 51, maxLevel: MAX_LEVEL, title: "Master Tamer" },
];
const levelUnlocks = [
  { level: 11, message: "Uncommon unlocked" },
  { level: 26, message: "Rare unlocked" },
  { level: 41, message: "Epic unlocked" },
  { level: 61, message: "Legendary unlocked" },
];
const spherePrices = {
  basic: 10,
  mega: 30,
  giga: 75,
  hyper: 150,
  ultra: 300,
  legendary: 750,
};

const storage = createStorage({
  defaultPalCatalog,
  normalizeUserRecord: getDefaultUserRecord,
  normalizeUserPals: consolidateUserPals,
});
const dailyResearchClaimLocks = new Set();

async function readPalCatalog() {
  return await storage.readPalCatalog();
}

async function findPalByName(name) {
  if (!name || typeof name !== "string") {
    return null;
  }

  const palCatalog = await readPalCatalog();
  const normalizedQuery = name.trim().toLowerCase();

  return (
    palCatalog.find((pal) => pal.name.toLowerCase() === normalizedQuery) ||
    palCatalog.find((pal) => pal.name.toLowerCase().includes(normalizedQuery)) ||
    null
  );
}

function getStarCountFromEssence(essence) {
  if (essence >= starThresholds[3]) {
    return 4;
  }

  if (essence >= starThresholds[2]) {
    return 3;
  }

  if (essence >= starThresholds[1]) {
    return 2;
  }

  if (essence >= starThresholds[0]) {
    return 1;
  }

  return 0;
}

function getExtraEssence(essence) {
  return Math.max(0, essence - starThresholds[3]);
}

function getNextStarThreshold(stars) {
  return stars >= 4 ? null : starThresholds[stars];
}

function normalizePalEntry(pal) {
  const essence =
    Number.isInteger(pal.essence) && pal.essence >= 0 ? pal.essence : 0;
  const extraEssence =
    Number.isInteger(pal.extraEssence) && pal.extraEssence >= 0
      ? pal.extraEssence
      : getExtraEssence(essence);
  const normalizedEssence = Math.max(essence, extraEssence);

  return {
    name: pal.name,
    level: Number.isInteger(pal.level) && pal.level > 0 ? pal.level : 1,
    rarity: typeof pal.rarity === "string" ? pal.rarity : "common",
    isShiny: Boolean(pal.isShiny),
    imageUrl: typeof pal.imageUrl === "string" ? pal.imageUrl : "",
    caughtAt:
      typeof pal.caughtAt === "string" ? pal.caughtAt : new Date(0).toISOString(),
    stars: getStarCountFromEssence(normalizedEssence),
    essence: normalizedEssence,
    extraEssence: getExtraEssence(normalizedEssence),
  };
}

function consolidateUserPals(userPals) {
  const byName = new Map();

  for (const pal of Array.isArray(userPals) ? userPals : []) {
    if (!pal || typeof pal.name !== "string") {
      continue;
    }

    const normalized = normalizePalEntry(pal);
    const existing = byName.get(normalized.name);

    if (!existing) {
      byName.set(normalized.name, {
        ...normalized,
        _duplicateCount: 0,
      });
      continue;
    }

    existing._duplicateCount += 1;
    existing.essence += 1 + normalized.essence;
    existing.extraEssence = getExtraEssence(existing.essence);
    existing.stars = getStarCountFromEssence(existing.essence);

    if (normalized.level > existing.level) {
      existing.level = normalized.level;
      existing.rarity = normalized.rarity;
      existing.imageUrl = normalized.imageUrl;
    }

    existing.isShiny = existing.isShiny || normalized.isShiny;

    const existingCaughtAt = new Date(existing.caughtAt).getTime();
    const normalizedCaughtAt = new Date(normalized.caughtAt).getTime();

    if (!Number.isNaN(normalizedCaughtAt) && normalizedCaughtAt > existingCaughtAt) {
      existing.caughtAt = normalized.caughtAt;
    }
  }

  return Array.from(byName.values())
    .map(({ _duplicateCount, ...pal }) => ({
      ...pal,
      isShiny: Boolean(pal.isShiny),
      stars: getStarCountFromEssence(pal.essence),
      extraEssence: getExtraEssence(pal.essence),
    }))
    .sort((a, b) => new Date(b.caughtAt).getTime() - new Date(a.caughtAt).getTime());
}

async function readUserPals() {
  return await storage.readUserPals();
}

async function writeUserPals(data) {
  await storage.writeUserPals(data);
}

async function readUsers() {
  return await storage.readUsers();
}

async function writeUsers(data) {
  await storage.writeUsers(data);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultDailyQuests(existingDailyQuests) {
  const today = getTodayKey();

  if (
    !existingDailyQuests ||
    typeof existingDailyQuests !== "object" ||
    existingDailyQuests.date !== today
  ) {
    return {
      date: today,
      captureAttempts: 0,
      successfulCaptures: 0,
      claimed: false,
    };
  }

  return {
    date: today,
    captureAttempts:
      Number.isInteger(existingDailyQuests.captureAttempts) &&
      existingDailyQuests.captureAttempts >= 0
        ? existingDailyQuests.captureAttempts
        : 0,
    successfulCaptures:
      Number.isInteger(existingDailyQuests.successfulCaptures) &&
      existingDailyQuests.successfulCaptures >= 0
        ? existingDailyQuests.successfulCaptures
        : 0,
    claimed:
      typeof existingDailyQuests.claimed === "boolean"
        ? existingDailyQuests.claimed
        : false,
  };
}

function getDefaultUserRecord(existingUser) {
  const existingSpheres =
    existingUser && existingUser.spheres && typeof existingUser.spheres === "object"
      ? existingUser.spheres
      : {};

  return {
    xp:
      existingUser && Number.isInteger(existingUser.xp) && existingUser.xp >= 0
        ? existingUser.xp
        : 0,
    coins:
      existingUser && Number.isInteger(existingUser.coins) && existingUser.coins >= 0
        ? existingUser.coins
        : defaultStartingCoins,
    level:
      existingUser && Number.isInteger(existingUser.level) && existingUser.level > 0
        ? existingUser.level
        : 1,
    captures:
      existingUser &&
      Number.isInteger(existingUser.captures) &&
      existingUser.captures >= 0
        ? existingUser.captures
        : 0,
    streak:
      existingUser && Number.isInteger(existingUser.streak) && existingUser.streak >= 0
        ? existingUser.streak
        : 0,
    failedCaptures:
      existingUser &&
      Number.isInteger(existingUser.failedCaptures) &&
      existingUser.failedCaptures >= 0
        ? existingUser.failedCaptures
        : 0,
    updatedAt:
      existingUser && typeof existingUser.updatedAt === "string"
        ? existingUser.updatedAt
        : new Date(0).toISOString(),
    lastDailyAt:
      existingUser && typeof existingUser.lastDailyAt === "string"
        ? existingUser.lastDailyAt
        : null,
    starterClaimed:
      existingUser && typeof existingUser.starterClaimed === "boolean"
        ? existingUser.starterClaimed
        : false,
    dailyQuests: getDefaultDailyQuests(
      existingUser && existingUser.dailyQuests
    ),
    dailyResearch:
      existingUser && existingUser.dailyResearch
        ? normalizeDailyResearchState(existingUser.dailyResearch)
        : null,
    journal: normalizeJournal(existingUser && existingUser.journal),
    spheres: {
      basic: Number.isInteger(existingSpheres.basic) && existingSpheres.basic >= 0
        ? existingSpheres.basic
        : defaultSphereInventory.basic,
      mega: Number.isInteger(existingSpheres.mega) && existingSpheres.mega >= 0
        ? existingSpheres.mega
        : defaultSphereInventory.mega,
      giga: Number.isInteger(existingSpheres.giga) && existingSpheres.giga >= 0
        ? existingSpheres.giga
        : defaultSphereInventory.giga,
      hyper: Number.isInteger(existingSpheres.hyper) && existingSpheres.hyper >= 0
        ? existingSpheres.hyper
        : defaultSphereInventory.hyper,
      ultra: Number.isInteger(existingSpheres.ultra) && existingSpheres.ultra >= 0
        ? existingSpheres.ultra
        : defaultSphereInventory.ultra,
      legendary:
        Number.isInteger(existingSpheres.legendary) && existingSpheres.legendary >= 0
          ? existingSpheres.legendary
          : defaultSphereInventory.legendary,
    },
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampLevel(level) {
  return Math.max(1, Math.min(MAX_LEVEL, level));
}

function getTrainerTitle(level) {
  const clampedLevel = clampLevel(level);
  const tier = trainerTitleTiers.find(
    ({ minLevel, maxLevel }) =>
      clampedLevel >= minLevel && clampedLevel <= maxLevel
  );

  return tier ? tier.title : "Rookie Tamer";
}

function getLevelUnlockMessages(oldLevel, newLevel) {
  return levelUnlocks
    .filter(({ level }) => oldLevel < level && newLevel >= level)
    .map(({ message }) => message);
}

function chooseWeightedRarity() {
  const entries = Object.entries(rarityWeights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (const [rarity, weight] of entries) {
    roll -= weight;

    if (roll <= 0) {
      return rarity;
    }
  }

  return "common";
}

function chooseRandomPal(eligiblePals, forcedRarity = null) {
  const rarity = forcedRarity || chooseWeightedRarity();
  const rarityPool = eligiblePals.filter((pal) => pal.rarity === rarity);

  if (rarityPool.length === 0) {
    return eligiblePals[randomInt(0, eligiblePals.length - 1)];
  }

  return rarityPool[randomInt(0, rarityPool.length - 1)];
}

function calculateCaptureChance(rarity, level, sphere) {
  const baseChance = rarityBaseChance[rarity] ?? 20;
  const levelPenalty = Math.floor(level / 4);
  const bonus = sphereBonus[sphere] ?? sphereBonus.basic;
  const finalChance = baseChance - levelPenalty + bonus;

  return Math.max(5, Math.min(95, finalChance));
}

async function saveCapturedPal(guildId, userId, pal) {
  try {
    return await storage.updateGuildOwnedPals(guildId, userId, (ownedPals) => {
      const existingPal = ownedPals.find((entry) => entry.name === pal.name);

      if (!existingPal) {
        const newPal = {
          ...pal,
          isShiny: Boolean(pal.isShiny),
          stars: 0,
          essence: 0,
          extraEssence: 0,
        };

        ownedPals.push(newPal);

        return {
          outcome: "new",
          pal: newPal,
          stars: 0,
          essence: 0,
          extraEssence: 0,
          nextStarThreshold: getNextStarThreshold(0),
          starIncreased: false,
        };
      }

      const previousStars = existingPal.stars ?? getStarCountFromEssence(existingPal.essence ?? 0);

      existingPal.essence = (existingPal.essence ?? 0) + 1;
      existingPal.stars = getStarCountFromEssence(existingPal.essence);
      existingPal.extraEssence = getExtraEssence(existingPal.essence);
      existingPal.caughtAt = pal.caughtAt;
      existingPal.level = Math.max(existingPal.level, pal.level);
      existingPal.rarity = pal.rarity;
      existingPal.isShiny = existingPal.isShiny || Boolean(pal.isShiny);
      existingPal.imageUrl = pal.imageUrl;

      return {
        outcome: "duplicate",
        pal: existingPal,
        stars: existingPal.stars,
        essence: existingPal.essence,
        extraEssence: existingPal.extraEssence,
        nextStarThreshold: getNextStarThreshold(existingPal.stars),
        starIncreased: existingPal.stars > previousStars,
      };
    });
  } catch (error) {
    console.error("[captureSystem] Failed to save captured pal:", error);
    throw error;
  }
}

function applyXpToUserRecord(userRecord, xpGained) {
  const previousLevel = userRecord.level;

  userRecord.xp += xpGained;
  userRecord.level = Math.floor(userRecord.xp / 100) + 1;
  userRecord.updatedAt = new Date().toISOString();
  const leveledUp = userRecord.level > previousLevel;

  return {
    xpGained,
    xp: userRecord.xp,
    coins: userRecord.coins,
    oldLevel: previousLevel,
    level: userRecord.level,
    trainerTitle: getTrainerTitle(userRecord.level),
    unlockMessages: leveledUp
      ? getLevelUnlockMessages(previousLevel, userRecord.level)
      : [],
    captures: userRecord.captures,
    streak: userRecord.streak,
    failedCaptures: userRecord.failedCaptures,
    updatedAt: userRecord.updatedAt,
    lastDailyAt: userRecord.lastDailyAt,
    spheres: { ...userRecord.spheres },
    leveledUp,
  };
}

async function getUserInventory(guildId, userId) {
  return await storage.getSphereInventory(guildId, userId);
}

async function getUserLevel(guildId, userId) {
  const userRecord = await storage.getGuildPlayerRecord(guildId, userId);

  return clampLevel(userRecord.level);
}

async function getUserRecord(guildId, userId) {
  return await storage.getGuildPlayerRecord(guildId, userId);
}

async function getJournalSummary(guildId, userId, ownedPals = null) {
  const userRecord = await storage.getGuildPlayerRecord(guildId, userId);
  const userPals = Array.isArray(ownedPals)
    ? ownedPals
    : await storage.getGuildOwnedPals(guildId, userId);

  return summarizeJournal(userRecord.journal, {
    userRecord,
    ownedPals: userPals,
  });
}

async function getPaldeckSummary(guildId, userId, ownedPals = null, options = {}) {
  const userPals = Array.isArray(ownedPals)
    ? ownedPals
    : await storage.getGuildOwnedPals(guildId, userId);
  const palCatalog = await readPalCatalog();

  return buildPaldeckSummary({
    palCatalog,
    ownedPals: userPals,
    ...options,
  });
}

async function consumeSphere(guildId, userId, sphere) {
  const normalizedSphere = Object.prototype.hasOwnProperty.call(sphereBonus, sphere)
    ? sphere
    : "basic";

  return await storage.updateGuildPlayerRecord(guildId, userId, (userRecord) => {
    const currentCount = userRecord.spheres[normalizedSphere] ?? 0;

    if (currentCount <= 0) {
      return {
        consumed: false,
        sphere: normalizedSphere,
        remaining: 0,
      };
    }

    userRecord.spheres[normalizedSphere] = currentCount - 1;
    userRecord.updatedAt = new Date().toISOString();

    return {
      consumed: true,
      sphere: normalizedSphere,
      remaining: userRecord.spheres[normalizedSphere],
    };
  });
}

async function buySpheres(guildId, userId, sphere, quantity) {
  const normalizedSphere = Object.prototype.hasOwnProperty.call(spherePrices, sphere)
    ? sphere
    : null;

  if (!normalizedSphere) {
    throw new Error(`Invalid sphere type: ${sphere}`);
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`Invalid sphere quantity: ${quantity}`);
  }

  const unitPrice = spherePrices[normalizedSphere];
  const totalCost = unitPrice * quantity;

  return await storage.updateGuildPlayerRecord(guildId, userId, (userRecord) => {
    if (userRecord.coins < totalCost) {
      return {
        success: false,
        sphere: normalizedSphere,
        quantity,
        totalCost,
        coins: userRecord.coins,
        updatedSphereCount: userRecord.spheres[normalizedSphere],
      };
    }

    userRecord.coins -= totalCost;
    userRecord.spheres[normalizedSphere] =
      (userRecord.spheres[normalizedSphere] ?? 0) + quantity;
    userRecord.updatedAt = new Date().toISOString();

    return {
      success: true,
      sphere: normalizedSphere,
      quantity,
      totalCost,
      coins: userRecord.coins,
      updatedSphereCount: userRecord.spheres[normalizedSphere],
    };
  });
}

function generateDailySphereRewards() {
  const rewards = {
    basic: 3,
    mega: 1,
    giga: 0,
    hyper: 0,
    ultra: 0,
    legendary: 0,
  };

  if (Math.random() < 0.4) {
    rewards.giga += 1;
  }

  if (Math.random() < 0.2) {
    rewards.hyper += 1;
  }

  if (Math.random() < 0.08) {
    rewards.ultra += 1;
  }

  if (Math.random() < 0.02) {
    rewards.legendary += 1;
  }

  return rewards;
}

function addSphereRewards(userRecord, rewards) {
  for (const [sphere, amount] of Object.entries(rewards)) {
    if (!Object.prototype.hasOwnProperty.call(userRecord.spheres, sphere)) {
      userRecord.spheres[sphere] = 0;
    }

    userRecord.spheres[sphere] += amount;
  }
}

function isDailyQuestComplete(dailyQuests) {
  return (
    dailyQuests.captureAttempts >= dailyQuestGoals.captureAttempts &&
    dailyQuests.successfulCaptures >= dailyQuestGoals.successfulCaptures
  );
}

function trackDailyQuestProgress(userRecord, success) {
  userRecord.dailyQuests = getDefaultDailyQuests(userRecord.dailyQuests);
  userRecord.dailyQuests.captureAttempts += 1;

  if (success) {
    userRecord.dailyQuests.successfulCaptures += 1;
  }
}

async function updateUserProgress(guildId, userId, success, isShiny = false) {
  return await storage.updateGuildPlayerRecord(guildId, userId, (userRecord) => {
    const xpGained = isShiny
      ? Math.round((success ? 25 : 10) * 1.5)
      : success
        ? 25
        : 10;
    let coinsGained = isShiny
      ? Math.round((success ? 20 : 5) * 1.5)
      : success
        ? 20
        : 5;

    if (success) {
      userRecord.captures += 1;
      userRecord.streak += 1;
    } else {
      userRecord.failedCaptures += 1;
      userRecord.streak = 0;
    }

    if (userRecord.streak >= 3) {
      coinsGained += 10;
    }

    trackDailyQuestProgress(userRecord, success);
    userRecord.coins += coinsGained;
    const progression = applyXpToUserRecord(userRecord, xpGained);

    return {
      ...progression,
      coinsGained,
    };
  });
}

async function incrementDailyResearchAttempt(guildId, userId, success) {
  try {
    return await storage.updateDailyResearchState(guildId, userId, (dailyResearch) =>
      incrementDailyResearchProgress(dailyResearch, 1, {
        eventType: success ? "capture_success" : "capture_attempt",
        guildId,
        userId,
      })
    );
  } catch (error) {
    console.error("[captureSystem] Daily Research progress failed:", error);
    return null;
  }
}

async function incrementWeeklyServerGoalCapture(guildId) {
  try {
    const weekStartDate = getUtcWeekStartDate();

    return await storage.updateWeeklyServerGoalState(
      guildId,
      weekStartDate,
      weeklyServerGoalDefinition.key,
      (weeklyGoal) => incrementWeeklyServerGoalProgress(weeklyGoal)
    );
  } catch (error) {
    console.error("[captureSystem] Weekly server goal progress failed:", error);
    return null;
  }
}

async function getDailyQuestStatus(guildId, userId) {
  const userRecord = await storage.getGuildPlayerRecord(guildId, userId);

  return {
    dailyQuests: { ...userRecord.dailyQuests },
    goals: { ...dailyQuestGoals },
    rewards: {
      coins: dailyQuestRewards.coins,
      xp: dailyQuestRewards.xp,
      spheres: { ...dailyQuestRewards.spheres },
    },
    complete: isDailyQuestComplete(userRecord.dailyQuests),
  };
}

async function getDailyResearchStatus(guildId, userId) {
  const dailyResearch = await storage.getDailyResearchState(guildId, userId);

  return buildDailyResearchStatus(dailyResearch, {
    guildId,
    userId,
  });
}

async function getWeeklyServerGoalStatus(guildId) {
  const weekStartDate = getUtcWeekStartDate();
  const weeklyGoal = await storage.getWeeklyServerGoalState(
    guildId,
    weekStartDate,
    weeklyServerGoalDefinition.key
  );

  return buildWeeklyServerGoalStatus(weeklyGoal);
}

async function claimDailyQuestReward(guildId, userId) {
  return await storage.updateGuildPlayerRecord(guildId, userId, (userRecord) => {
    const complete = isDailyQuestComplete(userRecord.dailyQuests);

    if (!complete || userRecord.dailyQuests.claimed) {
      return {
        claimed: false,
        alreadyClaimed: userRecord.dailyQuests.claimed,
        complete,
        dailyQuests: { ...userRecord.dailyQuests },
        rewards: {
          coins: dailyQuestRewards.coins,
          xp: dailyQuestRewards.xp,
          spheres: { ...dailyQuestRewards.spheres },
        },
        progression: null,
      };
    }

    userRecord.dailyQuests.claimed = true;
    userRecord.coins += dailyQuestRewards.coins;
    addSphereRewards(userRecord, dailyQuestRewards.spheres);
    const progression = applyXpToUserRecord(userRecord, dailyQuestRewards.xp);

    return {
      claimed: true,
      alreadyClaimed: false,
      complete: true,
      dailyQuests: { ...userRecord.dailyQuests },
      rewards: {
        coins: dailyQuestRewards.coins,
        xp: dailyQuestRewards.xp,
        spheres: { ...dailyQuestRewards.spheres },
      },
      progression: {
        ...progression,
        coinsGained: dailyQuestRewards.coins,
      },
    };
  });
}

async function claimDailyResearchReward(guildId, userId) {
  const claimLockKey = `${guildId}:${userId}`;

  if (dailyResearchClaimLocks.has(claimLockKey)) {
    return {
      claimed: false,
      alreadyClaimed: false,
      inProgress: true,
      complete: true,
      state: null,
      rewards: null,
      progression: null,
      message: "Daily Research claim already in progress.",
    };
  }

  dailyResearchClaimLocks.add(claimLockKey);

  try {
    const claimResult = await storage.updateDailyResearchState(
      guildId,
      userId,
      (dailyResearch) => claimDailyResearchState(dailyResearch)
    );

    if (!claimResult.claimed) {
      return {
        ...claimResult,
        progression: null,
      };
    }

    const progression = await storage.updateGuildPlayerRecord(guildId, userId, (userRecord) => {
      userRecord.coins += claimResult.rewards.coins;
      const updatedProgression = applyXpToUserRecord(
        userRecord,
        claimResult.rewards.xp
      );

      return {
        ...updatedProgression,
        coinsGained: claimResult.rewards.coins,
      };
    });

    return {
      ...claimResult,
      progression,
    };
  } finally {
    dailyResearchClaimLocks.delete(claimLockKey);
  }
}

function isSameCalendarDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

async function claimDailyReward(guildId, userId) {
  return await storage.updateGuildPlayerRecord(guildId, userId, (userRecord) => {
    const now = new Date();
    const lastDailyAt = userRecord.lastDailyAt ? new Date(userRecord.lastDailyAt) : null;

    if (lastDailyAt && !Number.isNaN(lastDailyAt.getTime()) && isSameCalendarDay(lastDailyAt, now)) {
      return {
        claimed: false,
        progression: null,
      };
    }

    userRecord.lastDailyAt = now.toISOString();
    const sphereRewards = generateDailySphereRewards();
    addSphereRewards(userRecord, sphereRewards);
    userRecord.coins += 100;
    const progression = applyXpToUserRecord(userRecord, 50);

    return {
      claimed: true,
      progression: {
        ...progression,
        coinsGained: 100,
      },
      sphereRewards,
    };
  });
}

async function claimStarterRewards(guildId, userId) {
  return await storage.updateGuildPlayerRecord(guildId, userId, (userRecord) => {
    if (userRecord.starterClaimed) {
      return {
        claimed: false,
        rewards: starterRewards,
        user: userRecord,
      };
    }

    userRecord.coins += starterRewards.coins;
    addSphereRewards(userRecord, starterRewards.spheres);
    userRecord.starterClaimed = true;
    userRecord.updatedAt = new Date().toISOString();

    return {
      claimed: true,
      rewards: starterRewards,
      user: userRecord,
    };
  });
}

async function evaluateAndPersistJournal(guildId, userId) {
  try {
    const ownedPals = await storage.getGuildOwnedPals(guildId, userId);

    return await storage.updateGuildPlayerRecord(guildId, userId, (userRecord) => {
      const evaluation = evaluateJournal({
        userRecord,
        ownedPals,
        journal: userRecord.journal,
      });

      userRecord.journal = evaluation.journal;

      return evaluation;
    });
  } catch (error) {
    console.error("[captureSystem] Journal evaluation failed:", error);
    return {
      failed: true,
      error: "Journal progress could not be saved for this capture.",
      newlyUnlocked: [],
      unlockedCount: 0,
      totalDefinitions: 0,
    };
  }
}

async function createEncounterForLevel(userLevel, options = {}) {
  const clampedUserLevel = clampLevel(userLevel);
  const palCatalog = await readPalCatalog();
  let eligiblePals = palCatalog.filter(
    (pal) => pal.unlockLevel <= clampedUserLevel
  );

  if (options.forcedPal) {
    eligiblePals = eligiblePals.filter(
      (pal) => pal.name.toLowerCase() === options.forcedPal.name.toLowerCase()
    );
  }

  if (eligiblePals.length === 0) {
    throw new Error("No eligible pals available for encounter generation.");
  }

  const encounteredPal = options.forcedPal
    ? eligiblePals[0]
    : chooseRandomPal(eligiblePals, options.forcedRarity || null);
  const minLevel = Math.max(1, Math.round(clampedUserLevel * 0.6));
  const level = options.includeLevel === false
    ? options.levelLabel || "Scales to trainer"
    : randomInt(minLevel, clampedUserLevel);

  return {
    name: encounteredPal.name,
    level,
    rarity: encounteredPal.rarity,
    isShiny:
      typeof options.forceShiny === "boolean"
        ? options.forceShiny
        : Math.random() < 0.02,
    imageUrl:
      typeof encounteredPal.imageUrl === "string" ? encounteredPal.imageUrl : "",
    unlockLevel: encounteredPal.unlockLevel,
  };
}

async function createEncounter(guildId, userId) {
  const userRecord = await storage.getGuildPlayerRecord(guildId, userId);

  return await createEncounterForLevel(userRecord.level);
}

async function resolveCaptureEncounter(
  guildId,
  userId,
  encounterPal,
  sphere = "basic",
  options = {}
) {
  try {
    const normalizedSphere = Object.prototype.hasOwnProperty.call(
      sphereBonus,
      sphere
    )
      ? sphere
      : "basic";
    const captureChance = calculateCaptureChance(
      encounterPal.rarity,
      encounterPal.level,
      normalizedSphere
    );
    const success = Math.random() * 100 < captureChance;

    const pal = {
      name: encounterPal.name,
      level: encounterPal.level,
      rarity: encounterPal.rarity,
      isShiny: Boolean(encounterPal.isShiny),
      imageUrl:
        typeof encounterPal.imageUrl === "string" ? encounterPal.imageUrl : "",
      caughtAt: new Date().toISOString(),
    };

    if (success) {
      const collectionUpdate = await saveCapturedPal(guildId, userId, pal);
      const progression = await updateUserProgress(
        guildId,
        userId,
        success,
        Boolean(encounterPal.isShiny)
      );
      const dailyResearch = options.trackDailyResearch
        ? await incrementDailyResearchAttempt(guildId, userId, success)
        : null;
      const weeklyServerGoal = options.trackWeeklyServerGoal
        ? await incrementWeeklyServerGoalCapture(guildId)
        : null;
      const journal = await evaluateAndPersistJournal(guildId, userId);

      return {
        pal,
        sphere: normalizedSphere,
        captureChance,
        success,
        progression,
        collectionUpdate,
        dailyResearch,
        weeklyServerGoal,
        journal,
      };
    }

    const progression = await updateUserProgress(
      guildId,
      userId,
      success,
      Boolean(encounterPal.isShiny)
    );
    const dailyResearch = options.trackDailyResearch
      ? await incrementDailyResearchAttempt(guildId, userId, success)
      : null;
    const journal = await evaluateAndPersistJournal(guildId, userId);

    return {
      pal,
      sphere: normalizedSphere,
      captureChance,
      success,
      progression,
      collectionUpdate: null,
      dailyResearch,
      weeklyServerGoal: null,
      journal,
    };
  } catch (error) {
    console.error("[captureSystem] resolveCaptureEncounter failed:", error);
    throw error;
  }
}

async function attemptCapture(guildId, userId, sphere = "basic") {
  const encounter = await createEncounter(guildId, userId);
  return await resolveCaptureEncounter(guildId, userId, encounter, sphere, {
    trackDailyResearch: true,
    trackWeeklyServerGoal: true,
  });
}

module.exports = {
  buySpheres,
  attemptCapture,
  claimDailyReward,
  claimDailyResearchReward,
  claimDailyQuestReward,
  claimStarterRewards,
  consumeSphere,
  createEncounter,
  createEncounterForLevel,
  findPalByName,
  getUserLevel,
  getUserInventory,
  getUserRecord,
  getJournalSummary,
  getPaldeckSummary,
  getDailyResearchStatus,
  getWeeklyServerGoalStatus,
  getTrainerTitle,
  getDailyQuestStatus,
  MAX_LEVEL,
  readPalCatalog,
  readUserPals,
  readUsers,
  resolveCaptureEncounter,
  spherePrices,
};
