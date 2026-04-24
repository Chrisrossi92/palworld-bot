const fs = require("fs");
const path = require("path");

const LOCAL_PALS_PATH = path.join(__dirname, "..", "data", "pals.json");
const ALIASES_PATH = path.join(__dirname, "..", "data", "pal-image-aliases.json");
const SOURCE_PALS_URL =
  "https://raw.githubusercontent.com/mlg404/palworld-paldex-api/main/src/pals.json";
const SOURCE_IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/mlg404/palworld-paldex-api/main/public/images/paldeck";
const WIKI_PAGE_BASE_URL = "https://palworld.wiki.gg/wiki";

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

function buildWikiPageUrl(name) {
  return `${WIKI_PAGE_BASE_URL}/${encodeURIComponent(String(name || "").replace(/\s+/g, "_"))}`;
}

function extractMetaContent(html, propertyName) {
  const escapedName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedName}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedName}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      return match[1];
    }
  }

  return "";
}

function isHighConfidenceWikiImage(palName, ogTitle, imageUrl) {
  if (!ogTitle || !imageUrl) {
    return false;
  }

  const normalizedPalName = normalizePalName(palName);
  const normalizedTitle = normalizePalName(ogTitle.replace(/-.*$/, "").trim());
  const isTitleMatch = normalizedPalName === normalizedTitle;
  const normalizedImageUrl = normalizePalName(imageUrl);
  const hasPalNameInImageUrl = normalizedImageUrl.includes(normalizedPalName);
  const isLikelyImage =
    /^https?:\/\//i.test(imageUrl) &&
    !/logo|favicon|wordmark/i.test(imageUrl) &&
    /wiki|static|images/i.test(imageUrl);

  return isTitleMatch && isLikelyImage && hasPalNameInImageUrl;
}

async function fetchWikiImageUrl(palName) {
  const response = await fetch(buildWikiPageUrl(palName));

  if (!response.ok) {
    return "";
  }

  const html = await response.text();
  const ogTitle = extractMetaContent(html, "og:title");
  const ogImage =
    extractMetaContent(html, "og:image") ||
    extractMetaContent(html, "twitter:image");

  if (!isHighConfidenceWikiImage(palName, ogTitle, ogImage)) {
    return "";
  }

  return ogImage;
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

async function syncImageUrls(localPals, sourceIndex, aliases) {
  let sourceMatchedCount = 0;
  let wikiMatchedCount = 0;
  let missingCount = 0;

  const updatedPals = [];

  for (const pal of localPals) {
    if (typeof pal.imageUrl === "string" && pal.imageUrl.trim()) {
      updatedPals.push(pal);
      continue;
    }

    const sourcePal = findSourcePal(pal, sourceIndex, aliases);

    if (sourcePal && sourcePal.key) {
      sourceMatchedCount += 1;
      updatedPals.push({
        ...pal,
        imageUrl: `${SOURCE_IMAGE_BASE_URL}/${sourcePal.key}.png`,
      });
      continue;
    }

    const wikiImageUrl = await fetchWikiImageUrl(pal.name);

    if (wikiImageUrl) {
      wikiMatchedCount += 1;
      updatedPals.push({
        ...pal,
        imageUrl: wikiImageUrl,
      });
      continue;
    }

    missingCount += 1;
    updatedPals.push({
      ...pal,
      imageUrl: "",
    });
  }

  return {
    updatedPals,
    sourceMatchedCount,
    wikiMatchedCount,
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
  const {
    updatedPals,
    sourceMatchedCount,
    wikiMatchedCount,
    missingCount,
  } = await syncImageUrls(
    localPals,
    sourceIndex,
    aliases
  );

  writeLocalPals(updatedPals);

  console.log(`Source1 matched: ${sourceMatchedCount}`);
  console.log(`Wiki matched: ${wikiMatchedCount}`);
  console.log(`Still missing: ${missingCount}`);
}

main().catch((error) => {
  console.error("[syncPalImageUrls] Failed:", error);
  process.exit(1);
});
