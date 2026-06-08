const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hydrateCatalogImageUrls,
  resetLocalCatalogImageUrlCacheForTests,
} = require("../src/systems/captureSystem");
const {
  buildBackfillPlan,
  normalizePalName,
} = require("../scripts/backfillPalCatalogImageUrls");

test("hydrateCatalogImageUrls fills missing imageUrl from local catalog", () => {
  resetLocalCatalogImageUrlCacheForTests();

  const [pal] = hydrateCatalogImageUrls([
    {
      name: "Chikipi",
      rarity: "common",
      unlockLevel: 1,
      imageUrl: "",
    },
  ]);

  assert.match(pal.imageUrl, /^https?:\/\//);
});

test("hydrateCatalogImageUrls preserves existing imageUrl values", () => {
  resetLocalCatalogImageUrlCacheForTests();

  const existingImageUrl = "https://example.com/custom-chikipi.png";
  const [pal] = hydrateCatalogImageUrls([
    {
      name: "Chikipi",
      rarity: "common",
      unlockLevel: 1,
      imageUrl: existingImageUrl,
    },
  ]);

  assert.equal(pal.imageUrl, existingImageUrl);
});

test("hydrateCatalogImageUrls normalizes names for fallback lookup", () => {
  resetLocalCatalogImageUrlCacheForTests();

  const [pal] = hydrateCatalogImageUrls([
    {
      name: "  Foxparks  ",
      rarity: "common",
      unlockLevel: 5,
      imageUrl: null,
    },
  ]);

  assert.match(pal.imageUrl, /^https?:\/\//);
});

test("buildBackfillPlan selects only blank database image URLs", () => {
  const localImageUrls = new Map([
    [normalizePalName("Chikipi"), "https://example.com/chikipi.png"],
    [normalizePalName("Foxparks"), "https://example.com/foxparks.png"],
  ]);

  const plan = buildBackfillPlan(
    [
      { id: "1", name: "Chikipi", image_url: "" },
      { id: "2", name: "Foxparks", image_url: null },
      { id: "3", name: "Lamball", image_url: "https://example.com/lamball.png" },
      { id: "4", name: "Unknown Pal", image_url: "" },
    ],
    localImageUrls
  );

  assert.deepEqual(
    plan.updates.map((update) => update.name),
    ["Chikipi", "Foxparks"]
  );
  assert.deepEqual(plan.missingLocalMatches, ["Unknown Pal"]);
});
