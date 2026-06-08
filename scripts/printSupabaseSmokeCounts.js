#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

const TABLES = [
  "guild_players",
  "player_sphere_inventory",
  "player_owned_pals",
  "player_daily_quests",
  "player_journal_entries",
  "player_daily_research",
  "pal_catalog",
];

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("SUPABASE_DB_URL is required.");
  }

  const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
  });

  try {
    const client = await pool.connect();

    try {
      await client.query("begin read only");

      console.log("Supabase smoke counts");
      console.log("Read-only query; no writes performed.");
      console.log("Connection string was not logged.");
      console.log("");

      for (const tableName of TABLES) {
        const result = await client.query(
          `select count(*)::integer as row_count from public.${tableName}`
        );
        console.log(`${tableName}: ${result.rows[0].row_count}`);
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[printSupabaseSmokeCounts] ${error.message}`);
  process.exitCode = 1;
});
