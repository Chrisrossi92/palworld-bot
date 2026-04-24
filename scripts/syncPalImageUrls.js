const fs = require("fs");
const path = require("path");

const LOCAL_PALS_PATH = path.join(__dirname, "..", "data", "pals.json");
const ALIASES_PATH = path.join(__dirname, "..", "data", "pal-image-aliases.json");
const SOURCE_PALS_URL =
  "https://raw.githubusercontent.com/mlg404/palworld-paldex-api/main/src/pals.json";
const SOURCE_IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/mlg404/palworld-paldex-api/main/public/images/paldeck";

function normalizePalName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");
}

function readLocalPals() {
  const raw = fs.readFileSync(LOCAL_PALS_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("data/pals.json must contain an array.");
  }

  return parsed;
}

function readAliases() {
  if (!fs.existsSync(ALIASES_PATH)) {
    return {};
  }

  const raw = fs.readFileSync(ALIASES_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("data/pal-image-aliases.json must contain an object.");
  }

  return parsed;
}

async function fetchSourcePals() {
  const response = await fetch(SOURCE_PALS_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch source pals: ${response.status} ${response.statusText}`
    );
  }

  const parsed = await response.json();

  if (!Array.isArray(parsed)) {
    throw new Error("Source pals payload was not an array.");
  }

  return parsed;
}

function buildSourceIndex(sourcePals) {
  const index = new Map();

  for (const pal of sourcePals) {
    const normalizedName = normalizePalName(pal.name);
    const normalizedKey = normalizePalName(pal.key);

    if (!normalizedName || !pal.key) {
      continue;
    }

    if (!index.has(normalizedName)) {
      index.set(normalizedName, pal);
    }

    if (normalizedKey && !index.has(normalizedKey)) {
      index.set(normalizedKey, pal);
    }
  }

  return index;
}

function findSourcePal(pal, sourceIndex, aliases) {
  const normalizedName = normalizePalName(pal.name);
  const directMatch = sourceIndex.get(normalizedName);

  if (directMatch) {
    return directMatch;
  }

  const aliasValue = aliases[pal.name];

  if (!aliasValue || typeof aliasValue !== "string" || !aliasValue.trim()) {
    return null;
  }

  return sourceIndex.get(normalizePalName(aliasValue)) || null;
}

function syncImageUrls(localPals, sourceIndex, aliases) {
  let matchedCount = 0;
  let missingCount = 0;

  const updatedPals = localPals.map((pal) => {
    const sourcePal = findSourcePal(pal, sourceIndex, aliases);

    if (!sourcePal || !sourcePal.key) {
      missingCount += 1;

      return {
        ...pal,
        imageUrl: "",
      };
    }

    matchedCount += 1;

    return {
      ...pal,
      imageUrl: `${SOURCE_IMAGE_BASE_URL}/${sourcePal.key}.png`,
    };
  });

  return {
    updatedPals,
    matchedCount,
    missingCount,
  };
}

function writeLocalPals(pals) {
  const serialized = `${JSON.stringify(pals, null, 2)}\n`;

  JSON.parse(serialized);
  fs.writeFileSync(LOCAL_PALS_PATH, serialized, "utf8");
}

async function main() {
  const localPals = readLocalPals();
  const aliases = readAliases();
  const sourcePals = await fetchSourcePals();
  const sourceIndex = buildSourceIndex(sourcePals);
  const { updatedPals, matchedCount, missingCount } = syncImageUrls(
    localPals,
    sourceIndex,
    aliases
  );

  writeLocalPals(updatedPals);

  console.log(`Matched: ${matchedCount}`);
  console.log(`Missing: ${missingCount}`);
}

main().catch((error) => {
  console.error("[syncPalImageUrls] Failed:", error);
  process.exit(1);
});
