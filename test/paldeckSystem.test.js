const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPaldeckSummary,
  normalizeSpeciesName,
} = require("../src/systems/paldeckSystem");

test("buildPaldeckSummary dedupes duplicate owned Pal names", () => {
  const summary = buildPaldeckSummary({
    palCatalog: [
      { name: "Lamball" },
      { name: "Cattiva" },
      { name: "Chikipi" },
    ],
    ownedPals: [
      { name: "Lamball", caughtAt: "2026-06-08T10:00:00.000Z" },
      { name: " lamball ", caughtAt: "2026-06-08T12:00:00.000Z" },
      { name: "Cattiva", caughtAt: "2026-06-08T11:00:00.000Z" },
    ],
  });

  assert.equal(summary.ownedSpeciesCount, 2);
  assert.equal(summary.totalSpeciesCount, 3);
  assert.equal(summary.completionPercentage, 66.7);
});

test("buildPaldeckSummary counts total species from catalog", () => {
  const summary = buildPaldeckSummary({
    palCatalog: [
      { name: "Lamball" },
      { name: "Cattiva" },
      { name: "Chikipi" },
      { name: "Foxparks" },
    ],
    ownedPals: [{ name: "Lamball" }],
  });

  assert.equal(summary.totalSpeciesCount, 4);
  assert.equal(summary.ownedSpeciesCount, 1);
  assert.equal(summary.completionPercentage, 25);
});

test("buildPaldeckSummary handles an empty owned list", () => {
  const summary = buildPaldeckSummary({
    palCatalog: [
      { name: "Lamball" },
      { name: "Cattiva" },
    ],
    ownedPals: [],
  });

  assert.equal(summary.ownedSpeciesCount, 0);
  assert.equal(summary.totalSpeciesCount, 2);
  assert.equal(summary.completionPercentage, 0);
  assert.deepEqual(summary.recentSpecies, []);
  assert.deepEqual(summary.missingSpeciesPreview, ["Lamball", "Cattiva"]);
});

test("buildPaldeckSummary handles empty or missing catalog safely", () => {
  const emptyCatalogSummary = buildPaldeckSummary({
    palCatalog: [],
    ownedPals: [{ name: "Lamball" }],
  });
  const missingCatalogSummary = buildPaldeckSummary({
    ownedPals: [{ name: "Lamball" }],
  });

  assert.equal(emptyCatalogSummary.ownedSpeciesCount, 1);
  assert.equal(emptyCatalogSummary.totalSpeciesCount, 0);
  assert.equal(emptyCatalogSummary.completionPercentage, 0);
  assert.deepEqual(emptyCatalogSummary.missingSpeciesPreview, []);
  assert.equal(missingCatalogSummary.ownedSpeciesCount, 1);
  assert.equal(missingCatalogSummary.totalSpeciesCount, 0);
});

test("buildPaldeckSummary returns a safe missing species preview", () => {
  const summary = buildPaldeckSummary({
    palCatalog: [
      { name: "Lamball" },
      { name: "Cattiva" },
      { name: "Chikipi" },
      { name: "Foxparks" },
    ],
    ownedPals: [{ name: "Cattiva" }],
    missingPreviewLimit: 2,
  });

  assert.deepEqual(summary.missingSpeciesPreview, ["Lamball", "Chikipi"]);
});

test("buildPaldeckSummary sorts recent species by caughtAt", () => {
  const summary = buildPaldeckSummary({
    palCatalog: [
      { name: "Lamball" },
      { name: "Cattiva" },
      { name: "Chikipi" },
    ],
    ownedPals: [
      { name: "Lamball", caughtAt: "2026-06-08T10:00:00.000Z" },
      { name: "Cattiva", caughtAt: "2026-06-08T12:00:00.000Z" },
      { name: "Chikipi", caughtAt: "2026-06-08T11:00:00.000Z" },
    ],
    recentLimit: 2,
  });

  assert.deepEqual(
    summary.recentSpecies.map((pal) => pal.name),
    ["Cattiva", "Chikipi"]
  );
});

test("buildPaldeckSummary treats catalog variants as distinct species", () => {
  const summary = buildPaldeckSummary({
    palCatalog: [
      { name: "Azurobe" },
      { name: "Azurobe Cryst" },
      { name: "Blazehowl" },
      { name: "Blazehowl Noct" },
    ],
    ownedPals: [
      { name: "Azurobe" },
      { name: "Azurobe Cryst" },
      { name: "Blazehowl" },
    ],
  });

  assert.equal(summary.totalSpeciesCount, 4);
  assert.equal(summary.ownedSpeciesCount, 3);
  assert.deepEqual(summary.missingSpeciesPreview, ["Blazehowl Noct"]);
});

test("normalizeSpeciesName trims and lowercases species names", () => {
  assert.equal(normalizeSpeciesName("  Foxparks  "), "foxparks");
  assert.equal(normalizeSpeciesName(null), "");
});
