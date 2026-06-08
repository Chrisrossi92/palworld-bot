const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEncounterPayload,
  buildShakePayload,
  buildResolvedPayload,
  buildThrowPayload,
} = require("../src/commands/capture");
const {
  buildCaptureShakeCardSvg,
  buildCaptureResultCardSvg,
  buildCaptureResultHighlights,
  buildCaptureThrowCardSvg,
  buildCardSvg,
  buildPalImagePlaceholderSvg,
  estimateTextWidth,
  fitSvgText,
  renderCaptureShakeCard,
  renderCaptureResultCard,
  renderCaptureThrowCard,
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
    maxWidth: 520,
    preferredFontSize: 40,
    minFontSize: 24,
  });
  const svg = buildCardSvg({
    pal: buildEncounter(),
    level: 7,
    rarity: "common",
    isShiny: false,
  });

  assert.equal(fitted.text, "Lamball");
  assert.equal(fitted.fontSize, 40);
  assert.equal(fitted.truncated, false);
  assert.match(svg, /text-anchor="middle"[^>]+font-size="40"[^>]*>Lamball<\/text>/);
});

test("buildCardSvg fits long Pal names in the top title", () => {
  const svg = buildCardSvg({
    pal: buildEncounter({
      name: "Broncherry Aqua Nocturnal Experimental Variant",
    }),
    level: 42,
    rarity: "rare",
    isShiny: false,
  });
  const nameMatch = svg.match(
    /<text x="350" y="58"[^>]+font-size="(\d+)"[^>]*>([^<]+)<\/text>/
  );

  assert.ok(nameMatch);
  assert.ok(Number(nameMatch[1]) <= 40);
  assert.ok(
    estimateTextWidth(nameMatch[2], Number(nameMatch[1])) <= 520
  );
});

test("encounter Pal name font size is capped below oversized V1.5 text", () => {
  const svg = buildCardSvg({
    pal: buildEncounter(),
    level: 7,
    rarity: "common",
    isShiny: false,
  });
  const nameMatch = svg.match(
    /<text x="350" y="58"[^>]+font-size="(\d+)"[^>]*>Lamball<\/text>/
  );

  assert.ok(nameMatch);
  assert.ok(Number(nameMatch[1]) <= 40);
});

test("missing Pal image placeholder renders intentional field sketch", () => {
  const svg = buildPalImagePlaceholderSvg({
    width: 328,
    height: 260,
    accentColor: "#3498db",
  });

  assert.match(svg, /FIELD SKETCH/);
  assert.match(svg, /ellipse/);
  assert.match(svg, /circle/);
});

test("encounter card uses a premium centered art-stage layout", () => {
  const svg = buildCardSvg({
    pal: buildEncounter({ isShiny: true }),
    level: 7,
    rarity: "common",
    isShiny: true,
  });

  assert.match(svg, /Lamball/);
  assert.match(svg, /Level 7/);
  assert.match(svg, /Common • Level 7/);
  assert.match(svg, /LUCKY/);
  assert.match(svg, /width="444" height="186"/);
  assert.doesNotMatch(svg, /WILD PAL/);
  assert.doesNotMatch(svg, /Field encounter/);
  assert.doesNotMatch(svg, /<text x="52" y="88"[^>]*>/);
  assert.doesNotMatch(svg, /Basic|Mega|Giga|Hyper|Ultra|Legendary/);
  assert.doesNotMatch(svg, /XP|coins|Journal|Research|Server Goal/);
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

test("buildThrowPayload uses generated card attachment and clears stale attachments", async () => {
  const payload = await buildThrowPayload(
    buildEncounter(),
    "basic",
    buildInventory(),
    {
      renderCard: async () => ({
        filename: "throw-card.png",
        buffer: Buffer.from("fake-png"),
      }),
    }
  );
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "Sphere Thrown");
  assert.equal(embed.image.url, "attachment://throw-card.png");
  assert.deepEqual(payload.attachments, []);
  assert.equal(payload.files.length, 1);
  assert.equal(payload.components.length, 2);
});

test("buildShakePayload uses generated card attachment and clears stale attachments", async () => {
  const payload = await buildShakePayload(
    buildEncounter(),
    "basic",
    buildInventory(),
    {
      renderCard: async () => ({
        filename: "shake-card.png",
        buffer: Buffer.from("fake-png"),
      }),
    }
  );
  const embed = payload.embeds[0].toJSON();

  assert.equal(embed.title, "The Sphere Shakes");
  assert.equal(embed.image.url, "attachment://shake-card.png");
  assert.deepEqual(payload.attachments, []);
  assert.equal(payload.files.length, 1);
  assert.equal(payload.components.length, 2);
});

test("buildThrowPayload falls back to throw embed when rendering fails", async () => {
  const originalConsoleError = console.error;
  let payload;

  console.error = () => {};

  try {
    payload = await buildThrowPayload(
      buildEncounter({ imageUrl: "https://example.com/lamball.png" }),
      "basic",
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

  assert.match(embed.title, /Throwing basic Sphere/);
  assert.equal(embed.thumbnail.url, "https://example.com/lamball.png");
  assert.equal(payload.files, undefined);
  assert.deepEqual(payload.attachments, []);
});

test("buildShakePayload falls back to shake embed when rendering fails", async () => {
  const originalConsoleError = console.error;
  let payload;

  console.error = () => {};

  try {
    payload = await buildShakePayload(
      buildEncounter({ imageUrl: "https://example.com/lamball.png" }),
      "basic",
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

  assert.equal(embed.title, "...shake...shake...");
  assert.equal(embed.thumbnail.url, "https://example.com/lamball.png");
  assert.equal(payload.files, undefined);
  assert.deepEqual(payload.attachments, []);
});

test("throw and shake cards keep cinematic sequence text minimal", () => {
  const throwSvg = buildCaptureThrowCardSvg({
    pal: buildEncounter({
      name: "Broncherry Aqua Nocturnal Experimental Variant",
    }),
    sphere: "legendary",
  });
  const shakeSvg = buildCaptureShakeCardSvg({
    pal: buildEncounter(),
    sphere: "legendary",
  });
  const throwNameMatch = throwSvg.match(
    /<text x="72" y="160"[^>]+font-size="(\d+)"[^>]*>([^<]+)<\/text>/
  );

  assert.match(throwSvg, /Sphere thrown!/);
  assert.match(throwSvg, /Legendary Sphere/);
  assert.ok(throwNameMatch);
  assert.ok(estimateTextWidth(throwNameMatch[2], Number(throwNameMatch[1])) <= 280);
  assert.match(shakeSvg, /The sphere shakes.../);
  assert.match(shakeSvg, /Legendary Sphere/);
  assert.doesNotMatch(`${throwSvg}\n${shakeSvg}`, /Inventory|coins|XP|Journal|Research|Server Goal/);
});

test("throw and shake renderers produce image buffers without Pal image URLs", async () => {
  const throwCard = await renderCaptureThrowCard({
    pal: buildEncounter(),
    sphere: "basic",
  });
  const shakeCard = await renderCaptureShakeCard({
    pal: buildEncounter(),
    sphere: "basic",
  });

  assert.match(throwCard.filename, /^throw-\d+-lamball\.png$/);
  assert.ok(Buffer.isBuffer(throwCard.buffer));
  assert.ok(throwCard.buffer.length > 0);
  assert.match(shakeCard.filename, /^shake-\d+-lamball\.png$/);
  assert.ok(Buffer.isBuffer(shakeCard.buffer));
  assert.ok(shakeCard.buffer.length > 0);
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

test("captured result card focuses on outcome and earned rewards", () => {
  const svg = buildCaptureResultCardSvg(buildCaptureResult({
    progression: {
      xpGained: 20,
      coinsGained: 40,
      leveledUp: true,
      oldLevel: 4,
      level: 5,
    },
    journal: {
      newlyUnlocked: [
        { title: "First Capture" },
        { title: "Ten Captures" },
        { title: "Collector" },
      ],
    },
  }));

  assert.match(svg, /CAPTURED!/);
  assert.match(svg, /\+20 XP/);
  assert.match(svg, /\+40 coins/);
  assert.match(svg, /Level Up: 4 -&gt; 5/);
  assert.match(svg, /Journal: First Capture, Ten Captures \+1 more/);
  assert.match(svg, /Research: 2\/3/);
  assert.match(svg, /Server Goal: 44\/100/);
  assert.doesNotMatch(svg, /Total XP|Total Coins|Streak|Stars|Essence|Duplicate|Condensed/);
});

test("escaped result card remains minimal", () => {
  const svg = buildCaptureResultCardSvg(buildCaptureResult({
    success: false,
    progression: {
      xpGained: 5,
      coinsGained: 10,
      leveledUp: false,
      oldLevel: 1,
      level: 1,
    },
    journal: {
      newlyUnlocked: [
        { title: "First Capture" },
      ],
    },
    dailyResearch: {
      progress: 3,
      target: 3,
    },
    weeklyServerGoal: {
      state: {
        progress: 99,
        target: 100,
      },
      progress: 99,
    },
  }));

  assert.match(svg, /ESCAPED!/);
  assert.match(svg, /Sphere: basic/);
  assert.doesNotMatch(svg, /XP|coins|Journal|Research|Server Goal|Level Up/);
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
    /<text x="76" y="178"[^>]+font-size="(\d+)"[^>]*>([^<]+)<\/text>/
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
