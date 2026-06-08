const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildTrainerSummary,
  deriveFavoritePal,
  getTrainerTitleDefinition,
  normalizeTrainerIdentity,
} = require("../src/systems/trainerIdentitySystem");

function buildPal(overrides = {}) {
  return {
    name: "Lamball",
    level: 5,
    rarity: "common",
    caughtAt: "2026-01-01T00:00:00.000Z",
    imageUrl: "",
    ...overrides,
  };
}

test("trainer summary derives title from level", () => {
  const summary = buildTrainerSummary({
    username: "Tester",
    userRecord: { level: 35 },
    ownedPals: [],
  });

  assert.equal(summary.title, "Elite Tamer");
  assert.equal(summary.titleKey, "elite_tamer");
  assert.equal(getTrainerTitleDefinition(35).label, "Elite Tamer");
});

test("favorite Pal fallback chooses rarest owned Pal", () => {
  const favorite = deriveFavoritePal([
    buildPal({ name: "Recent Common", rarity: "common", caughtAt: "2026-03-01T00:00:00.000Z" }),
    buildPal({ name: "Rare Pal", rarity: "rare", caughtAt: "2026-01-01T00:00:00.000Z" }),
  ]);

  assert.equal(favorite.pal.name, "Rare Pal");
  assert.equal(favorite.source, "rarest");
});

test("favorite Pal fallback uses most recent Pal within same rarity", () => {
  const favorite = deriveFavoritePal([
    buildPal({ name: "Older Rare", rarity: "rare", caughtAt: "2026-01-01T00:00:00.000Z" }),
    buildPal({ name: "Newer Rare", rarity: "rare", caughtAt: "2026-03-01T00:00:00.000Z" }),
  ]);

  assert.equal(favorite.pal.name, "Newer Rare");
});

test("favorite Pal uses stored identity when owned", () => {
  const favorite = deriveFavoritePal(
    [
      buildPal({ name: "Lamball", rarity: "common" }),
      buildPal({ name: "Direhowl", rarity: "rare" }),
    ],
    {
      favoritePalName: "Lamball",
    }
  );

  assert.equal(favorite.pal.name, "Lamball");
  assert.equal(favorite.source, "stored");
});

test("trainer summary handles no owned Pals safely", () => {
  const summary = buildTrainerSummary({
    username: "",
    userRecord: {},
    ownedPals: [],
    paldeckSummary: null,
    journalSummary: null,
  });

  assert.equal(summary.username, "Trainer");
  assert.equal(summary.level, 1);
  assert.equal(summary.favoritePal, null);
  assert.equal(summary.favoriteSource, "none");
  assert.equal(summary.paldeck.completionPercentage, 0);
  assert.equal(summary.journal.completionPercentage, 0);
});

test("normalizes unknown trainer identity values to safe defaults", () => {
  const identity = normalizeTrainerIdentity({
    titleKey: "unknown",
    favoritePalName: "  Foxparks  ",
    backgroundKey: "unknown",
    frameKey: "unknown",
  });

  assert.equal(identity.titleKey, null);
  assert.equal(identity.favoritePalName, "Foxparks");
  assert.equal(identity.backgroundKey, "field_journal");
  assert.equal(identity.frameKey, "standard");
});
