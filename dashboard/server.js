#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  getEngagementSnapshot,
  getGuildMetrics,
  getPaldeckHealth,
  getRecentActivity,
  getRetentionSnapshot,
  getTopCollectors,
  listGuilds,
  listInstalledGuildsForDiscordIds,
  upsertDiscordUserIdentity,
} = require("./services/supabaseMetricsService");
const {
  exchangeCodeForToken,
  fetchDiscordGuilds,
  fetchDiscordUser,
  getDiscordAvatarUrl,
  getDiscordOAuthUrl,
  getManageableGuildIds,
} = require("./auth/discordOAuth");
const {
  SESSION_MAX_AGE_SECONDS,
  clearSessionCookie,
  clearStateCookie,
  createOAuthState,
  createSessionCookie,
  createStateCookie,
  readOAuthState,
  readSession,
} = require("./auth/session");
const { getDiscordInstallUrl } = require("./installUrl");
const { createSpawnSettingsService } = require("../src/services/spawnSettingsService");

const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.DASHBOARD_PORT || 3000);
const MAX_JSON_BODY_BYTES = 16_384;
const spawnSettingsService = createSpawnSettingsService();
const PROTECTED_HTML_ROUTES = new Set(["/servers.html", "/dashboard.html"]);
const STATIC_ROUTE_ALIASES = new Map([
  ["/privacy", "privacy.html"],
  ["/terms", "terms.html"],
  ["/contact", "contact.html"],
]);
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
  });
  response.end(html);
}

function redirect(response, location, headers = {}) {
  response.writeHead(302, {
    ...headers,
    location,
  });
  response.end();
}

function sendUnauthorized(response) {
  sendJson(response, 401, { error: "Authentication required." });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (Buffer.byteLength(body) > MAX_JSON_BODY_BYTES) {
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        reject(error);
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        const error = new Error("Request body must be valid JSON.");
        error.statusCode = 400;
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function getAuthorizedGuildIds(session) {
  return Array.isArray(session.authorizedGuildIds) ? session.authorizedGuildIds : [];
}

function canAccessGuild(session, guildId) {
  return getAuthorizedGuildIds(session).includes(guildId);
}

function sendStatic(response, fileName) {
  const safeName = STATIC_ROUTE_ALIASES.get(fileName)
    || (fileName === "/" ? "index.html" : fileName.replace(/^\/+/, ""));
  const filePath = path.join(PUBLIC_DIR, safeName);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": CONTENT_TYPES[path.extname(filePath)] || "text/plain; charset=utf-8",
    });
    response.end(contents);
  });
}

async function handleApi(request, response, url) {
  const session = readSession(request);

  if (!session) {
    sendUnauthorized(response);
    return;
  }

  if (url.pathname === "/api/guilds") {
    sendJson(response, 200, {
      guilds: await listGuilds(getAuthorizedGuildIds(session)),
      user: session.discordUser,
      hasSupabaseConnection: Boolean(process.env.SUPABASE_DB_URL),
    });
    return;
  }

  const metricsMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/metrics$/);
  if (metricsMatch) {
    const guildId = decodeURIComponent(metricsMatch[1]);

    if (!canAccessGuild(session, guildId)) {
      sendJson(response, 403, { error: "Guild access denied." });
      return;
    }

    sendJson(response, 200, {
      guildId,
      metrics: await getGuildMetrics(guildId),
      hasSupabaseConnection: Boolean(process.env.SUPABASE_DB_URL),
    });
    return;
  }

  const engagementMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/engagement$/);
  if (engagementMatch) {
    const guildId = decodeURIComponent(engagementMatch[1]);

    if (!canAccessGuild(session, guildId)) {
      sendJson(response, 403, { error: "Guild access denied." });
      return;
    }

    sendJson(response, 200, {
      guildId,
      engagement: await getEngagementSnapshot(guildId),
      hasSupabaseConnection: Boolean(process.env.SUPABASE_DB_URL),
    });
    return;
  }

  const topCollectorsMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/top-collectors$/);
  if (topCollectorsMatch) {
    const guildId = decodeURIComponent(topCollectorsMatch[1]);

    if (!canAccessGuild(session, guildId)) {
      sendJson(response, 403, { error: "Guild access denied." });
      return;
    }

    sendJson(response, 200, {
      guildId,
      topCollectors: await getTopCollectors(guildId),
      hasSupabaseConnection: Boolean(process.env.SUPABASE_DB_URL),
    });
    return;
  }

  const paldeckMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/paldeck-health$/);
  if (paldeckMatch) {
    const guildId = decodeURIComponent(paldeckMatch[1]);

    if (!canAccessGuild(session, guildId)) {
      sendJson(response, 403, { error: "Guild access denied." });
      return;
    }

    sendJson(response, 200, {
      guildId,
      paldeckHealth: await getPaldeckHealth(guildId),
      hasSupabaseConnection: Boolean(process.env.SUPABASE_DB_URL),
    });
    return;
  }

  const recentActivityMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/recent-activity$/);
  if (recentActivityMatch) {
    const guildId = decodeURIComponent(recentActivityMatch[1]);

    if (!canAccessGuild(session, guildId)) {
      sendJson(response, 403, { error: "Guild access denied." });
      return;
    }

    sendJson(response, 200, {
      guildId,
      recentActivity: await getRecentActivity(guildId),
      hasSupabaseConnection: Boolean(process.env.SUPABASE_DB_URL),
    });
    return;
  }

  const retentionMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/retention$/);
  if (retentionMatch) {
    const guildId = decodeURIComponent(retentionMatch[1]);

    if (!canAccessGuild(session, guildId)) {
      sendJson(response, 403, { error: "Guild access denied." });
      return;
    }

    sendJson(response, 200, {
      guildId,
      retention: await getRetentionSnapshot(guildId),
      hasSupabaseConnection: Boolean(process.env.SUPABASE_DB_URL),
    });
    return;
  }

  const spawnSettingsMatch = url.pathname.match(/^\/api\/guilds\/([^/]+)\/spawn-settings$/);
  if (spawnSettingsMatch) {
    const guildId = decodeURIComponent(spawnSettingsMatch[1]);

    if (!canAccessGuild(session, guildId)) {
      sendJson(response, 403, { error: "Guild access denied." });
      return;
    }

    if (request.method === "GET") {
      try {
        sendJson(response, 200, {
          guildId,
          settings: await spawnSettingsService.getSpawnSettings(guildId),
          hasSupabaseConnection: spawnSettingsService.isConfigured(),
        });
      } catch (error) {
        console.error(
          `[dashboard:spawn-settings] load failed guild=${guildId} code=${error?.code || "none"}`,
          error
        );
        throw error;
      }
      return;
    }

    if (request.method === "PUT") {
      if (!spawnSettingsService.isConfigured()) {
        sendJson(response, 503, { error: "Spawn settings require Supabase." });
        return;
      }

      let settings;

      try {
        const body = await readJsonBody(request);
        settings = await spawnSettingsService.updateSpawnSettings(guildId, body);
      } catch (error) {
        console.error(
          `[dashboard:spawn-settings] save failed guild=${guildId} code=${error?.code || "none"} status=${error?.statusCode || 500}`,
          error
        );
        throw error;
      }

      sendJson(response, 200, {
        guildId,
        settings,
        hasSupabaseConnection: true,
      });
      return;
    }

    response.writeHead(405, { allow: "GET, PUT" });
    response.end("Method not allowed");
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function handleDiscordAuth(response) {
  const state = createOAuthState();

  redirect(response, getDiscordOAuthUrl(state), {
    "set-cookie": createStateCookie(state),
  });
}

async function handleDiscordCallback(request, response, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readOAuthState(request);

  if (!code || !state || !expectedState || state !== expectedState) {
    redirect(response, "/?error=oauth_state", {
      "set-cookie": clearStateCookie(),
    });
    return;
  }

  const token = await exchangeCodeForToken(code);
  const [discordUser, discordGuilds] = await Promise.all([
    fetchDiscordUser(token.access_token),
    fetchDiscordGuilds(token.access_token),
  ]);
  const manageableGuildIds = getManageableGuildIds(discordGuilds);
  const installedGuilds = await listInstalledGuildsForDiscordIds(manageableGuildIds);
  const authorizedGuildIds = installedGuilds.map((guild) => guild.id);
  const avatarUrl = getDiscordAvatarUrl(discordUser);

  await upsertDiscordUserIdentity({
    id: discordUser.id,
    username: discordUser.username,
    globalName: discordUser.global_name || discordUser.username || null,
    avatarUrl,
  });

  const now = Date.now();
  const session = {
    discordUser: {
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name || discordUser.username || null,
      avatarUrl,
    },
    authorizedGuildIds,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };

  redirect(response, "/servers.html", {
    "set-cookie": [createSessionCookie(session), clearStateCookie()],
  });
}

function sendLaunchPlaceholder(response, {
  title,
  eyebrow,
  description,
  actions,
  steps = [],
}) {
  const actionLinks = actions
    .map((action) => `<a class="button ${action.className || ""}" href="${action.href}">${action.label}</a>`)
    .join("");
  const stepList = steps.length > 0
    ? `<ol class="onboarding-list">${steps.map((step) => `<li>${step}</li>`).join("")}</ol>`
    : "";

  sendHtml(response, 200, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main class="layout">
      <section class="launch-panel">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p>${description}</p>
        ${stepList}
        <div class="cta-row">${actionLinks}</div>
      </section>
    </main>
    <footer class="site-footer">
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
      <a href="/contact">Contact</a>
      <a href="/support" target="_blank" rel="noopener noreferrer external">Join Community</a>
    </footer>
  </body>
</html>`);
}

function handleInstall(response) {
  const installUrl = getDiscordInstallUrl();

  if (installUrl) {
    redirect(response, installUrl);
    return;
  }

  sendLaunchPlaceholder(response, {
    title: "PalMaster Install Coming Soon",
    eyebrow: "Add PalMaster to Discord",
    description: "The public PalMaster install link is not configured yet. Once installed, the first activity loop should get players into captures, quests, and dashboard-visible engagement quickly.",
    actions: [
      { href: "/login.html", label: "Open Dashboard", className: "button-secondary" },
      { href: "/", label: "Back to Home", className: "button-ghost" },
    ],
    steps: [
      "Run /start so players can claim starter rewards.",
      "Try /capture to seed the first collection activity.",
      "Claim /daily to introduce the reward loop.",
      "Check /quests so players understand daily progress.",
      "Return to the dashboard once players interact.",
    ],
  });
}

function handleSupport(response) {
  if (process.env.SUPPORT_SERVER_URL) {
    redirect(response, process.env.SUPPORT_SERVER_URL);
    return;
  }

  sendLaunchPlaceholder(response, {
    title: "PalMaster Support Coming Soon",
    eyebrow: "Community support",
    description: "The public support link is not configured yet. Configure SUPPORT_SERVER_URL before broad public promotion so server owners have a clear help path.",
    actions: [
      { href: "/", label: "Back to Home", className: "button-ghost" },
    ],
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    if (url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "palmaster-dashboard",
      });
      return;
    }

    if (url.pathname === "/auth/discord") {
      await handleDiscordAuth(response);
      return;
    }

    if (url.pathname === "/auth/discord/callback") {
      await handleDiscordCallback(request, response, url);
      return;
    }

    if (url.pathname === "/install") {
      handleInstall(response);
      return;
    }

    if (url.pathname === "/support") {
      handleSupport(response);
      return;
    }

    if (url.pathname === "/logout") {
      redirect(response, "/", {
        "set-cookie": clearSessionCookie(),
      });
      return;
    }

    if (PROTECTED_HTML_ROUTES.has(url.pathname) && !readSession(request)) {
      redirect(response, "/");
      return;
    }

    sendStatic(response, url.pathname);
  } catch (error) {
    console.error("[dashboard] request failed:", error);
    sendJson(response, error.statusCode || 500, {
      error: error.statusCode ? error.message : "Dashboard request failed.",
      validationErrors: error.validationErrors,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Owner dashboard listening on http://localhost:${PORT}`);
  console.log(`Supabase metrics enabled: ${Boolean(process.env.SUPABASE_DB_URL)}`);
});
