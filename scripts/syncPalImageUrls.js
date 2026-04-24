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

function buildWikiPageCandidates(name) {
  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    return [];
  }

  const candidates = [trimmedName.replace(/\s+/g, "_")];
  const parts = trimmedName.split(/\s+/);

  if (parts.length === 2) {
    const [baseName, variant] = parts;

    candidates.push(`${baseName}_(${variant})`);
  }

  return [...new Set(candidates)];
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
  const isTitleMatch =
    normalizedPalName === normalizedTitle ||
    normalizedTitle.includes(normalizedPalName) ||
    normalizedPalName.includes(normalizedTitle);
  const normalizedImageUrl = normalizePalName(imageUrl);
  const hasPalNameInImageUrl = normalizedImageUrl.includes(normalizedPalName);
  const isLikelyImage =
    /^https?:\/\//i.test(imageUrl) &&
    !/logo|favicon|wordmark/i.test(imageUrl) &&
    /(palworld\.wiki\.gg\/images|static\.wikia\.nocookie\.net\/palworld)/i.test(
      imageUrl
    );

  return isTitleMatch && isLikelyImage && hasPalNameInImageUrl;
}

async function fetchWikiImageUrlForCandidate(palName, candidate) {
  const response = await fetch(`${WIKI_PAGE_BASE_URL}/${encodeURIComponent(candidate)}`);

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

async function fetchWikiImageUrl(palName) {
  const candidates = buildWikiPageCandidates(palName);
  const directCandidate = candidates[0] || "";

  for (const candidate of candidates) {
    const imageUrl = await fetchWikiImageUrlForCandidate(palName, candidate);

    if (imageUrl) {
      return {
        imageUrl,
        matchType: candidate === directCandidate ? "direct" : "alt",
      };
    }
  }

  return {
    imageUrl: "",
    matchType: "",
  };
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
  let wikiDirectMatchedCount = 0;
  let wikiAltMatchedCount = 0;
  let missingCount = 0;
  const missingNames = [];

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

    const wikiMatch = await fetchWikiImageUrl(pal.name);

    if (wikiMatch.imageUrl) {
      if (wikiMatch.matchType === "alt") {
        wikiAltMatchedCount += 1;
      } else {
        wikiDirectMatchedCount += 1;
      }

      updatedPals.push({
        ...pal,
        imageUrl: wikiMatch.imageUrl,
      });
      continue;
    }

    missingCount += 1;
    missingNames.push(pal.name);
    updatedPals.push({
      ...pal,
      imageUrl: "",
    });
  }

  return {
    updatedPals,
    sourceMatchedCount,
    wikiDirectMatchedCount,
    wikiAltMatchedCount,
    missingCount,
    missingNames,
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
    wikiDirectMatchedCount,
    wikiAltMatchedCount,
    missingCount,
    missingNames,
  } = await syncImageUrls(
    localPals,
    sourceIndex,
    aliases
  );

  writeLocalPals(updatedPals);

  console.log(`Source1 matched: ${sourceMatchedCount}`);
  console.log(`Wiki direct matched: ${wikiDirectMatchedCount}`);
  console.log(`Wiki alt matched: ${wikiAltMatchedCount}`);
  console.log(`Still missing: ${missingCount}`);
  if (missingNames.length > 0) {
    console.log(`Still missing list: ${missingNames.join(", ")}`);
  }
}

main().catch((error) => {
  console.error("[syncPalImageUrls] Failed:", error);
  process.exit(1);
});
