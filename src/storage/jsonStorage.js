const fs = require("fs");
const path = require("path");

const PALS_DATA_PATH = path.join(__dirname, "../../data/pals.json");
const USER_PALS_DATA_PATH = path.join(__dirname, "../../data/user-pals.json");
const USERS_DATA_PATH = path.join(__dirname, "../../data/users.json");
const DEFAULT_LEGACY_GUILD_ID = process.env.DISCORD_GUILD_ID || "__legacy__";

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
    console.error(`Failed to read ${label} data. Refusing to overwrite it.`, error);
    throw error;
  }

  throw new Error(`${label} data must be a JSON object.`);
}

function writeJsonFile(filePath, data) {
  ensureJsonFile(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function isUserRecord(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (
      Object.prototype.hasOwnProperty.call(value, "xp") ||
      Object.prototype.hasOwnProperty.call(value, "coins") ||
      Object.prototype.hasOwnProperty.call(value, "level") ||
      Object.prototype.hasOwnProperty.call(value, "spheres")
    )
  );
}

function isPalList(value) {
  return Array.isArray(value);
}

function normalizeGuildId(guildId, legacyGuildId) {
  return typeof guildId === "string" && guildId.trim()
    ? guildId.trim()
    : legacyGuildId;
}

// JSON remains the runtime backend for now. This module is the storage boundary
// that a Supabase adapter can implement later without changing command modules.
function createJsonStorage({
  defaultPalCatalog,
  normalizeUserRecord,
  normalizeUserPals,
  legacyGuildId = DEFAULT_LEGACY_GUILD_ID,
}) {
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

  function normalizeUsersData(data) {
    const normalized = {};

    for (const [guildOrUserId, value] of Object.entries(data)) {
      if (isUserRecord(value)) {
        if (!normalized[legacyGuildId]) {
          normalized[legacyGuildId] = {};
        }

        normalized[legacyGuildId][guildOrUserId] = normalizeUserRecord(value);
        continue;
      }

      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }

      const guildId = normalizeGuildId(guildOrUserId, legacyGuildId);

      if (!normalized[guildId]) {
        normalized[guildId] = {};
      }

      for (const [userId, user] of Object.entries(value)) {
        if (isUserRecord(user)) {
          normalized[guildId][userId] = normalizeUserRecord(user);
        }
      }
    }

    return normalized;
  }

  function normalizeUserPalsData(data) {
    const normalized = {};

    for (const [guildOrUserId, value] of Object.entries(data)) {
      if (isPalList(value)) {
        if (!normalized[legacyGuildId]) {
          normalized[legacyGuildId] = {};
        }

        normalized[legacyGuildId][guildOrUserId] = normalizeUserPals(value);
        continue;
      }

      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }

      const guildId = normalizeGuildId(guildOrUserId, legacyGuildId);

      if (!normalized[guildId]) {
        normalized[guildId] = {};
      }

      for (const [userId, pals] of Object.entries(value)) {
        normalized[guildId][userId] = normalizeUserPals(pals);
      }
    }

    return normalized;
  }

  function readUsers() {
    const raw = readJsonFile(USERS_DATA_PATH, "users");
    return normalizeUsersData(raw);
  }

  function writeUsers(data) {
    writeJsonFile(USERS_DATA_PATH, normalizeUsersData(data));
  }

  function readUserPals() {
    const raw = readJsonFile(USER_PALS_DATA_PATH, "user pals");
    return normalizeUserPalsData(raw);
  }

  function writeUserPals(data) {
    writeJsonFile(USER_PALS_DATA_PATH, normalizeUserPalsData(data));
  }

  function getGuildUsers(users, guildId) {
    const normalizedGuildId = normalizeGuildId(guildId, legacyGuildId);

    if (!users[normalizedGuildId] || typeof users[normalizedGuildId] !== "object") {
      users[normalizedGuildId] = {};
    }

    return users[normalizedGuildId];
  }

  function getGuildUserPals(userPals, guildId) {
    const normalizedGuildId = normalizeGuildId(guildId, legacyGuildId);

    if (!userPals[normalizedGuildId] || typeof userPals[normalizedGuildId] !== "object") {
      userPals[normalizedGuildId] = {};
    }

    return userPals[normalizedGuildId];
  }

  function readGuildPlayers(guildId) {
    return getGuildUsers(readUsers(), guildId);
  }

  function readGuildOwnedPals(guildId) {
    return getGuildUserPals(readUserPals(), guildId);
  }

  function getGuildPlayerRecord(guildId, userId) {
    const users = readUsers();
    const guildUsers = getGuildUsers(users, guildId);

    return normalizeUserRecord(guildUsers[userId]);
  }

  function updateGuildPlayerRecord(guildId, userId, updater) {
    const users = readUsers();
    const guildUsers = getGuildUsers(users, guildId);
    const userRecord = normalizeUserRecord(guildUsers[userId]);
    const result = updater(userRecord);

    guildUsers[userId] = userRecord;
    writeUsers(users);

    return result === undefined ? userRecord : result;
  }

  function getGuildOwnedPals(guildId, userId) {
    const guildUserPals = readGuildOwnedPals(guildId);

    return Array.isArray(guildUserPals[userId]) ? guildUserPals[userId] : [];
  }

  function getSphereInventory(guildId, userId) {
    return {
      ...getGuildPlayerRecord(guildId, userId).spheres,
    };
  }

  function updateSphereInventory(guildId, userId, updater) {
    return updateGuildPlayerRecord(guildId, userId, (userRecord) =>
      updater(userRecord.spheres, userRecord)
    );
  }

  function getDailyQuestState(guildId, userId) {
    return {
      ...getGuildPlayerRecord(guildId, userId).dailyQuests,
    };
  }

  function updateDailyQuestState(guildId, userId, updater) {
    return updateGuildPlayerRecord(guildId, userId, (userRecord) =>
      updater(userRecord.dailyQuests, userRecord)
    );
  }

  function updateGuildOwnedPals(guildId, userId, updater) {
    const userPals = readUserPals();
    const guildUserPals = getGuildUserPals(userPals, guildId);

    if (!Array.isArray(guildUserPals[userId])) {
      guildUserPals[userId] = [];
    }

    const result = updater(guildUserPals[userId]);
    writeUserPals(userPals);

    return result === undefined ? guildUserPals[userId] : result;
  }

  return {
    getDailyQuestState,
    getGuildOwnedPals,
    getGuildPlayerRecord,
    getSphereInventory,
    readGuildOwnedPals,
    readGuildPlayers,
    readPalCatalog,
    readUserPals,
    readUsers,
    updateDailyQuestState,
    updateGuildOwnedPals,
    updateGuildPlayerRecord,
    updateSphereInventory,
    writeUserPals,
    writeUsers,
  };
}

module.exports = {
  createJsonStorage,
};
