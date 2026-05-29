#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DATA_DIR = path.join(__dirname, "..", "data");
const PALS_PATH = path.join(DATA_DIR, "pals.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const USER_PALS_PATH = path.join(DATA_DIR, "user-pals.json");
const LEGACY_GUILD_ID = process.env.DISCORD_GUILD_ID || "__legacy__";

const REQUIRED_TABLES = [
  "discord_users",
  "discord_guilds",
  "guild_memberships",
  "guild_settings",
  "pal_catalog",
  "guild_players",
  "player_sphere_inventory",
  "player_owned_pals",
  "capture_history",
  "daily_reward_claims",
  "player_daily_quests",
  "spawn_configs",
  "spawn_events",
  "guild_subscriptions",
  "dashboard_access_grants",
];

function readJsonStrict(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Malformed JSON in ${filePath}: ${error.message}`);
  }
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isUserRecord(value) {
  return (
    isObject(value) &&
    (
      Object.prototype.hasOwnProperty.call(value, "xp") ||
      Object.prototype.hasOwnProperty.call(value, "coins") ||
      Object.prototype.hasOwnProperty.call(value, "level") ||
      Object.prototype.hasOwnProperty.call(value, "spheres")
    )
  );
}

function isPalEntry(value) {
  return isObject(value) && typeof value.name === "string";
}

function assertPalCatalogShape(pals) {
  if (!Array.isArray(pals)) {
    throw new Error("data/pals.json must contain an array.");
  }

  for (const [index, pal] of pals.entries()) {
    if (!isObject(pal) || typeof pal.name !== "string") {
      throw new Error(`data/pals.json entry ${index} must be an object with a name.`);
    }
  }
}

function addGuildBucket(target, guildId) {
  if (!target[guildId]) {
    target[guildId] = {};
  }

  return target[guildId];
}

function analyzeUsers(rawUsers) {
  if (!isObject(rawUsers)) {
    throw new Error("data/users.json must contain an object.");
  }

  const guildUsers = {};
  const legacyUserIds = [];

  for (const [guildOrUserId, value] of Object.entries(rawUsers)) {
    if (isUserRecord(value)) {
      addGuildBucket(guildUsers, LEGACY_GUILD_ID)[guildOrUserId] = value;
      legacyUserIds.push(guildOrUserId);
      continue;
    }

    if (!isObject(value)) {
      throw new Error(
        `data/users.json key ${guildOrUserId} must be a user record or guild object.`
      );
    }

    const bucket = addGuildBucket(guildUsers, guildOrUserId);

    for (const [userId, user] of Object.entries(value)) {
      if (!isUserRecord(user)) {
        throw new Error(
          `data/users.json ${guildOrUserId}.${userId} must be a user record.`
        );
      }

      bucket[userId] = user;
    }
  }

  return {
    guildUsers,
    legacyUserIds,
  };
}

function analyzeUserPals(rawUserPals) {
  if (!isObject(rawUserPals)) {
    throw new Error("data/user-pals.json must contain an object.");
  }

  const guildUserPals = {};
  const legacyUserIds = [];

  for (const [guildOrUserId, value] of Object.entries(rawUserPals)) {
    if (Array.isArray(value)) {
      for (const [index, pal] of value.entries()) {
        if (!isPalEntry(pal)) {
          throw new Error(
            `data/user-pals.json ${guildOrUserId}[${index}] must be a Pal entry.`
          );
        }
      }

      addGuildBucket(guildUserPals, LEGACY_GUILD_ID)[guildOrUserId] = value;
      legacyUserIds.push(guildOrUserId);
      continue;
    }

    if (!isObject(value)) {
      throw new Error(
        `data/user-pals.json key ${guildOrUserId} must be a Pal array or guild object.`
      );
    }

    const bucket = addGuildBucket(guildUserPals, guildOrUserId);

    for (const [userId, pals] of Object.entries(value)) {
      if (!Array.isArray(pals)) {
        throw new Error(
          `data/user-pals.json ${guildOrUserId}.${userId} must be a Pal array.`
        );
      }

      for (const [index, pal] of pals.entries()) {
        if (!isPalEntry(pal)) {
          throw new Error(
            `data/user-pals.json ${guildOrUserId}.${userId}[${index}] must be a Pal entry.`
          );
        }
      }

      bucket[userId] = pals;
    }
  }

  return {
    guildUserPals,
    legacyUserIds,
  };
}

function countPlayers(guildUsers) {
  return Object.values(guildUsers).reduce(
    (total, users) => total + Object.keys(users).length,
    0
  );
}

function countSphereRows(guildUsers) {
  return Object.values(guildUsers).reduce((total, users) => {
    return total + Object.values(users).reduce((userTotal, user) => {
      return userTotal + (isObject(user.spheres) ? Object.keys(user.spheres).length : 0);
    }, 0);
  }, 0);
}

function countDailyQuestRows(guildUsers) {
  return Object.values(guildUsers).reduce((total, users) => {
    return total + Object.values(users).filter((user) => isObject(user.dailyQuests)).length;
  }, 0);
}

function countPalboxOwners(guildUserPals) {
  return Object.values(guildUserPals).reduce(
    (total, userPals) => total + Object.keys(userPals).length,
    0
  );
}

function countOwnedPals(guildUserPals) {
  return Object.values(guildUserPals).reduce((total, userPals) => {
    return total + Object.values(userPals).reduce((palTotal, pals) => {
      return palTotal + pals.length;
    }, 0);
  }, 0);
}

function unionGuildIds(...maps) {
  return new Set(maps.flatMap((map) => Object.keys(map)));
}

function quoteSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlText(value) {
  if (value === undefined || value === null || value === "") {
    return "null";
  }

  return quoteSqlLiteral(value);
}

function sqlJson(value) {
  return `${quoteSqlLiteral(JSON.stringify(value ?? {}))}::jsonb`;
}

function sqlInt(value, fallback = 0) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return String(fallback);
}

function sqlBool(value) {
  return value ? "true" : "false";
}

function sqlTimestamp(value) {
  if (!value) {
    return "null";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "null";
  }

  return `${quoteSqlLiteral(date.toISOString())}::timestamptz`;
}

function sqlDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "null";
  }

  return `${quoteSqlLiteral(value)}::date`;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function runPsql(sql, options = {}) {
  const dbUrl = process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    throw new Error(`${options.mode || "database operation"} requires SUPABASE_DB_URL.`);
  }

  const transaction = options.readOnly
    ? `begin read only;\n${sql}\ncommit;`
    : `begin;\n${sql}\ncommit;`;

  const result = spawnSync(
    "psql",
    [
      dbUrl,
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--field-separator",
      "\t",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      transaction,
    ],
    {
      encoding: "utf8",
      env: process.env,
    }
  );

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error("--check-db requires the psql CLI to be installed and on PATH.");
    }

    throw result.error;
  }

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || "psql command failed.";
    throw new Error(message);
  }

  return result.stdout.trim();
}

function runPsqlReadOnly(sql) {
  return runPsql(sql, { readOnly: true, mode: "--check-db" });
}

function runPsqlWriteTransaction(sql) {
  return runPsql(sql, { readOnly: false, mode: "live import" });
}

function parsePsqlRows(output) {
  if (!output) {
    return [];
  }

  return output.split("\n").map((line) => line.split("\t"));
}

function getTableCounts() {
  const rowCountSql = REQUIRED_TABLES.map((tableName) => {
    return `select ${quoteSqlLiteral(tableName)} as table_name, count(*)::text as row_count from public.${tableName}`;
  }).join("\nunion all\n");

  return parsePsqlRows(runPsqlReadOnly(`${rowCountSql}\norder by table_name;`));
}

function checkDatabase() {
  const tableLiterals = REQUIRED_TABLES.map(quoteSqlLiteral).join(", ");

  const tableRows = parsePsqlRows(runPsqlReadOnly(`
    select
      table_name,
      case when table_name in (${tableLiterals}) then 'required' else 'extra' end as table_kind
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name in (${tableLiterals})
    order by table_name;
  `));

  const existingTables = new Set(tableRows.map(([tableName]) => tableName));
  const missingTables = REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(`Missing required tables: ${missingTables.join(", ")}`);
  }

  const rowCountRows = getTableCounts();

  const rlsRows = parsePsqlRows(runPsqlReadOnly(`
    select
      relname,
      relrowsecurity::text,
      relforcerowsecurity::text
    from pg_class
    where oid in (
      select (${quoteSqlLiteral("public")} || '.' || table_name)::regclass
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name in (${tableLiterals})
    )
    order by relname;
  `));

  console.log("Supabase database preflight");
  console.log("No inserts, updates, or deletes were performed.");
  console.log("Connection string was not logged.");
  console.log("");
  console.log("required tables: present");
  for (const tableName of REQUIRED_TABLES) {
    console.log(`- ${tableName}`);
  }
  console.log("");
  console.log("row counts:");
  for (const [tableName, rowCount] of rowCountRows) {
    console.log(`- ${tableName}: ${rowCount}`);
  }
  console.log("");
  console.log("RLS status:");
  for (const [tableName, rlsEnabled, rlsForced] of rlsRows) {
    console.log(`- ${tableName}: enabled=${rlsEnabled}, forced=${rlsForced}`);
  }
}

function createImportPlan() {
  const pals = readJsonStrict(PALS_PATH);
  const users = readJsonStrict(USERS_PATH);
  const userPals = readJsonStrict(USER_PALS_PATH);

  assertPalCatalogShape(pals);

  const userAnalysis = analyzeUsers(users);
  const userPalsAnalysis = analyzeUserPals(userPals);
  const guildIds = unionGuildIds(
    userAnalysis.guildUsers,
    userPalsAnalysis.guildUserPals
  );
  const legacyUserIds = new Set([
    ...userAnalysis.legacyUserIds,
    ...userPalsAnalysis.legacyUserIds,
  ]);
  const playerPairs = new Set();

  for (const [guildId, guildUsers] of Object.entries(userAnalysis.guildUsers)) {
    for (const userId of Object.keys(guildUsers)) {
      playerPairs.add(`${guildId}\t${userId}`);
    }
  }

  for (const [guildId, guildUserPals] of Object.entries(userPalsAnalysis.guildUserPals)) {
    for (const userId of Object.keys(guildUserPals)) {
      playerPairs.add(`${guildId}\t${userId}`);
    }
  }

  return {
    pals,
    guildUsers: userAnalysis.guildUsers,
    guildUserPals: userPalsAnalysis.guildUserPals,
    guildIds,
    legacyUserIds,
    playerPairs,
  };
}

function printDryRun(plan) {
  console.log("JSON to Supabase import dry-run");
  console.log("No Supabase connection was opened.");
  console.log("No JSON files were modified.");
  console.log("");
  console.log(`legacy flat shape detected: ${plan.legacyUserIds.size > 0 ? "yes" : "no"}`);
  if (plan.legacyUserIds.size > 0) {
    console.log(`legacy guild bucket that would be used: ${LEGACY_GUILD_ID}`);
    console.log(`legacy user ids detected: ${Array.from(plan.legacyUserIds).join(", ")}`);
  }
  console.log("");
  console.log(`pal catalog count: ${plan.pals.length}`);
  console.log(`guild count: ${plan.guildIds.size}`);
  console.log(`player count: ${countPlayers(plan.guildUsers)}`);
  console.log(`palbox owner count: ${countPalboxOwners(plan.guildUserPals)}`);
  console.log(`owned Pal count: ${countOwnedPals(plan.guildUserPals)}`);
  console.log(`sphere inventory rows expected: ${countSphereRows(plan.guildUsers)}`);
  console.log(`daily quest rows expected: ${countDailyQuestRows(plan.guildUsers)}`);
}

function buildImportSql(plan) {
  const statements = [
    "set constraints all immediate;",
  ];

  for (const pal of plan.pals) {
    const slug = slugify(pal.slug || pal.name);

    statements.push(`
      insert into public.pal_catalog (slug, name, rarity, unlock_level, image_url, metadata)
      values (
        ${sqlText(slug)},
        ${sqlText(pal.name)},
        ${sqlText(pal.rarity || "common")},
        ${sqlInt(pal.unlockLevel ?? pal.unlock_level, 1)},
        ${sqlText(pal.imageUrl || pal.image_url)},
        ${sqlJson({ importedFromJson: true })}
      )
      on conflict (slug) do update set
        name = excluded.name,
        rarity = excluded.rarity,
        unlock_level = excluded.unlock_level,
        image_url = excluded.image_url,
        metadata = public.pal_catalog.metadata || excluded.metadata;
    `);
  }

  for (const guildId of plan.guildIds) {
    statements.push(`
      insert into public.discord_guilds (discord_guild_id)
      values (${sqlText(guildId)})
      on conflict (discord_guild_id) do update set
        removed_at = null;
    `);
  }

  const discordUserIds = new Set(
    Array.from(plan.playerPairs).map((pair) => pair.split("\t")[1])
  );

  for (const userId of discordUserIds) {
    statements.push(`
      insert into public.discord_users (discord_user_id)
      values (${sqlText(userId)})
      on conflict (discord_user_id) do nothing;
    `);
  }

  for (const pair of plan.playerPairs) {
    const [guildId, userId] = pair.split("\t");
    const user = plan.guildUsers[guildId]?.[userId] || {};

    statements.push(`
      insert into public.guild_memberships (guild_id, user_id, discord_user_id)
      select guilds.id, users.id, users.discord_user_id
      from public.discord_guilds guilds
      cross join public.discord_users users
      where guilds.discord_guild_id = ${sqlText(guildId)}
        and users.discord_user_id = ${sqlText(userId)}
      on conflict (guild_id, user_id) do update set
        discord_user_id = excluded.discord_user_id;
    `);

    statements.push(`
      insert into public.guild_players (
        guild_id,
        user_id,
        xp,
        coins,
        level,
        captures,
        failed_captures,
        streak,
        starter_claimed,
        last_daily_at
      )
      select
        guilds.id,
        users.id,
        ${sqlInt(user.xp, 0)},
        ${sqlInt(user.coins, 100)},
        ${sqlInt(user.level, 1)},
        ${sqlInt(user.captures, 0)},
        ${sqlInt(user.failedCaptures ?? user.failed_captures, 0)},
        ${sqlInt(user.streak, 0)},
        ${sqlBool(user.starterClaimed ?? user.starter_claimed)},
        ${sqlTimestamp(user.lastDailyAt ?? user.last_daily_at)}
      from public.discord_guilds guilds
      cross join public.discord_users users
      where guilds.discord_guild_id = ${sqlText(guildId)}
        and users.discord_user_id = ${sqlText(userId)}
      on conflict (guild_id, user_id) do update set
        xp = excluded.xp,
        coins = excluded.coins,
        level = excluded.level,
        captures = excluded.captures,
        failed_captures = excluded.failed_captures,
        streak = excluded.streak,
        starter_claimed = excluded.starter_claimed,
        last_daily_at = excluded.last_daily_at;
    `);
  }

  for (const [guildId, guildUsers] of Object.entries(plan.guildUsers)) {
    for (const [userId, user] of Object.entries(guildUsers)) {
      if (isObject(user.spheres)) {
        for (const [sphereType, quantity] of Object.entries(user.spheres)) {
          statements.push(`
            insert into public.player_sphere_inventory (player_id, sphere_type, quantity)
            select players.id, ${sqlText(sphereType)}, ${sqlInt(quantity, 0)}
            from public.guild_players players
            join public.discord_guilds guilds on guilds.id = players.guild_id
            join public.discord_users users on users.id = players.user_id
            where guilds.discord_guild_id = ${sqlText(guildId)}
              and users.discord_user_id = ${sqlText(userId)}
            on conflict (player_id, sphere_type) do update set
              quantity = excluded.quantity;
          `);
        }
      }

      if (isObject(user.dailyQuests)) {
        const quest = user.dailyQuests;
        statements.push(`
          insert into public.player_daily_quests (
            player_id,
            quest_date,
            capture_attempts,
            successful_captures,
            claimed,
            claimed_at,
            reward_coins,
            reward_xp,
            reward_spheres
          )
          select
            players.id,
            ${sqlDate(quest.date)},
            ${sqlInt(quest.captureAttempts ?? quest.capture_attempts, 0)},
            ${sqlInt(quest.successfulCaptures ?? quest.successful_captures, 0)},
            ${sqlBool(quest.claimed)},
            ${sqlTimestamp(quest.claimedAt ?? quest.claimed_at)},
            ${sqlInt(quest.rewardCoins ?? quest.reward_coins, 0)},
            ${sqlInt(quest.rewardXp ?? quest.reward_xp, 0)},
            ${sqlJson(quest.rewardSpheres ?? quest.reward_spheres ?? {})}
          from public.guild_players players
          join public.discord_guilds guilds on guilds.id = players.guild_id
          join public.discord_users users on users.id = players.user_id
          where guilds.discord_guild_id = ${sqlText(guildId)}
            and users.discord_user_id = ${sqlText(userId)}
            and ${sqlDate(quest.date)} is not null
          on conflict (player_id, quest_date) do update set
            capture_attempts = excluded.capture_attempts,
            successful_captures = excluded.successful_captures,
            claimed = excluded.claimed,
            claimed_at = excluded.claimed_at,
            reward_coins = excluded.reward_coins,
            reward_xp = excluded.reward_xp,
            reward_spheres = excluded.reward_spheres;
        `);
      }
    }
  }

  for (const [guildId, guildUserPals] of Object.entries(plan.guildUserPals)) {
    for (const [userId, pals] of Object.entries(guildUserPals)) {
      for (const pal of pals) {
        statements.push(`
          insert into public.player_owned_pals (
            player_id,
            pal_id,
            level,
            rarity,
            is_shiny,
            image_url,
            stars,
            essence,
            extra_essence,
            first_caught_at,
            last_caught_at
          )
          select
            players.id,
            catalog.id,
            ${sqlInt(pal.level, 1)},
            ${sqlText(pal.rarity || "common")},
            ${sqlBool(pal.isShiny ?? pal.is_shiny)},
            ${sqlText(pal.imageUrl || pal.image_url)},
            ${sqlInt(pal.stars, 0)},
            ${sqlInt(pal.essence, 0)},
            ${sqlInt(pal.extraEssence ?? pal.extra_essence, 0)},
            ${sqlTimestamp(pal.firstCaughtAt ?? pal.caughtAt ?? pal.first_caught_at)},
            ${sqlTimestamp(pal.lastCaughtAt ?? pal.caughtAt ?? pal.last_caught_at)}
          from public.guild_players players
          join public.discord_guilds guilds on guilds.id = players.guild_id
          join public.discord_users users on users.id = players.user_id
          join public.pal_catalog catalog on catalog.name = ${sqlText(pal.name)}
          where guilds.discord_guild_id = ${sqlText(guildId)}
            and users.discord_user_id = ${sqlText(userId)}
          on conflict (player_id, pal_id) do update set
            level = excluded.level,
            rarity = excluded.rarity,
            is_shiny = excluded.is_shiny,
            image_url = excluded.image_url,
            stars = excluded.stars,
            essence = excluded.essence,
            extra_essence = excluded.extra_essence,
            first_caught_at = coalesce(public.player_owned_pals.first_caught_at, excluded.first_caught_at),
            last_caught_at = excluded.last_caught_at;
        `);
      }
    }
  }

  return statements.join("\n");
}

function printTableCounts(label, rows) {
  console.log(`${label}:`);
  for (const [tableName, rowCount] of rows) {
    console.log(`- ${tableName}: ${rowCount}`);
  }
}

function executeImport(plan) {
  console.log("JSON to Supabase live import");
  console.log("No JSON files will be modified.");
  console.log("Connection string will not be logged.");
  console.log("");
  printDryRun(plan);
  console.log("");

  const beforeCounts = getTableCounts();
  printTableCounts("database row counts before import", beforeCounts);
  console.log("");

  runPsqlWriteTransaction(buildImportSql(plan));

  const afterCounts = getTableCounts();
  printTableCounts("database row counts after import", afterCounts);
  console.log("");
  console.log("Live import completed.");
}

function main() {
  const checkDbRequested = process.argv.includes("--check-db");
  const executeRequested = process.argv.includes("--execute");
  const confirmImportRequested = process.argv.includes("--confirm-import");

  if (checkDbRequested && (executeRequested || confirmImportRequested)) {
    throw new Error("--check-db cannot be combined with live import flags.");
  }

  if (executeRequested && !confirmImportRequested) {
    throw new Error(
      "Live Supabase import requires both --execute and --confirm-import."
    );
  }

  if (confirmImportRequested && !executeRequested) {
    throw new Error("--confirm-import must be used with --execute.");
  }

  if (checkDbRequested) {
    checkDatabase();
    return;
  }

  const plan = createImportPlan();

  if (executeRequested) {
    executeImport(plan);
    return;
  }

  printDryRun(plan);
}

try {
  main();
} catch (error) {
  console.error(`[importJsonToSupabase] ${error.message}`);
  process.exitCode = 1;
}
