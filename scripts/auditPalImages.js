const fs = require("fs");
const path = require("path");

const palsPath = path.join(__dirname, "..", "data", "pals.json");

function readPals() {
  const raw = fs.readFileSync(palsPath, "utf8");
  const parsed = JSON.parse(raw);

  return Array.isArray(parsed) ? parsed : [];
}

function main() {
  const pals = readPals();
  const missingByRarity = {};
  let withImageUrl = 0;

  for (const pal of pals) {
    const hasImageUrl =
      typeof pal.imageUrl === "string" && pal.imageUrl.trim().length > 0;

    if (hasImageUrl) {
      withImageUrl += 1;
      continue;
    }

    const rarity = pal.rarity || "unknown";

    if (!missingByRarity[rarity]) {
      missingByRarity[rarity] = [];
    }

    missingByRarity[rarity].push(pal.name || "Unknown Pal");
  }

  const missingCount = pals.length - withImageUrl;

  console.log("Pal Image Audit");
  console.log(`Total pals: ${pals.length}`);
  console.log(`With imageUrl: ${withImageUrl}`);
  console.log(`Missing imageUrl: ${missingCount}`);

  if (missingCount === 0) {
    console.log("\nAll pals have imageUrl values.");
    return;
  }

  console.log("\nMissing imageUrl by rarity:");

  for (const rarity of Object.keys(missingByRarity).sort()) {
    console.log(`\n${rarity}:`);

    for (const name of missingByRarity[rarity].sort()) {
      console.log(`- ${name}`);
    }
  }
}

main();
