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

async function fetchImageBuffer(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available for card image rendering.");
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch Pal image: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function buildCardSvg({ pal, level, rarity, isShiny }) {
  const accentColor = rarityColors[rarity] || rarityColors.common;
  const palName = typeof pal?.name === "string" ? pal.name : "Unknown Pal";
  const levelText = level ? `Level ${level}` : "Level ?";
  const rarityText = rarity || "common";

  return `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#151922"/>
          <stop offset="100%" stop-color="#232b36"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="28" fill="url(#bg)"/>
      <rect x="0" y="0" width="14" height="${CARD_HEIGHT}" fill="${accentColor}"/>
      <circle cx="86" cy="76" r="16" fill="${accentColor}" opacity="0.95"/>
      <text x="76" y="142" fill="#ffffff" font-size="54" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeSvgText(palName)}</text>
      <rect x="76" y="178" width="160" height="42" rx="21" fill="${accentColor}" opacity="0.18"/>
      <text x="98" y="207" fill="${accentColor}" font-size="23" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeSvgText(rarityText.toUpperCase())}</text>
      <text x="76" y="258" fill="#b7c0cc" font-size="32" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeSvgText(levelText)}</text>
      ${
        isShiny
          ? `<rect x="250" y="178" width="126" height="42" rx="21" fill="#f1c40f" opacity="0.22"/>
             <text x="271" y="207" fill="#f7d95c" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="800">✨ SHINY</text>`
          : ""
      }
      <rect x="406" y="30" width="254" height="260" rx="26" fill="#0d1117" opacity="0.96"/>
      <rect x="422" y="46" width="222" height="228" rx="20" fill="#1b222c"/>
    </svg>
  `;
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
  const composites = [];
  const imageBuffer = await fetchImageBuffer(imageUrl);

  if (imageBuffer) {
    const roundedMask = Buffer.from(`
      <svg width="222" height="228" viewBox="0 0 222 228" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="222" height="228" rx="20" fill="#fff"/>
      </svg>
    `);
    const palImage = await sharp(imageBuffer)
      .resize(222, 228, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .composite([{ input: roundedMask, blend: "dest-in" }])
      .png()
      .toBuffer();

    composites.push({
      input: palImage,
      left: 422,
      top: 46,
    });
  }

  await fs.mkdir(CARDS_DIR, { recursive: true });
  await baseCard.composite(composites).png().toFile(filePath);

  return {
    filename,
    path: filePath,
  };
}

module.exports = {
  renderPalCard,
};
