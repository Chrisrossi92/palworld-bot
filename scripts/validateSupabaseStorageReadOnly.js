#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const { createJsonStorage } = require("../src/storage/jsonStorage");
const { createSupabaseStorage } = require("../src/storage/supabaseStorage");

const TARGET_GUILD_ID = "1323324192627888339";
const TARGET_USER_ID = "412831842304000030";
const REQUIRED_SPHERES = ["basic", "mega", "giga", "hyper", "ultra", "legendary"];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDailyQuests(existingDailyQuests) {
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

function normalizeUserRecord(existingUser) {
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
        : 100,
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
    dailyQuests: normalizeDailyQuests(existingUser && existingUser.dailyQuests),
    spheres: Object.fromEntries(
      REQUIRED_SPHERES.map((sphere) => [
        sphere,
        Number.isInteger(existingSpheres[sphere]) && existingSpheres[sphere] >= 0
          ? existingSpheres[sphere]
          : 0,
      ])
    ),
  };
}

function normalizeUserPals(userPals) {
  return Array.isArray(userPals)
    ? userPals.filter((pal) => pal && typeof pal.name === "string")
    : [];
}

function createStoragePair() {
  const config = {
    defaultPalCatalog: [],
    normalizeUserRecord,
    normalizeUserPals,
    legacyGuildId: process.env.DISCORD_GUILD_ID || "__legacy__",
  };

  return {
    json: createJsonStorage(config),
    supabase: createSupabaseStorage(config),
  };
}

function sortedKeys(value) {
  return Object.keys(value || {}).sort();
}

function compare(label, jsonValue, supabaseValue, failures) {
  const passed = JSON.stringify(jsonValue) === JSON.stringify(supabaseValue);
  const status = passed ? "PASS" : "FAIL";

  console.log(`${status} ${label}`);
  console.log(`  json: ${JSON.stringify(jsonValue)}`);
  console.log(`  supabase: ${JSON.stringify(supabaseValue)}`);

  if (!passed) {
    failures.push(label);
  }
}

function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("Read-only Supabase validation requires SUPABASE_DB_URL.");
  }

  const storage = createStoragePair();
  const failures = [];
  const jsonPalCatalog = storage.json.readPalCatalog();
  const supabasePalCatalog = storage.supabase.readPalCatalog();
  const jsonGuildPlayers = storage.json.readGuildPlayers(TARGET_GUILD_ID);
  const supabaseGuildPlayers = storage.supabase.readGuildPlayers(TARGET_GUILD_ID);
  const jsonOwnedPals = storage.json.getGuildOwnedPals(TARGET_GUILD_ID, TARGET_USER_ID);
  const supabaseOwnedPals = storage.supabase.getGuildOwnedPals(
    TARGET_GUILD_ID,
    TARGET_USER_ID
  );
  const jsonInventory = storage.json.getSphereInventory(TARGET_GUILD_ID, TARGET_USER_ID);
  const supabaseInventory = storage.supabase.getSphereInventory(
    TARGET_GUILD_ID,
    TARGET_USER_ID
  );
  const jsonDailyQuest = storage.json.getDailyQuestState(TARGET_GUILD_ID, TARGET_USER_ID);
  const supabaseDailyQuest = storage.supabase.getDailyQuestState(
    TARGET_GUILD_ID,
    TARGET_USER_ID
  );

  console.log("Supabase storage read-only validation");
  console.log("No writes are performed.");
  console.log("Secrets are not logged.");
  console.log("");
  compare("pal catalog count", jsonPalCatalog.length, supabasePalCatalog.length, failures);
  compare(
    `guild player count for ${TARGET_GUILD_ID}`,
    Object.keys(jsonGuildPlayers).length,
    Object.keys(supabaseGuildPlayers).length,
    failures
  );
  compare(
    `owned pal count for ${TARGET_GUILD_ID}/${TARGET_USER_ID}`,
    jsonOwnedPals.length,
    supabaseOwnedPals.length,
    failures
  );
  compare("sphere inventory keys", sortedKeys(jsonInventory), sortedKeys(supabaseInventory), failures);
  compare(
    "sphere inventory key count",
    sortedKeys(jsonInventory).length,
    sortedKeys(supabaseInventory).length,
    failures
  );
  compare("daily quest presence", Boolean(jsonDailyQuest), Boolean(supabaseDailyQuest), failures);

  if (failures.length > 0) {
    console.error("");
    console.error(`Read-only validation failed: ${failures.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("Read-only validation passed.");
}

try {
  main();
} catch (error) {
  console.error(`[validateSupabaseStorageReadOnly] ${error.message}`);
  process.exitCode = 1;
}
