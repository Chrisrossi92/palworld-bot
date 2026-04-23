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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseRandomPal() {
  const totalWeight = palPool.reduce((sum, pal) => sum + pal.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const pal of palPool) {
    roll -= pal.weight;

    if (roll <= 0) {
      return pal;
    }
  }

  return palPool[0];
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

function updateUserProgress(userId, success) {
  const users = readUsers();
  const existingUser = users[userId];
  const previousLevel =
    existingUser && Number.isInteger(existingUser.level) && existingUser.level > 0
      ? existingUser.level
      : 1;
  const userRecord = {
    xp:
      existingUser && Number.isInteger(existingUser.xp) && existingUser.xp >= 0
        ? existingUser.xp
        : 0,
    level: previousLevel,
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
  };
  const xpGained = success ? 25 : 10;

  userRecord.xp += xpGained;
  userRecord.level = Math.floor(userRecord.xp / 100) + 1;
  userRecord.updatedAt = new Date().toISOString();

  if (success) {
    userRecord.captures += 1;
  } else {
    userRecord.failedCaptures += 1;
  }

  users[userId] = userRecord;
  writeUsers(users);

  return {
    xpGained,
    xp: userRecord.xp,
    level: userRecord.level,
    captures: userRecord.captures,
    failedCaptures: userRecord.failedCaptures,
    updatedAt: userRecord.updatedAt,
    leveledUp: userRecord.level > previousLevel,
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
  readUserPals,
  readUsers,
};
