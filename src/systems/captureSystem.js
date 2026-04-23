const fs = require("fs");
const path = require("path");

const USER_PALS_DATA_PATH = path.join(__dirname, "../../data/user-pals.json");
const USERS_DATA_PATH = path.join(__dirname, "../../data/users.json");

const palPool = [
  { name: "Lamball", rarity: "common", weight: 30 },
  { name: "Cattiva", rarity: "common", weight: 30 },
  { name: "Chikipi", rarity: "common", weight: 30 },
  { name: "Foxparks", rarity: "uncommon", weight: 18 },
  { name: "Pengullet", rarity: "uncommon", weight: 18 },
  { name: "Direhowl", rarity: "rare", weight: 10 },
  { name: "Anubis", rarity: "epic", weight: 4 },
  { name: "Jetragon", rarity: "legendary", weight: 1 },
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

function readUserPals() {
  return readJsonFile(USER_PALS_DATA_PATH, "user pals");
}

function writeUserPals(data) {
  writeJsonFile(USER_PALS_DATA_PATH, data);
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

function chooseRandomPal() {
  const rarity = chooseWeightedRarity();
  const rarityPool = palPool.filter((pal) => pal.rarity === rarity);

  if (rarityPool.length === 0) {
    return palPool[0];
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

    userPals[userId].push(pal);
    writeUserPals(userPals);
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
  const coinsGained = success ? 20 : 5;

  if (success) {
    userRecord.captures += 1;
  } else {
    userRecord.failedCaptures += 1;
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

function attemptCapture(userId, sphere = "basic") {
  try {
    const encounteredPal = chooseRandomPal();
    const level = randomInt(1, 50);
    const normalizedSphere = Object.prototype.hasOwnProperty.call(
      sphereBonus,
      sphere
    )
      ? sphere
      : "basic";
    const captureChance = calculateCaptureChance(
      encounteredPal.rarity,
      level,
      normalizedSphere
    );
    const success = Math.random() * 100 < captureChance;

    const pal = {
      name: encounteredPal.name,
      level,
      rarity: encounteredPal.rarity,
      caughtAt: new Date().toISOString(),
    };

    if (success) {
      saveCapturedPal(userId, pal);
    }

    const progression = updateUserProgress(userId, success);

    return {
      pal,
      sphere: normalizedSphere,
      captureChance,
      success,
      progression,
    };
  } catch (error) {
    console.error("[captureSystem] attemptCapture failed:", error);
    throw error;
  }
}

module.exports = {
  attemptCapture,
  claimDailyReward,
  consumeSphere,
  getUserInventory,
  readUserPals,
  readUsers,
};
