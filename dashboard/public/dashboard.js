function setText(id, value) {
  const element = document.querySelector(`#${id}`);

  if (!element) {
    return;
  }

  element.textContent = String(value);
}

const DEFAULT_ACTIVITY_LIMIT = 5;
let fullActivityFeedRows = [];

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

function formatShortDateTime(value) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No activity yet";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pluralize(count, singular, plural = `${singular}s`) {
  return Number(count || 0) === 1 ? singular : plural;
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

async function sendJson(path, payload) {
  const response = await fetch(path, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const responsePayload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(responsePayload.error || "Dashboard API request failed.");
  }

  return responsePayload;
}

function setStatus(id, text, isError = false) {
  const element = document.querySelector(`#${id}`);

  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.toggle("status-error", isError);
}

function renderEmptyList(id, text) {
  const element = document.querySelector(`#${id}`);

  if (!element) {
    return;
  }

  element.innerHTML = "";

  const item = document.createElement("li");
  item.className = "muted";
  item.textContent = text;
  element.append(item);
}

function renderRankedList(id, rows, emptyText, formatter) {
  const element = document.querySelector(`#${id}`);

  if (!element) {
    return;
  }

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

  if (!element) {
    return;
  }

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

function getPalInitial(palName) {
  const trimmed = String(palName || "").trim();

  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function createPalThumb(row, className = "") {
  const thumb = document.createElement("div");
  const imageUrl = typeof row.imageUrl === "string" ? row.imageUrl.trim() : "";

  thumb.className = `pal-thumb ${className}`.trim();
  thumb.setAttribute("aria-hidden", "true");

  if (imageUrl) {
    const image = document.createElement("img");

    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      thumb.innerHTML = "";
      thumb.textContent = getPalInitial(row.palName);
      thumb.classList.add("pal-thumb-fallback");
    });
    thumb.append(image);
    return thumb;
  }

  thumb.textContent = getPalInitial(row.palName);
  thumb.classList.add("pal-thumb-fallback");
  return thumb;
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
    const topCollector = Array.isArray(topCollectors.topCaptures)
      ? topCollectors.topCaptures[0]
      : null;

    setText(
      "topCollectorName",
      topCollector?.displayName || topCollector?.userId || "No collector yet"
    );
    setText(
      "topCollectorDetail",
      topCollector
        ? `${formatNumber(topCollector.captures)} ${pluralize(topCollector.captures, "capture")} recorded.`
        : "Waiting for the first capture."
    );
    setText("shinyCollectorsCount", formatNumber(topCollectors.shinyCollectorsCount));
    setStatus(
      "collectorsStatus",
      payload.hasSupabaseConnection ? "Collector data loaded." : "No Supabase connection."
    );
    return topCollectors;
  } catch (error) {
    setStatus("collectorsStatus", error.message, true);
    setText("topCollectorName", "Unavailable");
    setText("topCollectorDetail", "Unable to load collector data.");
    return {};
  }
}

async function loadPaldeckHealth(guildId) {
  try {
    const payload = await fetchJson(`/api/guilds/${encodeURIComponent(guildId)}/paldeck-health`);
    const paldeckHealth = payload.paldeckHealth || {};
    const completion = Number(paldeckHealth.completionPercentage || 0);

    setText("catalogSize", formatNumber(paldeckHealth.catalogSize));
    setText("uniqueSpeciesOwned", formatNumber(paldeckHealth.uniqueSpeciesOwned));
    setText(
      "paldeckSpeciesRatio",
      `${formatNumber(paldeckHealth.uniqueSpeciesOwned)} / ${formatNumber(paldeckHealth.catalogSize)}`
    );
    setText("completionPercentage", formatPercent(completion));
    const progressBar = document.querySelector("#paldeckProgressBar");

    if (progressBar) {
      progressBar.style.width = `${Math.max(0, Math.min(100, completion))}%`;
    }
    setStatus(
      "paldeckStatus",
      payload.hasSupabaseConnection ? "Paldeck health loaded." : "No Supabase connection."
    );
    return paldeckHealth;
  } catch (error) {
    setStatus("paldeckStatus", error.message, true);
    setText("paldeckSpeciesRatio", "0 / 0");
    setText("catalogSize", "0");
    setText("uniqueSpeciesOwned", "0");
    setText("completionPercentage", "0%");
    const progressBar = document.querySelector("#paldeckProgressBar");

    if (progressBar) {
      progressBar.style.width = "0%";
    }
    return {};
  }
}

async function loadRecentActivity(guildId) {
  try {
    const payload = await fetchJson(`/api/guilds/${encodeURIComponent(guildId)}/recent-activity`);
    const recentActivity = payload.recentActivity || {};
    fullActivityFeedRows = buildActivityFeed(recentActivity);

    renderActivitySummary(recentActivity);
    renderActivityFeed(false);
    setStatus(
      "activityStatus",
      payload.hasSupabaseConnection ? "Recent activity loaded." : "No Supabase connection."
    );
    return recentActivity;
  } catch (error) {
    setStatus("activityStatus", error.message, true);
    fullActivityFeedRows = [];
    renderEmptyList("serverActivityFeed", "Unable to load server activity.");
    const showMoreButton = document.querySelector("#showMoreActivity");

    if (showMoreButton) {
      showMoreButton.hidden = true;
    }
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
        type: "capture",
        timestamp: row.caughtAt,
        imageUrl: row.imageUrl || "",
        palName: row.palName || "Unknown Pal",
        rarity: row.rarity || "unknown",
        level: Number(row.level || 1),
        isShiny: Boolean(row.isShiny),
        playerName: row.displayName || row.userId || "Unknown player",
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

function renderCaptureActivityItem(item, row) {
  const thumb = createPalThumb(row);
  const body = document.createElement("div");
  const topLine = document.createElement("div");
  const palName = document.createElement("span");
  const meta = document.createElement("span");
  const secondary = document.createElement("div");

  item.classList.add("capture-activity-row");
  body.className = "capture-activity-body";
  topLine.className = "capture-activity-topline";
  palName.className = "activity-primary";
  meta.className = "capture-meta";
  secondary.className = "activity-secondary";

  palName.textContent = row.palName;
  meta.textContent = `${row.isShiny ? "Shiny " : ""}${row.rarity} • Lv. ${formatNumber(row.level)}`;
  secondary.textContent = `${row.playerName} • ${formatRelativeTime(row.timestamp)}`;

  topLine.append(palName, meta);
  body.append(topLine, secondary);
  item.append(thumb, body);
}

function renderActivityFeed(showAll) {
  const rows = showAll
    ? fullActivityFeedRows
    : fullActivityFeedRows.slice(0, DEFAULT_ACTIVITY_LIMIT);
  const button = document.querySelector("#showMoreActivity");
  const element = document.querySelector("#serverActivityFeed");

  if (!element) {
    return;
  }

  element.innerHTML = "";

  if (rows.length === 0) {
    renderEmptyList("serverActivityFeed", "No recent server activity yet.");
  } else {
    for (const row of rows) {
      const item = document.createElement("li");

      item.className = `timeline-item ${row.highlightClass || ""}`.trim();

      if (row.type === "capture") {
        renderCaptureActivityItem(item, row);
      } else {
        const badge = document.createElement("span");
        const primary = document.createElement("div");
        const secondary = document.createElement("div");

        badge.className = `event-badge ${row.badgeClass || ""}`.trim();
        primary.className = "activity-primary";
        secondary.className = "activity-secondary";
        badge.textContent = row.badge;
        primary.textContent = row.primary;
        secondary.textContent = row.secondary;
        item.append(badge, primary, secondary);
      }

      element.append(item);
    }
  }

  if (!button) {
    return;
  }

  if (fullActivityFeedRows.length > DEFAULT_ACTIVITY_LIMIT) {
    button.hidden = false;
    button.textContent = showAll ? "Show less" : "Show more";
  } else {
    button.hidden = true;
  }
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

function selectBestRecentCatch(recentActivity) {
  const captures = Array.isArray(recentActivity.latestCaptures)
    ? [...recentActivity.latestCaptures]
    : [];

  return captures
    .filter((row) => row && row.caughtAt)
    .sort((first, second) => {
      const shinyDelta = Number(Boolean(second.isShiny)) - Number(Boolean(first.isShiny));

      if (shinyDelta !== 0) {
        return shinyDelta;
      }

      const rarityDelta = getRarityRank(second.rarity) - getRarityRank(first.rarity);

      if (rarityDelta !== 0) {
        return rarityDelta;
      }

      return new Date(second.caughtAt).getTime() - new Date(first.caughtAt).getTime();
    })[0] || null;
}

function renderBestRecentCatch(recentActivity) {
  const catchRow = selectBestRecentCatch(recentActivity);
  const imageSlot = document.querySelector("#bestCatchImage");

  if (!imageSlot) {
    return;
  }

  imageSlot.innerHTML = "";

  if (!catchRow) {
    imageSlot.textContent = "?";
    imageSlot.className = "pal-thumb pal-thumb-large pal-thumb-fallback";
    setText("bestCatchName", "No captures yet");
    setText("bestCatchMeta", "Waiting for the first catch.");
    setText("bestCatchPlayer", "");
    return;
  }

  const thumb = createPalThumb(catchRow, "pal-thumb-large");

  imageSlot.replaceWith(thumb);
  thumb.id = "bestCatchImage";
  setText("bestCatchName", catchRow.isShiny ? `Shiny ${catchRow.palName || "Unknown Pal"}` : catchRow.palName || "Unknown Pal");
  setText(
    "bestCatchMeta",
    `${catchRow.rarity || "unknown"} • Lv. ${formatNumber(catchRow.level)} • ${formatRelativeTime(catchRow.caughtAt)}`
  );
  setText("bestCatchPlayer", `Caught by ${catchRow.displayName || catchRow.userId || "Unknown player"}`);
}

function renderHeroSummary({ engagement, paldeckHealth }) {
  const health = calculateCommunityHealth({ engagement, paldeckHealth });

  setText("communityHealthScore", `${health}`);
  setText("heroPlayers", formatNumber(engagement.totalPlayers));
  setText("heroCaptures", formatNumber(engagement.totalCaptures));
  setText("heroRecentCaptures", formatNumber(engagement.recentCapturesCount));
}

function getSpawnSettingsForm() {
  return document.querySelector("#spawnSettingsForm");
}

function setSpawnSettingsFormDisabled(disabled) {
  const form = getSpawnSettingsForm();

  if (!form) {
    return;
  }

  for (const element of form.elements) {
    element.disabled = disabled;
  }
}

function getSpawnSettingsPayload() {
  return {
    enabled: document.querySelector("#spawnEnabled").checked,
    channelId: document.querySelector("#spawnChannelId").value.trim() || null,
    intervalMinutes: Number(document.querySelector("#spawnIntervalMinutes").value),
  };
}

function validateSpawnSettingsPayload(payload) {
  const errors = [];

  if (payload.enabled && !payload.channelId) {
    errors.push("Channel ID is required when public spawns are enabled.");
  }

  if (!Number.isInteger(payload.intervalMinutes) || payload.intervalMinutes < 30) {
    errors.push("Interval must be at least 30 minutes.");
  }

  return errors;
}

function renderSpawnSettings(settings = {}, hasSupabaseConnection = false) {
  document.querySelector("#spawnEnabled").checked = Boolean(settings.enabled);
  document.querySelector("#spawnChannelId").value = settings.channelId || "";
  document.querySelector("#spawnIntervalMinutes").value = String(settings.intervalMinutes || 60);

  setText(
    "spawnSettingsDetail",
    settings.enabled
      ? `Next spawn ${formatShortDateTime(settings.nextSpawnAt)}. Last spawn ${formatShortDateTime(settings.lastSpawnAt)}.`
      : "Public random spawns are disabled."
  );
  setStatus(
    "spawnSettingsStatus",
    hasSupabaseConnection ? "Settings loaded." : "Supabase is required to save settings.",
    !hasSupabaseConnection
  );
  setSpawnSettingsFormDisabled(!hasSupabaseConnection);
}

async function loadSpawnSettings(guildId) {
  try {
    const payload = await fetchJson(`/api/guilds/${encodeURIComponent(guildId)}/spawn-settings`);

    renderSpawnSettings(payload.settings || {}, payload.hasSupabaseConnection);
    return payload.settings || {};
  } catch (error) {
    setStatus("spawnSettingsStatus", error.message, true);
    setText("spawnSettingsDetail", "Unable to load public spawn settings.");
    setSpawnSettingsFormDisabled(true);
    return {};
  }
}

function bindSpawnSettingsForm(guildId) {
  const form = getSpawnSettingsForm();

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = getSpawnSettingsPayload();
    const errors = validateSpawnSettingsPayload(payload);

    if (errors.length > 0) {
      setStatus("spawnSettingsStatus", errors.join(" "), true);
      return;
    }

    setStatus("spawnSettingsStatus", "Saving...");
    setSpawnSettingsFormDisabled(true);

    try {
      const response = await sendJson(
        `/api/guilds/${encodeURIComponent(guildId)}/spawn-settings`,
        payload
      );

      renderSpawnSettings(response.settings || {}, response.hasSupabaseConnection);
      setStatus("spawnSettingsStatus", "Settings saved.");
    } catch (error) {
      setStatus("spawnSettingsStatus", error.message, true);
      setSpawnSettingsFormDisabled(false);
    }
  });
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
  const alwaysVisible = panel?.dataset.alwaysVisible === "true";

  if (!panel) {
    return;
  }

  if (!alwaysVisible && !state.hasNoActivity && !state.isLowActivity) {
    panel.classList.add("is-hidden");
    return;
  }

  panel.classList.remove("is-hidden");
  setText("onboardingProgress", `${state.completedSteps} of 5 steps started`);
  setText("nextRecommendedAction", state.nextAction);
}

function renderOwnerInsights({ engagement, topCollectors, paldeckHealth, recentActivity }) {
  const completion = Number(paldeckHealth.completionPercentage || 0);
  const totalPlayers = Number(engagement.totalPlayers || 0);
  const recentCapturesCount = Number(engagement.recentCapturesCount || 0);
  const dailyQuestActivity = Number(engagement.dailyQuestActivity || 0);

  renderBestRecentCatch(recentActivity);

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
  bindSpawnSettingsForm(guildId);
  document.querySelector("#showMoreActivity").addEventListener("click", (event) => {
    const showAll = event.currentTarget.textContent === "Show more";

    renderActivityFeed(showAll);
  });

  const [, engagement, topCollectors, paldeckHealth, recentActivity] = await Promise.all([
    loadGuildIdentity(guildId),
    loadEngagement(guildId),
    loadTopCollectors(guildId),
    loadPaldeckHealth(guildId),
    loadRecentActivity(guildId),
    loadSpawnSettings(guildId),
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
