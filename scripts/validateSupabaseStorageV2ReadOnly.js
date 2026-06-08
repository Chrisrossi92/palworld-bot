#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const { createSupabaseStorage } = require("../src/storage/supabaseStorage");
const { createSupabaseStorageV2 } = require("../src/storage/supabaseStorageV2");

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
  };

  return {
    v1: createSupabaseStorage(config),
    v2: createSupabaseStorageV2(config),
  };
}

function sortedKeys(value) {
  return Object.keys(value || {}).sort();
}

function compare(label, oldValue, newValue, failures) {
  const passed = JSON.stringify(oldValue) === JSON.stringify(newValue);
  const status = passed ? "PASS" : "FAIL";

  console.log(`${status} ${label}`);
  console.log(`  psql adapter: ${JSON.stringify(oldValue)}`);
  console.log(`  pg adapter: ${JSON.stringify(newValue)}`);

  if (!passed) {
    failures.push(label);
  }
}

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("Supabase V2 read-only validation requires SUPABASE_DB_URL.");
  }

  const storage = createStoragePair();
  const failures = [];

  try {
    const v1PalCatalog = storage.v1.readPalCatalog();
    const v2PalCatalog = await storage.v2.readPalCatalog();
    const v1GuildPlayers = storage.v1.readGuildPlayers(TARGET_GUILD_ID);
    const v2GuildPlayers = await storage.v2.readGuildPlayers(TARGET_GUILD_ID);
    const v1OwnedPals = storage.v1.getGuildOwnedPals(TARGET_GUILD_ID, TARGET_USER_ID);
    const v2OwnedPals = await storage.v2.getGuildOwnedPals(TARGET_GUILD_ID, TARGET_USER_ID);
    const v1Inventory = storage.v1.getSphereInventory(TARGET_GUILD_ID, TARGET_USER_ID);
    const v2Inventory = await storage.v2.getSphereInventory(TARGET_GUILD_ID, TARGET_USER_ID);
    const v1DailyQuest = storage.v1.getDailyQuestState(TARGET_GUILD_ID, TARGET_USER_ID);
    const v2DailyQuest = await storage.v2.getDailyQuestState(TARGET_GUILD_ID, TARGET_USER_ID);
    const v1DailyResearch = storage.v1.getDailyResearchState(TARGET_GUILD_ID, TARGET_USER_ID);
    const v2DailyResearch = await storage.v2.getDailyResearchState(TARGET_GUILD_ID, TARGET_USER_ID);

    console.log("Supabase storage V2 read-only validation");
    console.log("No writes are performed.");
    console.log("Secrets are not logged.");
    console.log("");
    compare("pal catalog count", v1PalCatalog.length, v2PalCatalog.length, failures);
    compare(
      `guild player count for ${TARGET_GUILD_ID}`,
      Object.keys(v1GuildPlayers).length,
      Object.keys(v2GuildPlayers).length,
      failures
    );
    compare(
      `owned pal count for ${TARGET_GUILD_ID}/${TARGET_USER_ID}`,
      v1OwnedPals.length,
      v2OwnedPals.length,
      failures
    );
    compare("sphere inventory keys", sortedKeys(v1Inventory), sortedKeys(v2Inventory), failures);
    compare(
      "sphere inventory key count",
      sortedKeys(v1Inventory).length,
      sortedKeys(v2Inventory).length,
      failures
    );
    compare("daily quest presence", Boolean(v1DailyQuest), Boolean(v2DailyQuest), failures);
    compare("daily research presence", Boolean(v1DailyResearch), Boolean(v2DailyResearch), failures);

    if (failures.length > 0) {
      console.error("");
      console.error(`V2 read-only validation failed: ${failures.join(", ")}`);
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("V2 read-only validation passed.");
  } finally {
    await storage.v2.close();
  }
}

main().catch((error) => {
  console.error(`[validateSupabaseStorageV2ReadOnly] ${error.message}`);
  process.exitCode = 1;
});
