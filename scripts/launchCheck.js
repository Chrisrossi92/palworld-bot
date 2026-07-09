#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const { Pool } = require("pg");
const { commandPayloads } = require("../src/commands");

const allowedStorageProviders = new Set(["json", "supabase", "supabase-v2"]);

function getEnv(name) {
  return process.env[name] && process.env[name].trim();
}

function isTruthy(value) {
  return ["1", "true", "yes"].includes(String(value || "").trim().toLowerCase());
}

function addMissingEnv(errors, name, context) {
  if (!getEnv(name)) {
    errors.push(`${name} is required${context ? ` for ${context}` : ""}.`);
  }
}

async function checkSupabaseSchema(warnings, errors) {
  const dbUrl = getEnv("SUPABASE_DB_URL");

  if (!dbUrl) {
    errors.push("SUPABASE_DB_URL is required when STORAGE_PROVIDER=supabase-v2.");
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const requiredTables = [
    "discord_guilds",
    "discord_users",
    "guild_players",
    "player_owned_pals",
    "player_sphere_inventory",
    "player_daily_quests",
    "player_daily_research",
    "player_journal_entries",
    "guild_weekly_goals",
    "guild_spawn_settings",
    "pal_catalog",
  ];

  try {
    const result = await pool.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1);
      `,
      [requiredTables]
    );
    const present = new Set(result.rows.map((row) => row.table_name));
    const missing = requiredTables.filter((tableName) => !present.has(tableName));

    if (missing.length > 0) {
      errors.push(`Supabase schema is missing required tables: ${missing.join(", ")}.`);
    }
  } catch (error) {
    errors.push(`Supabase schema check failed: ${error.message}`);
  } finally {
    await pool.end().catch((error) => {
      warnings.push(`Supabase pool close failed: ${error.message}`);
    });
  }
}

async function main() {
  const errors = [];
  const warnings = [];
  const storageProvider = getEnv("STORAGE_PROVIDER");
  const normalizedStorageProvider = storageProvider ? storageProvider.toLowerCase() : "";
  const commandScope = (getEnv("REGISTER_COMMANDS_SCOPE") || "global").toLowerCase();
  const allowJsonLaunch = isTruthy(process.env.PALMASTER_ALLOW_JSON_LAUNCH);
  const localMode = isTruthy(process.env.PALMASTER_LAUNCH_CHECK_LOCAL);

  addMissingEnv(errors, "DISCORD_TOKEN", "bot runtime");
  addMissingEnv(errors, "DISCORD_CLIENT_ID", "command registration and install URLs");
  addMissingEnv(errors, "DASHBOARD_BASE_URL", "dashboard OAuth");
  addMissingEnv(errors, "DASHBOARD_SESSION_SECRET", "dashboard sessions");
  addMissingEnv(errors, "DISCORD_CLIENT_SECRET", "dashboard Discord OAuth");

  if (!storageProvider) {
    errors.push("STORAGE_PROVIDER must be explicit for launch.");
  } else if (!allowedStorageProviders.has(normalizedStorageProvider)) {
    errors.push(`Unsupported STORAGE_PROVIDER "${storageProvider}".`);
  }

  if (normalizedStorageProvider === "json" && !allowJsonLaunch) {
    errors.push(
      "STORAGE_PROVIDER=json is refused for public launch unless PALMASTER_ALLOW_JSON_LAUNCH=1 is set deliberately."
    );
  }

  if (commandScope === "guild") {
    addMissingEnv(errors, "DISCORD_GUILD_ID", "guild command registration");
  } else if (commandScope !== "global") {
    errors.push('REGISTER_COMMANDS_SCOPE must be "global" or "guild".');
  }

  if (!Array.isArray(commandPayloads) || commandPayloads.length === 0) {
    errors.push("Command payloads did not load.");
  }

  if (!getEnv("DISCORD_BOT_INVITE_URL") && !getEnv("DISCORD_CLIENT_ID")) {
    errors.push("DISCORD_BOT_INVITE_URL or DISCORD_CLIENT_ID is required for install URL generation.");
  }

  if (!getEnv("SUPPORT_SERVER_URL")) {
    warnings.push("SUPPORT_SERVER_URL is not configured; public support route will show a fallback page.");
  }

  if (normalizedStorageProvider === "supabase-v2") {
    await checkSupabaseSchema(warnings, errors);
  } else if (localMode) {
    warnings.push("Local launch check skipped Supabase schema checks because STORAGE_PROVIDER is not supabase-v2.");
  }

  console.log("PalMaster launch check");
  console.log(`- commandPayloads=${Array.isArray(commandPayloads) ? commandPayloads.length : 0}`);
  console.log(`- storageProvider=${normalizedStorageProvider || "missing"}`);
  console.log(`- commandRegistrationScope=${commandScope}`);
  console.log(`- localMode=${localMode}`);

  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR: ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log("Launch check passed.");
}

main().catch((error) => {
  console.error(`ERROR: Launch check crashed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
