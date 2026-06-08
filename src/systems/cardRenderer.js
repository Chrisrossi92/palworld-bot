const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const CARD_WIDTH = 700;
const CARD_HEIGHT = 320;
const CARDS_DIR = path.join(__dirname, "../../assets/cards");

const rarityColors = {
  common: "#95a5a6",
  uncommon: "#2ecc71",
  rare: "#3498db",
  epic: "#9b59b6",
  legendary: "#f1c40f",
};

const resultColors = {
  captured: "#2ecc71",
  escaped: "#e74c3c",
};

function escapeSvgText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  const slug = String(value || "pal")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "pal";
}

function estimateTextWidth(value, fontSize) {
  const text = String(value ?? "");
  let widthUnits = 0;

  for (const character of text) {
    if (character === " ") {
      widthUnits += 0.34;
    } else if (/[MW]/.test(character)) {
      widthUnits += 0.86;
    } else if (/[A-Z]/.test(character)) {
      widthUnits += 0.68;
    } else if (/[ilI1]/.test(character)) {
      widthUnits += 0.32;
    } else if (/[.,'`:;-]/.test(character)) {
      widthUnits += 0.3;
    } else {
      widthUnits += 0.58;
    }
  }

  return Math.ceil(widthUnits * fontSize);
}

function truncateTextToWidth(value, fontSize, maxWidth) {
  const ellipsis = "...";
  let text = String(value ?? "").trim();

  if (estimateTextWidth(text, fontSize) <= maxWidth) {
    return text;
  }

  while (
    text.length > 0 &&
    estimateTextWidth(`${text}${ellipsis}`, fontSize) > maxWidth
  ) {
    text = text.slice(0, -1).trimEnd();
  }

  return text ? `${text}${ellipsis}` : ellipsis;
}

function fitSvgText(value, {
  maxWidth,
  preferredFontSize,
  minFontSize,
} = {}) {
  const safeMaxWidth = Number.isFinite(maxWidth) && maxWidth > 0
    ? maxWidth
    : 1;
  const safePreferredFontSize =
    Number.isFinite(preferredFontSize) && preferredFontSize > 0
      ? preferredFontSize
      : 16;
  const safeMinFontSize =
    Number.isFinite(minFontSize) && minFontSize > 0
      ? Math.min(minFontSize, safePreferredFontSize)
      : safePreferredFontSize;
  let fontSize = safePreferredFontSize;
  let text = String(value ?? "").trim() || "Unknown";

  while (
    fontSize > safeMinFontSize &&
    estimateTextWidth(text, fontSize) > safeMaxWidth
  ) {
    fontSize -= 2;
  }

  let truncated = false;

  if (estimateTextWidth(text, fontSize) > safeMaxWidth) {
    text = truncateTextToWidth(text, fontSize, safeMaxWidth);
    truncated = true;
  }

  return {
    text,
    fontSize,
    estimatedWidth: estimateTextWidth(text, fontSize),
    truncated,
  };
}

function getErrorMessage(error) {
  if (!error) {
    return "unknown error";
  }

  return error.message || String(error);
}

function isImageDebugEnabled() {
  return process.env.PALMASTER_IMAGE_DEBUG === "1" ||
    process.env.CARD_IMAGE_DEBUG === "1";
}

function logImageDebug(message) {
  if (!isImageDebugEnabled()) {
    return;
  }

  console.log(`[cardRenderer:image] ${message}`);
}

async function fetchImageBuffer(imageUrl, timeoutMs = 2500) {
  if (!imageUrl) {
    return null;
  }

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available for card image rendering.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(imageUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch Pal image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    buffer,
    contentType: response.headers.get("content-type") || "",
    status: response.status,
  };
}

function buildPalImagePlaceholderSvg({
  width,
  height,
  accentColor,
  label = "FIELD SKETCH",
}) {
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);
  const headRadius = Math.round(Math.min(width, height) * 0.12);
  const bodyWidth = Math.round(width * 0.42);
  const bodyHeight = Math.round(height * 0.26);
  const fittedLabel = fitSvgText(label, {
    maxWidth: Math.max(80, width - 64),
    preferredFontSize: 18,
    minFontSize: 13,
  });

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="#111923"/>
      <path d="M28 ${height - 52} C${Math.round(width * 0.28)} ${height - 92} ${Math.round(width * 0.48)} ${height - 34} ${width - 24} ${height - 84}" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.22"/>
      <circle cx="${centerX}" cy="${centerY - 36}" r="${headRadius}" fill="${accentColor}" opacity="0.16"/>
      <ellipse cx="${centerX}" cy="${centerY + 26}" rx="${Math.round(bodyWidth / 2)}" ry="${Math.round(bodyHeight / 2)}" fill="${accentColor}" opacity="0.13"/>
      <path d="M${centerX - Math.round(bodyWidth / 2)} ${centerY + 24} C${centerX - 28} ${centerY - 4} ${centerX + 28} ${centerY - 4} ${centerX + Math.round(bodyWidth / 2)} ${centerY + 24}" fill="none" stroke="${accentColor}" stroke-width="5" opacity="0.3" stroke-linecap="round"/>
      <circle cx="${centerX - 13}" cy="${centerY - 40}" r="4" fill="${accentColor}" opacity="0.46"/>
      <circle cx="${centerX + 13}" cy="${centerY - 40}" r="4" fill="${accentColor}" opacity="0.46"/>
      <text x="${centerX}" y="${height - 28}" text-anchor="middle" fill="#b9c5ce" font-size="${fittedLabel.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeSvgText(fittedLabel.text)}</text>
    </svg>
  `;
}

function buildPlaceholderComposite({
  width,
  height,
  left,
  top,
  accentColor,
  label,
}) {
  return {
    input: Buffer.from(buildPalImagePlaceholderSvg({
      width,
      height,
      accentColor,
      label,
    })),
    left,
    top,
  };
}

function buildCardSvg({ pal, level, rarity, isShiny }) {
  const accentColor = rarityColors[rarity] || rarityColors.common;
  const palName = typeof pal?.name === "string" ? pal.name : "Unknown Pal";
  const levelText = level ? `Level ${level}` : "Level ?";
  const rarityText = rarity || "common";
  const fittedName = fitSvgText(palName, {
    maxWidth: 270,
    preferredFontSize: 42,
    minFontSize: 24,
  });
  const fittedRarity = fitSvgText(rarityText.toUpperCase(), {
    maxWidth: 136,
    preferredFontSize: 22,
    minFontSize: 18,
  });
  const rarityBadgeWidth = Math.min(
    176,
    Math.max(150, fittedRarity.estimatedWidth + 42)
  );
  const fittedLevel = fitSvgText(levelText, {
    maxWidth: 160,
    preferredFontSize: 25,
    minFontSize: 20,
  });
  const fittedLucky = fitSvgText("LUCKY", {
    maxWidth: 84,
    preferredFontSize: 20,
    minFontSize: 16,
  });

  return `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#121822"/>
          <stop offset="52%" stop-color="#1e2830"/>
          <stop offset="100%" stop-color="#283137"/>
        </linearGradient>
        <radialGradient id="fieldGlow" cx="70%" cy="42%" r="55%">
          <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.24"/>
          <stop offset="58%" stop-color="${accentColor}" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="28" fill="url(#bg)"/>
      <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="28" fill="url(#fieldGlow)"/>
      <path d="M0 232 C132 204 252 232 382 196 C506 162 596 174 700 136 L700 320 L0 320 Z" fill="#0c1118" opacity="0.58"/>
      <path d="M0 258 C142 220 266 244 410 206 C526 176 618 190 700 154" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.3"/>
      <rect x="0" y="0" width="14" height="${CARD_HEIGHT}" fill="${accentColor}"/>
      <circle cx="62" cy="54" r="14" fill="${accentColor}" opacity="0.95"/>
      <text x="52" y="88" fill="#d6dee8" font-size="19" font-family="Arial, Helvetica, sans-serif" font-weight="800">WILD PAL</text>
      <text x="52" y="118" fill="#8fa0ad" font-size="15" font-family="Arial, Helvetica, sans-serif" font-weight="700">Field encounter</text>
      <text x="52" y="166" fill="#ffffff" font-size="${fittedName.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeSvgText(fittedName.text)}</text>
      <text x="52" y="205" fill="#d9e1ea" font-size="${fittedLevel.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeSvgText(fittedLevel.text)}</text>
      <rect x="52" y="226" width="${rarityBadgeWidth}" height="42" rx="21" fill="${accentColor}" opacity="0.2"/>
      <text x="74" y="255" fill="${accentColor}" font-size="${fittedRarity.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeSvgText(fittedRarity.text)}</text>
      ${
        isShiny
          ? `<rect x="52" y="276" width="128" height="32" rx="16" fill="#f1c40f" opacity="0.24"/>
             <text x="75" y="298" fill="#f7d95c" font-size="${fittedLucky.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="900">${fittedLucky.text}</text>`
          : ""
      }
      <rect x="316" y="14" width="364" height="292" rx="30" fill="#0d1117" opacity="0.68"/>
      <rect x="334" y="30" width="328" height="260" rx="24" fill="#17212c" opacity="0.72"/>
      <rect x="334" y="30" width="328" height="260" rx="24" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.62"/>
    </svg>
  `;
}

function getPalName(pal) {
  return typeof pal?.name === "string" && pal.name.trim()
    ? pal.name.trim()
    : "Unknown Pal";
}

function getResultProgressionLine(result) {
  if (!result?.success) {
    return "";
  }

  const xpGained = Number.isFinite(result?.progression?.xpGained)
    ? result.progression.xpGained
    : 0;
  const coinsGained = Number.isFinite(result?.progression?.coinsGained)
    ? result.progression.coinsGained
    : 0;

  return `+${xpGained} XP   +${coinsGained} coins`;
}

function getResultJournalLine(result) {
  const unlocks = Array.isArray(result?.journal?.newlyUnlocked)
    ? result.journal.newlyUnlocked
    : [];

  if (unlocks.length === 0) {
    return "";
  }

  const visibleUnlocks = unlocks
    .slice(0, 2)
    .map((entry) => entry?.title)
    .filter(Boolean);
  const hiddenUnlockCount = unlocks.length - visibleUnlocks.length;

  return [
    `Journal: ${visibleUnlocks.join(", ")}`,
    hiddenUnlockCount > 0 ? `+${hiddenUnlockCount} more` : "",
  ].filter(Boolean).join(" ");
}

function getResultDailyResearchLine(result) {
  const dailyResearch = result?.dailyResearch;
  const state = dailyResearch?.state || dailyResearch;
  const progress = Number.isFinite(state?.progress) ? state.progress : null;
  const target = Number.isFinite(state?.target) ? state.target : null;

  if (progress === null || target === null) {
    return "";
  }

  return `Research: ${progress}/${target}`;
}

function getResultWeeklyGoalLine(result) {
  const weeklyGoal = result?.weeklyServerGoal;
  const state = weeklyGoal?.state || weeklyGoal;
  const progress = Number.isFinite(weeklyGoal?.progress)
    ? weeklyGoal.progress
    : Number.isFinite(state?.progress)
      ? state.progress
      : null;
  const target = Number.isFinite(state?.target) ? state.target : null;

  if (weeklyGoal?.newlyCompleted) {
    return "Server Goal Complete";
  }

  if (progress === null || target === null) {
    return "";
  }

  return `Server Goal: ${progress}/${target}`;
}

function buildCaptureResultHighlights(result) {
  if (!result?.success) {
    return [];
  }

  return [
    getResultProgressionLine(result),
    result?.progression?.leveledUp
      ? `Level Up: ${result.progression.oldLevel} -> ${result.progression.level}`
      : "",
    getResultJournalLine(result),
    getResultDailyResearchLine(result),
    getResultWeeklyGoalLine(result),
  ].filter(Boolean);
}

function fitResultLine(line) {
  return fitSvgText(line, {
    maxWidth: 314,
    preferredFontSize: 15,
    minFontSize: 11,
  });
}

function buildCaptureResultCardSvg(result) {
  const pal = result?.pal || {};
  const rarity = pal.rarity || "common";
  const accentColor = pal.isShiny
    ? rarityColors.legendary
    : result.success
      ? resultColors.captured
      : resultColors.escaped;
  const rarityAccent = rarityColors[rarity] || rarityColors.common;
  const statusText = result.success ? "CAPTURED" : "ESCAPED";
  const subStatusText = result.success
    ? "Collection updated"
    : "It broke free";
  const fittedName = fitSvgText(getPalName(pal), {
    maxWidth: 300,
    preferredFontSize: 46,
    minFontSize: 28,
  });
  const fittedRarity = fitSvgText(String(rarity).toUpperCase(), {
    maxWidth: 142,
    preferredFontSize: 21,
    minFontSize: 16,
  });
  const rarityBadgeWidth = Math.min(
    184,
    Math.max(150, fittedRarity.estimatedWidth + 42)
  );
  const levelText = pal.level ? `Level ${pal.level}` : "Level ?";
  const levelX = 76 + rarityBadgeWidth + 16;
  const fittedLevel = fitSvgText(levelText, {
    maxWidth: Math.max(80, 384 - levelX),
    preferredFontSize: 24,
    minFontSize: 18,
  });
  const sphereLine = fitSvgText(`Sphere: ${result.sphere || "basic"}`, {
    maxWidth: 314,
    preferredFontSize: 18,
    minFontSize: 15,
  });
  const highlights = buildCaptureResultHighlights(result)
    .slice(0, 5)
    .map(fitResultLine);
  const luckyBadge = pal.isShiny
    ? fitSvgText(result.success ? "LUCKY CAPTURE" : "LUCKY ENCOUNTER", {
      maxWidth: 150,
      preferredFontSize: 16,
      minFontSize: 13,
    })
    : null;

  return `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="resultBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111820"/>
          <stop offset="55%" stop-color="#1b242b"/>
          <stop offset="100%" stop-color="#263038"/>
        </linearGradient>
        <radialGradient id="resultGlow" cx="72%" cy="44%" r="58%">
          <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.28"/>
          <stop offset="64%" stop-color="${accentColor}" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="28" fill="url(#resultBg)"/>
      <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="28" fill="url(#resultGlow)"/>
      <path d="M0 238 C136 204 250 232 394 198 C514 170 600 180 700 148 L700 320 L0 320 Z" fill="#0c1118" opacity="0.58"/>
      <rect x="0" y="0" width="14" height="${CARD_HEIGHT}" fill="${accentColor}"/>
      <circle cx="86" cy="66" r="15" fill="${accentColor}" opacity="0.96"/>
      <text x="76" y="110" fill="${accentColor}" font-size="38" font-family="Arial, Helvetica, sans-serif" font-weight="900">${statusText}!</text>
      <text x="76" y="135" fill="#c8d2dc" font-size="17" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeSvgText(subStatusText)}</text>
      <text x="76" y="178" fill="#ffffff" font-size="${fittedName.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeSvgText(fittedName.text)}</text>
      <rect x="76" y="200" width="${rarityBadgeWidth}" height="38" rx="19" fill="${rarityAccent}" opacity="0.18"/>
      <text x="97" y="226" fill="${rarityAccent}" font-size="${fittedRarity.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeSvgText(fittedRarity.text)}</text>
      <text x="${levelX}" y="226" fill="#d9e1ea" font-size="${fittedLevel.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeSvgText(fittedLevel.text)}</text>
      <text x="76" y="247" fill="#d7e0e8" font-size="${sphereLine.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeSvgText(sphereLine.text)}</text>
      ${highlights.map((line, index) =>
        `<text x="76" y="${263 + index * 13}" fill="#aebbc7" font-size="${line.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeSvgText(line.text)}</text>`
      ).join("")}
      ${
        luckyBadge
          ? `<rect x="76" y="24" width="172" height="32" rx="16" fill="#f1c40f" opacity="0.2"/>
             <text x="94" y="46" fill="#f7d95c" font-size="${luckyBadge.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeSvgText(luckyBadge.text)}</text>`
          : ""
      }
      <rect x="380" y="18" width="300" height="288" rx="30" fill="#0d1117" opacity="0.72"/>
      <rect x="398" y="34" width="264" height="256" rx="24" fill="#17212c" opacity="0.78"/>
      <rect x="398" y="34" width="264" height="256" rx="24" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.62"/>
    </svg>
  `;
}

async function buildPalImageComposite(imageUrl, options = {}) {
  const width = 328;
  const height = 260;
  const left = 334;
  const top = 30;
  const accentColor = options.accentColor || rarityColors.common;
  const palName = options.palName || "Unknown Pal";
  let imageBuffer = null;
  let imageContentType = "";
  let imageStatus = null;

  if (imageUrl) {
    try {
      logImageDebug(`encounter fetch start pal="${palName}" url="${imageUrl}"`);
      const fetchResult = await fetchImageBuffer(imageUrl);
      imageBuffer = fetchResult.buffer;
      imageContentType = fetchResult.contentType;
      imageStatus = fetchResult.status;
      logImageDebug(
        `encounter fetch success pal="${palName}" status=${imageStatus} contentType="${imageContentType}" bytes=${imageBuffer.length}`
      );
    } catch (error) {
      console.warn(
        `[cardRenderer] Pal image unavailable for encounter pal="${palName}" url="${imageUrl}" reason="${getErrorMessage(error)}"; using placeholder.`
      );
      logImageDebug(
        `encounter fetch failure pal="${palName}" url="${imageUrl}" reason="${getErrorMessage(error)}"`
      );
    }
  }

  if (!imageBuffer) {
    return buildPlaceholderComposite({
      width,
      height,
      left,
      top,
      accentColor,
      label: "FIELD SKETCH",
    });
  }

  const roundedMask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="#fff"/>
    </svg>
  `);
  let palImage;

  try {
    const metadata = await sharp(imageBuffer).metadata();
    logImageDebug(
      `encounter decode success pal="${palName}" format=${metadata.format || "unknown"} width=${metadata.width || "unknown"} height=${metadata.height || "unknown"}`
    );
    palImage = await sharp(imageBuffer)
      .resize(width, height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .composite([{ input: roundedMask, blend: "dest-in" }])
      .png()
      .toBuffer();
  } catch (error) {
    console.warn(
      `[cardRenderer] Pal image decode failed for encounter pal="${palName}" url="${imageUrl}" reason="${getErrorMessage(error)}"; using placeholder.`
    );
    logImageDebug(
      `encounter decode failure pal="${palName}" url="${imageUrl}" status=${imageStatus || "unknown"} contentType="${imageContentType}" reason="${getErrorMessage(error)}"`
    );
    return buildPlaceholderComposite({
      width,
      height,
      left,
      top,
      accentColor,
      label: "FIELD SKETCH",
    });
  }

  return {
    input: palImage,
    left,
    top,
  };
}

async function buildResultPalImageComposite(imageUrl, options = {}) {
  const width = 264;
  const height = 256;
  const left = 398;
  const top = 34;
  const accentColor = options.accentColor || rarityColors.common;
  const palName = options.palName || "Unknown Pal";
  let imageBuffer = null;
  let imageContentType = "";
  let imageStatus = null;

  if (imageUrl) {
    try {
      logImageDebug(`result fetch start pal="${palName}" url="${imageUrl}"`);
      const fetchResult = await fetchImageBuffer(imageUrl);
      imageBuffer = fetchResult.buffer;
      imageContentType = fetchResult.contentType;
      imageStatus = fetchResult.status;
      logImageDebug(
        `result fetch success pal="${palName}" status=${imageStatus} contentType="${imageContentType}" bytes=${imageBuffer.length}`
      );
    } catch (error) {
      console.warn(
        `[cardRenderer] Pal image unavailable for result pal="${palName}" url="${imageUrl}" reason="${getErrorMessage(error)}"; using placeholder.`
      );
      logImageDebug(
        `result fetch failure pal="${palName}" url="${imageUrl}" reason="${getErrorMessage(error)}"`
      );
    }
  }

  if (!imageBuffer) {
    return buildPlaceholderComposite({
      width,
      height,
      left,
      top,
      accentColor,
      label: "FIELD SKETCH",
    });
  }

  const roundedMask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="#fff"/>
    </svg>
  `);
  let palImage;

  try {
    const metadata = await sharp(imageBuffer).metadata();
    logImageDebug(
      `result decode success pal="${palName}" format=${metadata.format || "unknown"} width=${metadata.width || "unknown"} height=${metadata.height || "unknown"}`
    );
    palImage = await sharp(imageBuffer)
      .resize(width, height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .composite([{ input: roundedMask, blend: "dest-in" }])
      .png()
      .toBuffer();
  } catch (error) {
    console.warn(
      `[cardRenderer] Pal image decode failed for result pal="${palName}" url="${imageUrl}" reason="${getErrorMessage(error)}"; using placeholder.`
    );
    logImageDebug(
      `result decode failure pal="${palName}" url="${imageUrl}" status=${imageStatus || "unknown"} contentType="${imageContentType}" reason="${getErrorMessage(error)}"`
    );
    return buildPlaceholderComposite({
      width,
      height,
      left,
      top,
      accentColor,
      label: "FIELD SKETCH",
    });
  }

  return {
    input: palImage,
    left,
    top,
  };
}

async function renderPalCardBuffer({ pal, level, rarity, isShiny }) {
  const imageUrl =
    pal && typeof pal.imageUrl === "string" && pal.imageUrl.trim()
      ? pal.imageUrl.trim()
      : "";
  const palSlug = slugify(pal?.name);
  const filename = `encounter-${Date.now()}-${palSlug}.png`;
  const baseCard = sharp(Buffer.from(buildCardSvg({ pal, level, rarity, isShiny })));
  const imageComposite = await buildPalImageComposite(imageUrl, {
    accentColor: rarityColors[rarity] || rarityColors.common,
    palName: getPalName(pal),
  });
  const composites = imageComposite ? [imageComposite] : [];
  const buffer = await baseCard.composite(composites).png().toBuffer();

  return {
    buffer,
    filename,
  };
}

async function renderPalCard({ pal, level, rarity, isShiny }) {
  const imageUrl =
    pal && typeof pal.imageUrl === "string" && pal.imageUrl.trim()
      ? pal.imageUrl.trim()
      : "";
  const palSlug = slugify(pal?.name);
  const filename = `encounter-${Date.now()}-${palSlug}.png`;
  const filePath = path.join(CARDS_DIR, filename);
  const baseCard = sharp(Buffer.from(buildCardSvg({ pal, level, rarity, isShiny })));
  const imageComposite = await buildPalImageComposite(imageUrl, {
    accentColor: rarityColors[rarity] || rarityColors.common,
    palName: getPalName(pal),
  });
  const composites = imageComposite ? [imageComposite] : [];

  await fs.mkdir(CARDS_DIR, { recursive: true });
  await baseCard.composite(composites).png().toFile(filePath);

  return {
    filename,
    path: filePath,
  };
}

async function renderCaptureResultCard(result) {
  const pal = result?.pal || {};
  const imageUrl =
    pal && typeof pal.imageUrl === "string" && pal.imageUrl.trim()
      ? pal.imageUrl.trim()
      : "";
  const palSlug = slugify(pal?.name);
  const resultSlug = result?.success ? "captured" : "escaped";
  const filename = `result-${resultSlug}-${Date.now()}-${palSlug}.png`;
  const baseCard = sharp(Buffer.from(buildCaptureResultCardSvg(result)));
  const imageComposite = await buildResultPalImageComposite(imageUrl, {
    accentColor: pal.isShiny
      ? rarityColors.legendary
      : result?.success
        ? resultColors.captured
        : resultColors.escaped,
    palName: getPalName(pal),
  });
  const composites = imageComposite ? [imageComposite] : [];
  const buffer = await baseCard.composite(composites).png().toBuffer();

  return {
    buffer,
    filename,
  };
}

module.exports = {
  buildPalImagePlaceholderSvg,
  buildCaptureResultCardSvg,
  buildCaptureResultHighlights,
  buildCardSvg,
  estimateTextWidth,
  fitSvgText,
  renderCaptureResultCard,
  renderPalCard,
  renderPalCardBuffer,
};
