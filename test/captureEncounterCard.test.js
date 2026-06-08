const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEncounterPayload,
  buildResolvedPayload,
} = require("../src/commands/capture");
const {
  buildCaptureResultCardSvg,
  buildCaptureResultHighlights,
  buildCardSvg,
  estimateTextWidth,
  fitSvgText,
  renderCaptureResultCard,
  renderPalCardBuffer,
} = require("../src/systems/cardRenderer");

function buildEncounter(overrides = {}) {
  return {
    name: "Lamball",
    level: 7,
    rarity: "common",
    imageUrl: "",
    isShiny: false,
    ...overrides,
  };
}

function buildInventory(overrides = {}) {
  return {
    basic: 3,
    mega: 1,
    giga: 0,
    hyper: 0,
    ultra: 0,
    legendary: 0,
    ...overrides,
  };
}

function buildCaptureResult(overrides = {}) {
  return {
    success: true,
    pal: {
      name: "Lamball",
      level: 7,
      rarity: "common",
      imageUrl: "",
      isShiny: false,
    },
    sphere: "basic",
    captureChance: 55,
    progression: {
      xpGained: 20,
      coinsGained: 40,
      leveledUp: false,
      oldLevel: 1,
      level: 1,
    },
    collectionUpdate: {
      outcome: "new",
    },
    dailyResearch: {
      progress: 2,
      target: 3,
    },
    weeklyServerGoal: {
      state: {
        progress: 44,
        target: 100,
      },
      progress: 44,
      newlyCompleted: false,
    },
    journal: {
      newlyUnlocked: [],
    },
    ...overrides,
  };
}

test("buildEncounterPayload uses generated card attachment when rendering succeeds", async () => {
  const payload = await buildEncounterPayload(
    buildEncounter(),
    buildInventory(),
    {
      renderCard: async () => ({
        filename: "encounter-card.png",
        buffer: Buffer.from("fake-png"),
      }),
    }
  );
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "Wild Pal Encounter");
  assert.equal(embed.description, "Choose a sphere to throw.");
  assert.equal(embed.image.url, "attachment://encounter-card.png");
  assert.equal(payload.files.length, 1);
  assert.equal(payload.components.length, 2);
});

test("buildEncounterPayload shows Lucky encounter title for shiny encounters", async () => {
  const payload = await buildEncounterPayload(
    buildEncounter({ isShiny: true }),
    buildInventory(),
    {
      renderCard: async () => ({
        filename: "lucky-card.png",
        buffer: Buffer.from("fake-png"),
      }),
    }
  );
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "Lucky Pal Encounter");
  assert.equal(embed.image.url, "attachment://lucky-card.png");
});

test("buildEncounterPayload falls back to thumbnail embed when rendering fails", async () => {
  const originalConsoleError = console.error;
  let payload;

  console.error = () => {};

  try {
    payload = await buildEncounterPayload(
      buildEncounter({
        imageUrl: "https://example.com/lamball.png",
      }),
      buildInventory(),
      {
        renderCard: async () => {
          throw new Error("render failed");
        },
      }
    );
  } finally {
    console.error = originalConsoleError;
  }

  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "Wild Pal Encounter");
  assert.equal(embed.fields.find((field) => field.name === "Wild Pal").value, "⚪ Lamball (Lv. 7, common)");
  assert.equal(embed.thumbnail.url, "https://example.com/lamball.png");
  assert.equal(payload.files, undefined);
  assert.equal(payload.components.length, 2);
});

test("renderPalCardBuffer can render without a Pal image URL", async () => {
  const card = await renderPalCardBuffer({
    pal: buildEncounter(),
    level: 7,
    rarity: "common",
    isShiny: false,
  });

  assert.match(card.filename, /^encounter-\d+-lamball\.png$/);
  assert.ok(Buffer.isBuffer(card.buffer));
  assert.ok(card.buffer.length > 0);
});

test("fitSvgText keeps long Pal names inside encounter card text bounds", () => {
  const fitted = fitSvgText("Broncherry Aqua Nocturnal", {
    maxWidth: 300,
    preferredFontSize: 54,
    minFontSize: 30,
  });

  assert.ok(fitted.estimatedWidth <= 300);
  assert.ok(fitted.fontSize >= 30);
  assert.equal(fitted.truncated, true);
  assert.match(fitted.text, /\.\.\.$/);
});

test("normal Pal names keep preferred encounter card font size", () => {
  const fitted = fitSvgText("Lamball", {
    maxWidth: 300,
    preferredFontSize: 54,
    minFontSize: 30,
  });
  const svg = buildCardSvg({
    pal: buildEncounter(),
    level: 7,
    rarity: "common",
    isShiny: false,
  });

  assert.equal(fitted.text, "Lamball");
  assert.equal(fitted.fontSize, 54);
  assert.equal(fitted.truncated, false);
  assert.match(svg, /font-size="54"[^>]*>Lamball<\/text>/);
});

test("buildCardSvg applies fitted long Pal name before the art frame", () => {
  const svg = buildCardSvg({
    pal: buildEncounter({ name: "Broncherry Aqua Nocturnal" }),
    level: 42,
    rarity: "rare",
    isShiny: false,
  });
  const nameMatch = svg.match(
    /<text x="76" y="174"[^>]+font-size="(\d+)"[^>]*>([^<]+)<\/text>/
  );

  assert.ok(nameMatch);
  assert.ok(Number(nameMatch[1]) <= 54);
  assert.ok(
    estimateTextWidth(nameMatch[2], Number(nameMatch[1])) <= 300
  );
  assert.doesNotMatch(nameMatch[2], /Nocturnal/);
});

test("buildCardSvg labels shiny encounters as Lucky", () => {
  const svg = buildCardSvg({
    pal: buildEncounter({ isShiny: true }),
    level: 7,
    rarity: "common",
    isShiny: true,
  });

  assert.match(svg, /LUCKY/);
  assert.doesNotMatch(svg, /SHINY/);
});

test("buildResolvedPayload uses generated card attachment for captured results", async () => {
  const payload = await buildResolvedPayload(
    buildCaptureResult(),
    2,
    buildInventory(),
    {
      renderCard: async () => ({
        filename: "captured-card.png",
        buffer: Buffer.from("fake-png"),
      }),
    }
  );
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "Pal Captured");
  assert.equal(embed.image.url, "attachment://captured-card.png");
  assert.equal(payload.attachments.length, 0);
  assert.equal(payload.files.length, 1);
  assert.equal(payload.components.length, 2);
});

test("buildResolvedPayload uses generated card attachment for escaped results", async () => {
  const payload = await buildResolvedPayload(
    buildCaptureResult({
      success: false,
      progression: {
        xpGained: 5,
        coinsGained: 10,
        leveledUp: false,
        oldLevel: 1,
        level: 1,
      },
      weeklyServerGoal: null,
    }),
    2,
    buildInventory(),
    {
      renderCard: async () => ({
        filename: "escaped-card.png",
        buffer: Buffer.from("fake-png"),
      }),
    }
  );
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "Pal Escaped");
  assert.equal(embed.image.url, "attachment://escaped-card.png");
  assert.equal(payload.files.length, 1);
});

test("buildResolvedPayload falls back to resolved embed when rendering fails", async () => {
  const originalConsoleError = console.error;
  let payload;

  console.error = () => {};

  try {
    payload = await buildResolvedPayload(
      buildCaptureResult(),
      2,
      buildInventory(),
      {
        renderCard: async () => {
          throw new Error("render failed");
        },
      }
    );
  } finally {
    console.error = originalConsoleError;
  }

  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "✅ Pal Captured!");
  assert.equal(payload.files, undefined);
  assert.equal(payload.attachments.length, 0);
});

test("buildCaptureResultHighlights caps Journal unlocks with +N more", () => {
  const highlights = buildCaptureResultHighlights(buildCaptureResult({
    journal: {
      newlyUnlocked: [
        { title: "First Capture" },
        { title: "Ten Captures" },
        { title: "Collector" },
      ],
    },
  }));

  assert.ok(highlights.some((line) =>
    line === "Journal: First Capture, Ten Captures +1 more"
  ));
  assert.ok(!highlights.some((line) => /Collector/.test(line)));
});

test("buildCaptureResultCardSvg uses Lucky treatment for Lucky captures", () => {
  const svg = buildCaptureResultCardSvg(buildCaptureResult({
    pal: {
      name: "Jetragon",
      level: 50,
      rarity: "legendary",
      imageUrl: "",
      isShiny: true,
    },
  }));

  assert.match(svg, /LUCKY CAPTURE/);
  assert.match(svg, /CAPTURED/);
});

test("buildCaptureResultCardSvg fits long Pal names safely", () => {
  const svg = buildCaptureResultCardSvg(buildCaptureResult({
    pal: {
      name: "Broncherry Aqua Nocturnal",
      level: 42,
      rarity: "rare",
      imageUrl: "",
      isShiny: false,
    },
  }));
  const nameMatch = svg.match(
    /<text x="76" y="170"[^>]+font-size="(\d+)"[^>]*>([^<]+)<\/text>/
  );

  assert.ok(nameMatch);
  assert.ok(
    estimateTextWidth(nameMatch[2], Number(nameMatch[1])) <= 314
  );
});

test("renderCaptureResultCard renders captured result without a Pal image URL", async () => {
  const card = await renderCaptureResultCard(buildCaptureResult());

  assert.match(card.filename, /^result-captured-\d+-lamball\.png$/);
  assert.ok(Buffer.isBuffer(card.buffer));
  assert.ok(card.buffer.length > 0);
});
