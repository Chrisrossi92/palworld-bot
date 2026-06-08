const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildTrainerFallbackEmbed,
  buildTrainerPayload,
} = require("../src/commands/trainer");
const {
  buildTrainerCardSvg,
  renderTrainerCard,
} = require("../src/systems/cardRenderer");
const {
  buildTrainerSummary,
} = require("../src/systems/trainerIdentitySystem");

function buildSummary(overrides = {}) {
  return buildTrainerSummary({
    username: "Tester",
    userRecord: {
      level: 12,
    },
    ownedPals: [
      {
        name: "Direhowl",
        level: 18,
        rarity: "rare",
        caughtAt: "2026-02-01T00:00:00.000Z",
        imageUrl: "",
      },
    ],
    paldeckSummary: {
      ownedSpeciesCount: 7,
      totalSpeciesCount: 197,
      completionPercentage: 4,
    },
    journalSummary: {
      unlockedCount: 3,
      totalDefinitions: 14,
      completionPercentage: 21,
    },
    ...overrides,
  });
}

test("buildTrainerCardSvg renders trainer identity summary", () => {
  const svg = buildTrainerCardSvg(buildSummary());

  assert.match(svg, /PALMASTER TRAINER CARD/);
  assert.match(svg, /Tester/);
  assert.match(svg, /Junior Tamer/);
  assert.match(svg, /Level 12/);
  assert.match(svg, /Direhowl/);
  assert.match(svg, /PALDECK/);
  assert.match(svg, /JOURNAL/);
});

test("renderTrainerCard renders with no owned Pals", async () => {
  const card = await renderTrainerCard(buildSummary({
    ownedPals: [],
    paldeckSummary: {
      ownedSpeciesCount: 0,
      totalSpeciesCount: 197,
      completionPercentage: 0,
    },
  }));

  assert.match(card.filename, /^trainer-\d+-tester\.png$/);
  assert.ok(Buffer.isBuffer(card.buffer));
  assert.ok(card.buffer.length > 0);
});

test("renderTrainerCard renders with favorite Pal art when provided", async () => {
  const onePixelPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p94AAAAASUVORK5CYII=";
  const card = await renderTrainerCard(buildSummary({
    ownedPals: [
      {
        name: "Direhowl",
        level: 18,
        rarity: "rare",
        caughtAt: "2026-02-01T00:00:00.000Z",
        imageUrl: onePixelPng,
      },
    ],
  }));

  assert.ok(Buffer.isBuffer(card.buffer));
  assert.ok(card.buffer.length > 0);
});

test("buildTrainerFallbackEmbed formats summary if card rendering fails", () => {
  const embed = buildTrainerFallbackEmbed(buildSummary()).toJSON();

  assert.equal(embed.title, "Tester's Trainer Card");
  assert.equal(embed.fields.find((field) => field.name === "Trainer").value, "Junior Tamer\nLevel 12");
  assert.match(embed.fields.find((field) => field.name === "Favorite Pal").value, /Direhowl/);
});

test("buildTrainerPayload returns card attachment with fake renderer", async () => {
  const payload = await buildTrainerPayload({
    guildId: "trainer-test-guild",
    userId: "trainer-test-user",
    username: "Tester",
    renderCard: async () => ({
      filename: "trainer-card.png",
      buffer: Buffer.from("fake-png"),
    }),
  });
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "Tester's Trainer Card");
  assert.equal(embed.image.url, "attachment://trainer-card.png");
  assert.equal(payload.files.length, 1);
});

test("buildTrainerPayload falls back to embed if rendering fails", async () => {
  const originalConsoleError = console.error;
  let payload;

  console.error = () => {};

  try {
    payload = await buildTrainerPayload({
      guildId: "trainer-test-guild",
      userId: "trainer-test-user",
      username: "Tester",
      renderCard: async () => {
        throw new Error("render failed");
      },
    });
  } finally {
    console.error = originalConsoleError;
  }

  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "Tester's Trainer Card");
  assert.equal(payload.files, undefined);
});
