const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../../data/user-pals.json");

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

function ensureDataFile() {
  const dirPath = path.dirname(DATA_PATH);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, "{}\n", "utf8");
  }
}

function readUserPals() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8").trim();
    const parsed = raw ? JSON.parse(raw) : {};

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error("Failed to read user pals data. Resetting file.", error);
  }

  fs.writeFileSync(DATA_PATH, "{}\n", "utf8");
  return {};
}

function writeUserPals(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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
  const userPals = readUserPals();

  if (!Array.isArray(userPals[userId])) {
    userPals[userId] = [];
  }

  userPals[userId].push(pal);
  writeUserPals(userPals);
}

function attemptCapture(userId, sphere = "basic") {
  const encounteredPal = chooseRandomPal();
  const level = randomInt(1, 50);
  const normalizedSphere = sphereBonus[sphere] ? sphere : "basic";
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

  return {
    pal,
    sphere: normalizedSphere,
    captureChance,
    success,
  };
}

module.exports = {
  attemptCapture,
};
