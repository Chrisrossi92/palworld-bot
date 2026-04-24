const fs = require("fs");
const path = require("path");

const MAX_LEVEL = 70;
const PALS_DATA_PATH = path.join(__dirname, "../../data/pals.json");
const USER_PALS_DATA_PATH = path.join(__dirname, "../../data/user-pals.json");
const USERS_DATA_PATH = path.join(__dirname, "../../data/users.json");

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
const starThresholds = [2, 5, 10, 20];
const spherePrices = {
  basic: 10,
  mega: 30,
  giga: 75,
  hyper: 150,
  ultra: 300,
  legendary: 750,
};

function ensureJsonFile(filePath) {
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "{}\n", "utf8");
  }
}

function readJsonFile(filePath, label) {
  ensureJsonFile(filePath);

  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    const parsed = raw ? JSON.parse(raw) : {};

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error(`Failed to read ${label} data. Resetting file.`, error);
  }

  fs.writeFileSync(filePath, "{}\n", "utf8");
  return {};
}

function writeJsonFile(filePath, data) {
  ensureJsonFile(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readPalCatalog() {
  ensureJsonFile(PALS_DATA_PATH);

  try {
    const raw = fs.readFileSync(PALS_DATA_PATH, "utf8").trim();
    const parsed = raw ? JSON.parse(raw) : defaultPalCatalog;

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (error) {
    console.error("Failed to read pals data. Resetting file.", error);
  }

  fs.writeFileSync(
    PALS_DATA_PATH,
    `${JSON.stringify(defaultPalCatalog, null, 2)}\n`,
    "utf8"
  );
  return defaultPalCatalog;
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

    const existingCaughtAt = new Date(existing.caughtAt).getTime();
    const normalizedCaughtAt = new Date(normalized.caughtAt).getTime();

    if (!Number.isNaN(normalizedCaughtAt) && normalizedCaughtAt > existingCaughtAt) {
      existing.caughtAt = normalized.caughtAt;
    }
  }

  return Array.from(byName.values())
    .map(({ _duplicateCount, ...pal }) => ({
      ...pal,
      stars: getStarCountFromEssence(pal.essence),
      extraEssence: getExtraEssence(pal.essence),
    }))
    .sort((a, b) => new Date(b.caughtAt).getTime() - new Date(a.caughtAt).getTime());
}

function normalizeUserPalsData(data) {
  const normalized = {};

  for (const [userId, pals] of Object.entries(data)) {
    normalized[userId] = consolidateUserPals(pals);
  }

  return normalized;
}

function readUserPals() {
  const raw = readJsonFile(USER_PALS_DATA_PATH, "user pals");
  const normalized = normalizeUserPalsData(raw);

  writeUserPals(normalized);

  return normalized;
}

function writeUserPals(data) {
  writeJsonFile(USER_PALS_DATA_PATH, normalizeUserPalsData(data));
}

function readUsers() {
  return readJsonFile(USERS_DATA_PATH, "users");
}

function writeUsers(data) {
  writeJsonFile(USERS_DATA_PATH, data);
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

function chooseRandomPal(eligiblePals) {
  const rarity = chooseWeightedRarity();
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

function saveCapturedPal(userId, pal) {
  try {
    const userPals = readUserPals();

    if (!Array.isArray(userPals[userId])) {
      userPals[userId] = [];
    }
    const existingPal = userPals[userId].find((entry) => entry.name === pal.name);

    if (!existingPal) {
      const newPal = {
        ...pal,
        stars: 0,
        essence: 0,
        extraEssence: 0,
      };

      userPals[userId].push(newPal);
      writeUserPals(userPals);

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
    existingPal.imageUrl = pal.imageUrl;

    writeUserPals(userPals);

    return {
      outcome: "duplicate",
      pal: existingPal,
      stars: existingPal.stars,
      essence: existingPal.essence,
      extraEssence: existingPal.extraEssence,
      nextStarThreshold: getNextStarThreshold(existingPal.stars),
      starIncreased: existingPal.stars > previousStars,
    };
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

  return {
    xpGained,
    xp: userRecord.xp,
    coins: userRecord.coins,
    level: userRecord.level,
    captures: userRecord.captures,
    streak: userRecord.streak,
    failedCaptures: userRecord.failedCaptures,
    updatedAt: userRecord.updatedAt,
    lastDailyAt: userRecord.lastDailyAt,
    spheres: { ...userRecord.spheres },
    leveledUp: userRecord.level > previousLevel,
  };
}

function getUserInventory(userId) {
  const users = readUsers();
  const userRecord = getDefaultUserRecord(users[userId]);

  users[userId] = userRecord;
  writeUsers(users);

  return {
    ...userRecord.spheres,
  };
}

function getUserLevel(userId) {
  const users = readUsers();
  const userRecord = getDefaultUserRecord(users[userId]);

  users[userId] = userRecord;
  writeUsers(users);

  return clampLevel(userRecord.level);
}

function getUserRecord(userId) {
  const users = readUsers();
  const userRecord = getDefaultUserRecord(users[userId]);

  users[userId] = userRecord;
  writeUsers(users);

  return userRecord;
}

function consumeSphere(userId, sphere) {
  const users = readUsers();
  const userRecord = getDefaultUserRecord(users[userId]);
  const normalizedSphere = Object.prototype.hasOwnProperty.call(sphereBonus, sphere)
    ? sphere
    : "basic";
  const currentCount = userRecord.spheres[normalizedSphere] ?? 0;

  if (currentCount <= 0) {
    users[userId] = userRecord;
    writeUsers(users);

    return {
      consumed: false,
      sphere: normalizedSphere,
      remaining: 0,
    };
  }

  userRecord.spheres[normalizedSphere] = currentCount - 1;
  userRecord.updatedAt = new Date().toISOString();
  users[userId] = userRecord;
  writeUsers(users);

  return {
    consumed: true,
    sphere: normalizedSphere,
    remaining: userRecord.spheres[normalizedSphere],
  };
}

function buySpheres(userId, sphere, quantity) {
  const normalizedSphere = Object.prototype.hasOwnProperty.call(spherePrices, sphere)
    ? sphere
    : null;

  if (!normalizedSphere) {
    throw new Error(`Invalid sphere type: ${sphere}`);
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`Invalid sphere quantity: ${quantity}`);
  }

  const users = readUsers();
  const userRecord = getDefaultUserRecord(users[userId]);
  const unitPrice = spherePrices[normalizedSphere];
  const totalCost = unitPrice * quantity;

  if (userRecord.coins < totalCost) {
    users[userId] = userRecord;
    writeUsers(users);

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
  users[userId] = userRecord;
  writeUsers(users);

  return {
    success: true,
    sphere: normalizedSphere,
    quantity,
    totalCost,
    coins: userRecord.coins,
    updatedSphereCount: userRecord.spheres[normalizedSphere],
  };
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

function updateUserProgress(userId, success) {
  const users = readUsers();
  const userRecord = getDefaultUserRecord(users[userId]);
  const xpGained = success ? 25 : 10;
  let coinsGained = success ? 20 : 5;

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

  userRecord.coins += coinsGained;
  const progression = applyXpToUserRecord(userRecord, xpGained);
  users[userId] = userRecord;
  writeUsers(users);

  return {
    ...progression,
    coinsGained,
  };
}

function isSameCalendarDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function claimDailyReward(userId) {
  const users = readUsers();
  const userRecord = getDefaultUserRecord(users[userId]);
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

  users[userId] = userRecord;
  writeUsers(users);

  return {
    claimed: true,
    progression: {
      ...progression,
      coinsGained: 100,
    },
    sphereRewards,
  };
}

function createEncounterForLevel(userLevel, options = {}) {
  const clampedUserLevel = clampLevel(userLevel);
  const palCatalog = readPalCatalog();
  const eligiblePals = palCatalog.filter(
    (pal) => pal.unlockLevel <= clampedUserLevel
  );

  if (eligiblePals.length === 0) {
    throw new Error("No eligible pals available for encounter generation.");
  }

  const encounteredPal = chooseRandomPal(eligiblePals);
  const minLevel = Math.max(1, Math.round(clampedUserLevel * 0.6));
  const level = options.includeLevel === false
    ? options.levelLabel || "Scales to trainer"
    : randomInt(minLevel, clampedUserLevel);

  return {
    name: encounteredPal.name,
    level,
    rarity: encounteredPal.rarity,
    imageUrl:
      typeof encounteredPal.imageUrl === "string" ? encounteredPal.imageUrl : "",
    unlockLevel: encounteredPal.unlockLevel,
  };
}

function createEncounter(userId) {
  const users = readUsers();
  const userRecord = getDefaultUserRecord(users[userId]);

  return createEncounterForLevel(userRecord.level);
}

function resolveCaptureEncounter(userId, encounterPal, sphere = "basic") {
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
      imageUrl:
        typeof encounterPal.imageUrl === "string" ? encounterPal.imageUrl : "",
      caughtAt: new Date().toISOString(),
    };

    if (success) {
      const collectionUpdate = saveCapturedPal(userId, pal);

      return {
        pal,
        sphere: normalizedSphere,
        captureChance,
        success,
        progression: updateUserProgress(userId, success),
        collectionUpdate,
      };
    }

    return {
      pal,
      sphere: normalizedSphere,
      captureChance,
      success,
      progression: updateUserProgress(userId, success),
      collectionUpdate: null,
    };
  } catch (error) {
    console.error("[captureSystem] resolveCaptureEncounter failed:", error);
    throw error;
  }
}

function attemptCapture(userId, sphere = "basic") {
  const encounter = createEncounter();
  return resolveCaptureEncounter(userId, encounter, sphere);
}

module.exports = {
  buySpheres,
  attemptCapture,
  claimDailyReward,
  consumeSphere,
  createEncounter,
  createEncounterForLevel,
  getUserLevel,
  getUserInventory,
  getUserRecord,
  MAX_LEVEL,
  readUserPals,
  readUsers,
  resolveCaptureEncounter,
  spherePrices,
};
