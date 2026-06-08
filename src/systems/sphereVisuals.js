const sphereVisuals = {
  basic: {
    key: "basic",
    label: "Basic",
    emoji: "🔵",
    primaryColor: "#3498db",
    accentColor: "#8fd3ff",
  },
  mega: {
    key: "mega",
    label: "Mega",
    emoji: "🟢",
    primaryColor: "#2ecc71",
    accentColor: "#9bf2bd",
  },
  giga: {
    key: "giga",
    label: "Giga",
    emoji: "🟡",
    primaryColor: "#f1c40f",
    accentColor: "#ffe68a",
  },
  hyper: {
    key: "hyper",
    label: "Hyper",
    emoji: "🔴",
    primaryColor: "#e74c3c",
    accentColor: "#ffaaa2",
  },
  ultra: {
    key: "ultra",
    label: "Ultra",
    emoji: "🟣",
    primaryColor: "#9b59b6",
    accentColor: "#d8a8f0",
  },
  legendary: {
    key: "legendary",
    label: "Legendary",
    emoji: "✨",
    primaryColor: "#f1c40f",
    accentColor: "#b07cff",
  },
};

function normalizeSphereKey(sphere) {
  const key = String(sphere || "basic").toLowerCase();

  return sphereVisuals[key] ? key : "basic";
}

function getSphereVisual(sphere) {
  return sphereVisuals[normalizeSphereKey(sphere)];
}

function getSphereChoices() {
  return Object.values(sphereVisuals).map((visual) => [
    visual.label,
    visual.key,
  ]);
}

module.exports = {
  getSphereChoices,
  getSphereVisual,
  normalizeSphereKey,
  sphereVisuals,
};
