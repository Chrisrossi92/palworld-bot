function setText(id, value) {
  document.querySelector(`#${id}`).textContent = String(value);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}%`;
}

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRelativeTime(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  for (const [unit, unitSeconds] of units) {
    const valueInUnit = Math.trunc(seconds / unitSeconds);

    if (Math.abs(valueInUnit) >= 1) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(valueInUnit, unit);
    }
  }

  return "just now";
}

function getRarityRank(rarity) {
  const ranks = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
  };

  return ranks[String(rarity || "").toLowerCase()] || 0;
}

function calculateCommunityHealth({ engagement, paldeckHealth }) {
  const players = Math.min(Number(engagement.totalPlayers || 0) * 20, 30);
  const recentCaptures = Math.min(Number(engagement.recentCapturesCount || 0) * 8, 25);
  const questActivity = Math.min(Number(engagement.dailyQuestActivity || 0) * 15, 20);
  const completion = Math.min(Number(paldeckHealth.completionPercentage || 0) * 0.25, 25);

  return Math.round(players + recentCaptures + questActivity + completion);
}

async function fetchJson(path) {
  const response = await fetch(path);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Dashboard API request failed.");
  }

  return payload;
}

function setStatus(id, text, isError = false) {
  const element = document.querySelector(`#${id}`);
  element.textContent = text;
  element.classList.toggle("status-error", isError);
}

function renderEmptyList(id, text) {
  const element = document.querySelector(`#${id}`);
  element.innerHTML = "";

  const item = document.createElement("li");
  item.className = "muted";
  item.textContent = text;
  element.append(item);
}

function renderRankedList(id, rows, emptyText, formatter) {
  const element = document.querySelector(`#${id}`);
  element.innerHTML = "";

  if (!Array.isArray(rows) || rows.length === 0) {
    renderEmptyList(id, emptyText);
    return;
  }

  for (const row of rows) {
    const item = document.createElement("li");
    const primary = document.createElement("span");
    const secondary = document.createElement("span");

    primary.textContent = row.displayName || row.userId || "Unknown player";
    secondary.textContent = formatter(row);
    item.append(primary, secondary);
    element.append(item);
  }
}

function renderActivityList(id, rows, emptyText, formatter) {
  const element = document.querySelector(`#${id}`);
  element.innerHTML = "";

  if (!Array.isArray(rows) || rows.length === 0) {
    renderEmptyList(id, emptyText);
    return;
  }

  for (const row of rows) {
    const item = document.createElement("li");
    const badge = document.createElement("span");
    const primary = document.createElement("div");
    const secondary = document.createElement("div");

    item.className = `timeline-item ${row.highlightClass || ""}`.trim();
    badge.className = `event-badge ${row.badgeClass || ""}`.trim();
    primary.className = "activity-primary";
    secondary.className = "activity-secondary";

    const content = formatter(row);
    badge.textContent = content.badge;
    primary.textContent = content.primary;
    secondary.textContent = content.secondary;
    item.append(badge, primary, secondary);
    element.append(item);
  }
}

async function loadGuildIdentity(guildId) {
  const meta = document.querySelector("#guildIdentityMeta");

  try {
    const payload = await fetchJson("/api/guilds");
    const guild = (payload.guilds || []).find((entry) => entry.id === guildId);
    const displayName = guild?.name || guildId;

    document.querySelector("#guildName").textContent = displayName;
    meta.textContent = guild?.hasStoredName
      ? `Discord server ${guildId}`
      : `Server ID ${guildId}`;
    return displayName;
  } catch (error) {
    document.querySelector("#guildName").textContent = "Connected Discord Server";
    meta.textContent = `Server ID ${guildId}`;
    return guildId;
  }
}

async function loadEngagement(guildId) {
  try {
    const payload = await fetchJson(`/api/guilds/${encodeURIComponent(guildId)}/engagement`);
    const engagement = payload.engagement || {};

    setText("totalPlayers", formatNumber(engagement.totalPlayers));
    setText("totalCaptures", formatNumber(engagement.totalCaptures));
    setText("totalOwnedPals", formatNumber(engagement.totalOwnedPals));
    setText("dailyQuestActivity", formatNumber(engagement.dailyQuestActivity));
    setText("recentCapturesCount", formatNumber(engagement.recentCapturesCount));
    setStatus(
      "engagementStatus",
      payload.hasSupabaseConnection ? "Live Supabase metrics." : "No Supabase connection."
    );
    return engagement;
  } catch (error) {
    setStatus("engagementStatus", error.message, true);
    return {};
  }
}

async function loadTopCollectors(guildId) {
  try {
    const payload = await fetchJson(`/api/guilds/${encodeURIComponent(guildId)}/top-collectors`);
    const topCollectors = payload.topCollectors || {};

    renderRankedList(
      "topCapturesList",
      topCollectors.topCaptures,
      "No capture leaderboard data yet.",
      (row) => `${formatNumber(row.captures)} captures`
    );
    renderRankedList(
      "highestLevelList",
      topCollectors.highestLevelPlayers,
      "No player level data yet.",
      (row) => `Level ${formatNumber(row.level)}`
    );
    setText("shinyCollectorsCount", formatNumber(topCollectors.shinyCollectorsCount));
    setStatus(
      "collectorsStatus",
      payload.hasSupabaseConnection ? "Collector data loaded." : "No Supabase connection."
    );
    return topCollectors;
  } catch (error) {
    setStatus("collectorsStatus", error.message, true);
    renderEmptyList("topCapturesList", "Unable to load captures leaderboard.");
    renderEmptyList("highestLevelList", "Unable to load level leaderboard.");
    return {};
  }
}

async function loadPaldeckHealth(guildId) {
  try {
    const payload = await fetchJson(`/api/guilds/${encodeURIComponent(guildId)}/paldeck-health`);
    const paldeckHealth = payload.paldeckHealth || {};

    setText("catalogSize", formatNumber(paldeckHealth.catalogSize));
    setText("uniqueSpeciesOwned", formatNumber(paldeckHealth.uniqueSpeciesOwned));
    setText("completionPercentage", formatPercent(paldeckHealth.completionPercentage));
    setStatus(
      "paldeckStatus",
      payload.hasSupabaseConnection ? "Paldeck health loaded." : "No Supabase connection."
    );
    return paldeckHealth;
  } catch (error) {
    setStatus("paldeckStatus", error.message, true);
    return {};
  }
}

async function loadRecentActivity(guildId) {
  try {
    const payload = await fetchJson(`/api/guilds/${encodeURIComponent(guildId)}/recent-activity`);
    const recentActivity = payload.recentActivity || {};

    renderActivitySummary(recentActivity);
    renderActivityList(
      "serverActivityFeed",
      buildActivityFeed(recentActivity),
      "No recent server activity yet.",
      (row) => ({
        badge: row.badge,
        primary: row.primary,
        secondary: row.secondary,
      })
    );
    setStatus(
      "activityStatus",
      payload.hasSupabaseConnection ? "Recent activity loaded." : "No Supabase connection."
    );
    return recentActivity;
  } catch (error) {
    setStatus("activityStatus", error.message, true);
    renderEmptyList("serverActivityFeed", "Unable to load server activity.");
    setText("latestCaptureSummary", "Unavailable");
    setText("recentPlayerSummary", "Unavailable");
    setText("activityCaptureCount", "0");
    return {};
  }
}

function getCaptureEventType(row) {
  const rarityRank = getRarityRank(row.rarity);

  if (row.isShiny) {
    return {
      badge: "Shiny capture",
      badgeClass: "event-shiny",
      highlightClass: "timeline-highlight-shiny",
    };
  }

  if (rarityRank >= 3) {
    return {
      badge: "Rare capture",
      badgeClass: "event-rare",
      highlightClass: "timeline-highlight-rare",
    };
  }

  return {
    badge: "Capture",
    badgeClass: "event-capture",
    highlightClass: "",
  };
}

function buildActivityFeed(recentActivity) {
  const captureEvents = Array.isArray(recentActivity.latestCaptures)
    ? recentActivity.latestCaptures.map((row) => {
      const eventType = getCaptureEventType(row);

      return {
        ...eventType,
        timestamp: row.caughtAt,
        primary: `${row.displayName || row.userId || "Unknown player"} caught ${row.palName || "a Pal"}`,
        secondary: `${row.isShiny ? "Shiny " : ""}${row.rarity || "unknown"} • Level ${formatNumber(row.level)} • ${formatRelativeTime(row.caughtAt)}`,
      };
    })
    : [];
  const playerEvents = Array.isArray(recentActivity.latestPlayerActivity)
    ? recentActivity.latestPlayerActivity.map((row) => ({
      badge: "Player activity",
      badgeClass: "event-player",
      highlightClass: "",
      timestamp: row.updatedAt,
      primary: `${row.displayName || row.userId || "Unknown player"} was active`,
      secondary: `Level ${formatNumber(row.level)} • ${formatNumber(row.captures)} captures • ${formatRelativeTime(row.updatedAt)}`,
    }))
    : [];

  return [...captureEvents, ...playerEvents]
    .filter((row) => row.timestamp)
    .sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime())
    .slice(0, 12);
}

function renderActivitySummary(recentActivity) {
  const latestCapture = Array.isArray(recentActivity.latestCaptures)
    ? recentActivity.latestCaptures[0]
    : null;
  const latestPlayer = Array.isArray(recentActivity.latestPlayerActivity)
    ? recentActivity.latestPlayerActivity[0]
    : null;

  setText(
    "latestCaptureSummary",
    latestCapture
      ? `${latestCapture.palName || "A Pal"} by ${latestCapture.displayName || latestCapture.userId || "Unknown player"}`
      : "No captures yet"
  );
  setText(
    "recentPlayerSummary",
    latestPlayer
      ? latestPlayer.displayName || latestPlayer.userId || "Unknown player"
      : "No player activity yet"
  );
  setText(
    "activityCaptureCount",
    formatNumber(Array.isArray(recentActivity.latestCaptures) ? recentActivity.latestCaptures.length : 0)
  );
}

function renderHeroSummary({ engagement, paldeckHealth }) {
  const health = calculateCommunityHealth({ engagement, paldeckHealth });

  setText("communityHealthScore", `${health}`);
  setText("heroPlayers", formatNumber(engagement.totalPlayers));
  setText("heroCaptures", formatNumber(engagement.totalCaptures));
  setText("heroCompletion", formatPercent(paldeckHealth.completionPercentage));
  setText("heroRecentCaptures", formatNumber(engagement.recentCapturesCount));
}

function getOnboardingState({ engagement, recentActivity }) {
  const totalPlayers = Number(engagement.totalPlayers || 0);
  const totalCaptures = Number(engagement.totalCaptures || 0);
  const totalOwnedPals = Number(engagement.totalOwnedPals || 0);
  const dailyQuestActivity = Number(engagement.dailyQuestActivity || 0);
  const latestCaptures = Array.isArray(recentActivity.latestCaptures)
    ? recentActivity.latestCaptures
    : [];
  const latestPlayerActivity = Array.isArray(recentActivity.latestPlayerActivity)
    ? recentActivity.latestPlayerActivity
    : [];
  const hasNoActivity = totalPlayers === 0
    && totalCaptures === 0
    && totalOwnedPals === 0
    && latestCaptures.length === 0
    && latestPlayerActivity.length === 0;
  const isLowActivity = totalPlayers < 3 || totalCaptures < 5;
  const completedSteps = [
    totalPlayers > 0,
    totalCaptures > 0,
    dailyQuestActivity > 0,
    totalCaptures > 0 || latestPlayerActivity.length > 0,
    latestCaptures.length > 0 || latestPlayerActivity.length > 0,
  ].filter(Boolean).length;

  let nextAction = "Recognize top collectors and keep the loop active.";

  if (totalPlayers === 0) {
    nextAction = "Invite the first player to run /start.";
  } else if (totalCaptures === 0) {
    nextAction = "Prompt players to try /capture.";
  } else if (dailyQuestActivity === 0) {
    nextAction = "Remind players to claim /daily and check /quests.";
  } else if (latestCaptures.length === 0) {
    nextAction = "Run a capture prompt so recent activity has something to show.";
  }

  return {
    completedSteps,
    hasNoActivity,
    isLowActivity,
    nextAction,
  };
}

function renderOnboardingPanel({ engagement, recentActivity }) {
  const panel = document.querySelector("#onboardingPanel");
  const state = getOnboardingState({ engagement, recentActivity });

  if (!state.hasNoActivity && !state.isLowActivity) {
    panel.classList.add("is-hidden");
    return;
  }

  panel.classList.remove("is-hidden");
  setText("onboardingProgress", `${state.completedSteps} of 5 steps started`);
  setText("nextRecommendedAction", state.nextAction);
}

function renderOwnerInsights({ engagement, topCollectors, paldeckHealth, recentActivity }) {
  const mostActive = Array.isArray(topCollectors.topCaptures)
    ? topCollectors.topCaptures[0]
    : null;
  const captures = Array.isArray(recentActivity.latestCaptures)
    ? [...recentActivity.latestCaptures]
    : [];
  const rarestCapture = captures.sort((first, second) => {
    const shinyDelta = Number(Boolean(second.isShiny)) - Number(Boolean(first.isShiny));

    if (shinyDelta !== 0) {
      return shinyDelta;
    }

    return getRarityRank(second.rarity) - getRarityRank(first.rarity);
  })[0];
  const completion = Number(paldeckHealth.completionPercentage || 0);
  const totalPlayers = Number(engagement.totalPlayers || 0);
  const recentCapturesCount = Number(engagement.recentCapturesCount || 0);
  const dailyQuestActivity = Number(engagement.dailyQuestActivity || 0);

  setText(
    "mostActiveInsight",
    mostActive
      ? `Spotlight ${mostActive.displayName || mostActive.userId}; they lead the server with ${formatNumber(mostActive.captures)} captures.`
      : "No MVP yet. Invite collectors to start building server history."
  );

  setText(
    "rarestCaptureInsight",
    rarestCapture
      ? `Feature ${rarestCapture.isShiny ? "Shiny " : ""}${rarestCapture.palName || "Unknown Pal"} as a community highlight.`
      : "No recent captures to highlight."
  );

  setText(
    "completionInsight",
    `${formatPercent(completion)} complete. The server owns ${formatNumber(paldeckHealth.uniqueSpeciesOwned)} of ${formatNumber(paldeckHealth.catalogSize)} catalog species.`
  );

  if (totalPlayers === 0) {
    setText("opportunityInsight", "Invite the first collectors and seed the leaderboard.");
  } else if (dailyQuestActivity === 0) {
    setText("opportunityInsight", "Post a quest reminder before reset to pull players back in.");
  } else if (recentCapturesCount === 0) {
    setText("opportunityInsight", "Run a capture prompt to restart collection momentum.");
  } else if (completion < 25) {
    setText("opportunityInsight", "Rally the server around easy missing species to lift Paldeck progress.");
  } else {
    setText("opportunityInsight", "Recognize top collectors and keep the capture loop active.");
  }

  setStatus("insightsStatus", "Insights ready.");
}

async function loadDashboard() {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get("guildId");
  const status = document.querySelector("#dashboardStatus");

  if (!guildId) {
    status.textContent = "Select a server to view metrics.";
    return;
  }

  document.querySelector("#guildName").textContent = "Loading server...";
  status.textContent = "Loading owner overview...";

  const [, engagement, topCollectors, paldeckHealth, recentActivity] = await Promise.all([
    loadGuildIdentity(guildId),
    loadEngagement(guildId),
    loadTopCollectors(guildId),
    loadPaldeckHealth(guildId),
    loadRecentActivity(guildId),
  ]);

  renderOwnerInsights({
    engagement,
    topCollectors,
    paldeckHealth,
    recentActivity,
  });
  renderHeroSummary({ engagement, paldeckHealth });
  renderOnboardingPanel({ engagement, recentActivity });
  status.textContent = "Owner overview loaded.";
}

loadDashboard().catch((error) => {
  document.querySelector("#dashboardStatus").textContent =
    `Unable to load dashboard: ${error.message}`;
});
