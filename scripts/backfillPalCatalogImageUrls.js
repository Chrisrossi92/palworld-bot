#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const LOCAL_PALS_PATH = path.join(__dirname, "..", "data", "pals.json");

function normalizePalName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function readLocalImageUrls() {
  const raw = fs.readFileSync(LOCAL_PALS_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("data/pals.json must contain an array.");
  }

  const imageUrls = new Map();

  for (const pal of parsed) {
    if (
      !pal ||
      typeof pal.name !== "string" ||
      typeof pal.imageUrl !== "string" ||
      pal.imageUrl.trim() === ""
    ) {
      continue;
    }

    imageUrls.set(normalizePalName(pal.name), pal.imageUrl.trim());
  }

  return imageUrls;
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");

  return {
    apply,
    dryRun: !apply,
  };
}

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
}

async function loadCatalogRows(pool) {
  const result = await pool.query(`
    select id, name, image_url
    from public.pal_catalog
    order by name;
  `);

  return result.rows;
}

function buildBackfillPlan(catalogRows, localImageUrls) {
  const updates = [];
  const missingLocalMatches = [];

  for (const row of catalogRows) {
    const currentImageUrl =
      typeof row.image_url === "string" ? row.image_url.trim() : "";

    if (currentImageUrl !== "") {
      continue;
    }

    const localImageUrl = localImageUrls.get(normalizePalName(row.name));

    if (!localImageUrl) {
      missingLocalMatches.push(row.name);
      continue;
    }

    updates.push({
      id: row.id,
      name: row.name,
      imageUrl: localImageUrl,
    });
  }

  return {
    updates,
    missingLocalMatches,
  };
}

async function applyBackfill(pool, updates) {
  let updatedCount = 0;

  for (const update of updates) {
    const result = await pool.query(
      `
        update public.pal_catalog
        set image_url = $1
        where id = $2
          and (image_url is null or btrim(image_url) = '');
      `,
      [update.imageUrl, update.id]
    );

    updatedCount += result.rowCount;
  }

  return updatedCount;
}

function printPlan({ catalogRows, localImageUrls, updates, missingLocalMatches, dryRun }) {
  console.log("Pal catalog image URL backfill");
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log("No JSON files are modified.");
  console.log("");
  console.log(`local image URLs: ${localImageUrls.size}`);
  console.log(`database catalog rows: ${catalogRows.length}`);
  console.log(`rows eligible for backfill: ${updates.length}`);

  if (updates.length > 0) {
    const sample = updates
      .slice(0, 10)
      .map((update) => update.name)
      .join(", ");

    console.log(`sample updates: ${sample}`);
  }

  if (missingLocalMatches.length > 0) {
    const sample = missingLocalMatches.slice(0, 10).join(", ");

    console.log(`missing local image match: ${missingLocalMatches.length}`);
    console.log(`missing local sample: ${sample}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("Set SUPABASE_DB_URL or DATABASE_URL to backfill pal_catalog.image_url.");
  }

  const localImageUrls = readLocalImageUrls();
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const catalogRows = await loadCatalogRows(pool);
    const plan = buildBackfillPlan(catalogRows, localImageUrls);

    printPlan({
      catalogRows,
      localImageUrls,
      updates: plan.updates,
      missingLocalMatches: plan.missingLocalMatches,
      dryRun: options.dryRun,
    });

    if (options.dryRun) {
      console.log("");
      console.log("Run with --apply to update blank pal_catalog.image_url rows.");
      return;
    }

    const updatedCount = await applyBackfill(pool, plan.updates);

    console.log("");
    console.log(`updated rows: ${updatedCount}`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[backfillPalCatalogImageUrls] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildBackfillPlan,
  normalizePalName,
  readLocalImageUrls,
};
