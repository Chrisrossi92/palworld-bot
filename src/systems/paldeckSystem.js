function normalizeSpeciesName(name) {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

function getCaughtAtTime(pal) {
  const caughtAtTime = new Date(pal?.caughtAt).getTime();
  return Number.isNaN(caughtAtTime) ? 0 : caughtAtTime;
}

function dedupeBySpecies(entries) {
  const bySpecies = new Map();

  for (const entry of Array.isArray(entries) ? entries : []) {
    const speciesKey = normalizeSpeciesName(entry?.name);

    if (!speciesKey) {
      continue;
    }

    if (!bySpecies.has(speciesKey)) {
      bySpecies.set(speciesKey, entry);
      continue;
    }

    const existing = bySpecies.get(speciesKey);

    if (getCaughtAtTime(entry) > getCaughtAtTime(existing)) {
      bySpecies.set(speciesKey, entry);
    }
  }

  return bySpecies;
}

function buildPaldeckSummary({
  palCatalog,
  ownedPals,
  recentLimit = 3,
  missingPreviewLimit = 5,
} = {}) {
  const catalogBySpecies = dedupeBySpecies(palCatalog);
  const ownedBySpecies = dedupeBySpecies(ownedPals);
  const totalSpeciesCount = catalogBySpecies.size;
  const ownedSpeciesCount = ownedBySpecies.size;
  const completionPercentage = totalSpeciesCount > 0
    ? Math.min(
      100,
      Number(((ownedSpeciesCount / totalSpeciesCount) * 100).toFixed(1))
    )
    : 0;
  const recentSpecies = Array.from(ownedBySpecies.values())
    .sort((first, second) => getCaughtAtTime(second) - getCaughtAtTime(first))
    .slice(0, Math.max(0, recentLimit))
    .map((pal) => ({
      name: pal.name,
      caughtAt: typeof pal.caughtAt === "string" ? pal.caughtAt : null,
    }));
  const missingSpeciesPreview = Array.from(catalogBySpecies.entries())
    .filter(([speciesKey]) => !ownedBySpecies.has(speciesKey))
    .slice(0, Math.max(0, missingPreviewLimit))
    .map(([, pal]) => pal.name);

  return {
    ownedSpeciesCount,
    totalSpeciesCount,
    completionPercentage,
    recentSpecies,
    missingSpeciesPreview,
  };
}

module.exports = {
  buildPaldeckSummary,
  normalizeSpeciesName,
};
