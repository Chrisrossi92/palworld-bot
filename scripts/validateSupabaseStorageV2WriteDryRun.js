#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const { Pool } = require("pg");
const { createSupabaseStorageV2 } = require("../src/storage/supabaseStorageV2");

const TEST_GUILD_ID = "storage-v2-test-guild";
const TEST_USER_ID = "storage-v2-test-user";
const TEST_PAL_NAME = "Storage V2 Test Pal";
const TEST_PAL_SLUG = "storage-v2-test-pal";
const REQUIRED_SPHERES = ["basic", "mega", "giga", "hyper", "ultra", "legendary"];

function normalizeDailyQuests(existingDailyQuests) {
  return {
    date: existingDailyQuests && existingDailyQuests.date
      ? existingDailyQuests.date
      : "2026-05-29",
    captureAttempts: existingDailyQuests && Number.isInteger(existingDailyQuests.captureAttempts)
      ? existingDailyQuests.captureAttempts
      : 0,
    successfulCaptures:
      existingDailyQuests && Number.isInteger(existingDailyQuests.successfulCaptures)
        ? existingDailyQuests.successfulCaptures
        : 0,
    claimed: Boolean(existingDailyQuests && existingDailyQuests.claimed),
  };
}

function normalizeUserRecord(existingUser) {
  const spheres = existingUser && existingUser.spheres && typeof existingUser.spheres === "object"
    ? existingUser.spheres
    : {};

  return {
    xp: existingUser && Number.isInteger(existingUser.xp) ? existingUser.xp : 0,
    coins: existingUser && Number.isInteger(existingUser.coins) ? existingUser.coins : 100,
    level: existingUser && Number.isInteger(existingUser.level) ? existingUser.level : 1,
    captures: existingUser && Number.isInteger(existingUser.captures) ? existingUser.captures : 0,
    streak: existingUser && Number.isInteger(existingUser.streak) ? existingUser.streak : 0,
    failedCaptures:
      existingUser && Number.isInteger(existingUser.failedCaptures)
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
    starterClaimed: Boolean(existingUser && existingUser.starterClaimed),
    dailyQuests: normalizeDailyQuests(existingUser && existingUser.dailyQuests),
    spheres: Object.fromEntries(
      REQUIRED_SPHERES.map((sphere) => [
        sphere,
        Number.isInteger(spheres[sphere]) ? spheres[sphere] : 0,
      ])
    ),
  };
}

function normalizeUserPals(userPals) {
  return Array.isArray(userPals)
    ? userPals.filter((pal) => pal && typeof pal.name === "string")
    : [];
}

function assertEqual(label, actual, expected, failures) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  const status = passed ? "PASS" : "FAIL";

  console.log(`${status} ${label}`);
  console.log(`  actual: ${JSON.stringify(actual)}`);
  console.log(`  expected: ${JSON.stringify(expected)}`);

  if (!passed) {
    failures.push(label);
  }
}

async function cleanup(pool) {
  await pool.query("begin");
  try {
    await pool.query("delete from public.discord_guilds where discord_guild_id = $1", [
      TEST_GUILD_ID,
    ]);
    await pool.query("delete from public.discord_users where discord_user_id = $1", [
      TEST_USER_ID,
    ]);
    await pool.query("delete from public.pal_catalog where slug = $1", [TEST_PAL_SLUG]);
    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }
}

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("Supabase V2 write validation requires SUPABASE_DB_URL.");
  }

  const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });
  const storage = createSupabaseStorageV2({
    defaultPalCatalog: [],
    normalizeUserRecord,
    normalizeUserPals,
    pool,
  });
  const failures = [];

  console.log("Supabase Storage V2 write validation");
  console.log(`Test guild: ${TEST_GUILD_ID}`);
  console.log(`Test user: ${TEST_USER_ID}`);
  console.log("Real imported guild/user IDs are not touched.");
  console.log("Cleanup is limited to the synthetic guild, user, and Pal slug.");
  console.log("Secrets are not logged.");
  console.log("");

  try {
    await cleanup(pool);

    await storage.writeUsers({
      [TEST_GUILD_ID]: {
        [TEST_USER_ID]: {
          xp: 42,
          coins: 321,
          level: 7,
          captures: 3,
          failedCaptures: 2,
          streak: 1,
          starterClaimed: true,
          lastDailyAt: "2026-05-28T12:00:00.000Z",
          dailyQuests: {
            date: "2026-05-29",
            captureAttempts: 2,
            successfulCaptures: 1,
            claimed: false,
          },
          spheres: {
            basic: 9,
            mega: 8,
            giga: 7,
            hyper: 6,
            ultra: 5,
            legendary: 4,
          },
        },
      },
    });

    await storage.updateGuildPlayerRecord(TEST_GUILD_ID, TEST_USER_ID, (player) => {
      player.xp += 8;
      player.coins += 9;
      player.level = 8;
      return { updated: true };
    });

    await storage.updateSphereInventory(TEST_GUILD_ID, TEST_USER_ID, (spheres) => {
      spheres.basic = 11;
      spheres.legendary = 1;
    });

    await storage.updateDailyQuestState(TEST_GUILD_ID, TEST_USER_ID, (dailyQuests) => {
      dailyQuests.captureAttempts = 3;
      dailyQuests.successfulCaptures = 1;
      dailyQuests.claimed = true;
    });

    await storage.writeUserPals({
      [TEST_GUILD_ID]: {
        [TEST_USER_ID]: [
          {
            name: TEST_PAL_NAME,
            level: 5,
            rarity: "common",
            isShiny: true,
            imageUrl: "",
            caughtAt: "2026-05-29T10:00:00.000Z",
            stars: 1,
            essence: 2,
            extraEssence: 0,
          },
        ],
      },
    });

    await storage.updateGuildOwnedPals(TEST_GUILD_ID, TEST_USER_ID, (ownedPals) => {
      const testPal = ownedPals.find((pal) => pal.name === TEST_PAL_NAME);
      if (testPal) {
        testPal.level = 6;
        testPal.essence = 3;
        testPal.extraEssence = 0;
        testPal.stars = 1;
      }
    });

    const player = await storage.getGuildPlayerRecord(TEST_GUILD_ID, TEST_USER_ID);
    const inventory = await storage.getSphereInventory(TEST_GUILD_ID, TEST_USER_ID);
    const dailyQuest = await storage.getDailyQuestState(TEST_GUILD_ID, TEST_USER_ID);
    const ownedPals = await storage.getGuildOwnedPals(TEST_GUILD_ID, TEST_USER_ID);

    assertEqual("player xp", player.xp, 50, failures);
    assertEqual("player coins", player.coins, 330, failures);
    assertEqual("player level", player.level, 8, failures);
    assertEqual("basic spheres", inventory.basic, 11, failures);
    assertEqual("legendary spheres", inventory.legendary, 1, failures);
    assertEqual("daily quest claimed", dailyQuest.claimed, true, failures);
    assertEqual("daily quest attempts", dailyQuest.captureAttempts, 3, failures);
    assertEqual("owned Pal count", ownedPals.length, 1, failures);
    assertEqual("owned Pal name", ownedPals[0] && ownedPals[0].name, TEST_PAL_NAME, failures);
    assertEqual("owned Pal level", ownedPals[0] && ownedPals[0].level, 6, failures);

    if (failures.length > 0) {
      console.error("");
      console.error(`Supabase V2 write validation failed: ${failures.join(", ")}`);
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("Supabase V2 write validation passed.");
  } finally {
    await cleanup(pool);
    await storage.close();
  }
}

main().catch((error) => {
  console.error(`[validateSupabaseStorageV2WriteDryRun] ${error.message}`);
  process.exitCode = 1;
});
