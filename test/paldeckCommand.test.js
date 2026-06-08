const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPaldeckEmbed,
  formatMissingSpeciesPreview,
  formatNextCollectionMilestone,
  formatPaldeckCompletion,
  formatRecentSpecies,
} = require("../src/commands/paldeck");

function buildPaldeckSummary(overrides = {}) {
  return {
    ownedSpeciesCount: 0,
    totalSpeciesCount: 10,
    completionPercentage: 0,
    recentSpecies: [],
    missingSpeciesPreview: [
      "Lamball",
      "Cattiva",
      "Chikipi",
      "Foxparks",
      "Fuack",
      "Sparkit",
      "Tanzee",
      "Pengullet",
      "Daedream",
      "Depresso",
      "Cremis",
    ],
    ...overrides,
  };
}

function buildJournalSummary(overrides = {}) {
  return {
    nextMilestones: [],
    ...overrides,
  };
}

test("Paldeck command formatting handles no owned Pals", () => {
  const embed = buildPaldeckEmbed(
    "Tester",
    buildPaldeckSummary(),
    buildJournalSummary()
  ).toJSON();

  assert.equal(embed.title, "Tester's Paldeck");
  assert.equal(
    embed.fields.find((field) => field.name === "Completion").value,
    "0/10 species discovered\n0% complete"
  );
  assert.equal(
    embed.fields.find((field) => field.name === "Recent Species").value,
    "None yet."
  );
  assert.match(
    embed.fields.find((field) => field.name === "Missing Species Preview").value,
    /Lamball/
  );
  assert.equal(embed.footer.text, "/mypals shows the Pals you own.");
});

test("Paldeck command formatting renders several owned species", () => {
  const summary = buildPaldeckSummary({
    ownedSpeciesCount: 3,
    completionPercentage: 30,
    recentSpecies: [
      { name: "Foxparks" },
      { name: "Cattiva" },
      { name: "Lamball" },
    ],
    missingSpeciesPreview: ["Chikipi", "Fuack"],
  });

  assert.equal(
    formatPaldeckCompletion(summary),
    "3/10 species discovered\n30% complete"
  );
  assert.equal(formatRecentSpecies(summary), "Foxparks, Cattiva, Lamball");
  assert.equal(formatMissingSpeciesPreview(summary), "Chikipi, Fuack");
});

test("Paldeck command formatting caps missing preview at 10", () => {
  const formatted = formatMissingSpeciesPreview(buildPaldeckSummary());

  assert.equal(formatted.split(", ").length, 10);
  assert.doesNotMatch(formatted, /Cremis/);
});

test("Paldeck command formatting caps recent species at 5", () => {
  const formatted = formatRecentSpecies(buildPaldeckSummary({
    recentSpecies: [
      { name: "One" },
      { name: "Two" },
      { name: "Three" },
      { name: "Four" },
      { name: "Five" },
      { name: "Six" },
    ],
  }));

  assert.equal(formatted.split(", ").length, 5);
  assert.doesNotMatch(formatted, /Six/);
});

test("Paldeck command selects next Collector milestone by uniqueSpecies metric", () => {
  const formatted = formatNextCollectionMilestone(buildJournalSummary({
    nextMilestones: [
      {
        category: "Discovery",
        metric: "captures",
        title: "Capture 10 Pals",
        value: 4,
        target: 10,
        metricLabel: "captures",
      },
      {
        category: "Collector",
        metric: "uniqueSpecies",
        title: "Discover 10 species",
        value: 3,
        target: 10,
        metricLabel: "unique species",
      },
    ],
  }));

  assert.equal(formatted, "Discover 10 species (3/10 unique species)");
});

test("Paldeck command handles catalog unavailable state", () => {
  const summary = buildPaldeckSummary({
    totalSpeciesCount: 0,
    missingSpeciesPreview: [],
  });

  assert.equal(formatPaldeckCompletion(summary), "Catalog unavailable.");
  assert.equal(formatMissingSpeciesPreview(summary), "Catalog unavailable.");
});
