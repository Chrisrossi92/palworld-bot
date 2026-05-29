const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const ADMINISTRATOR_PERMISSION = 0x8n;
const MANAGE_GUILD_PERMISSION = 0x20n;

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Discord OAuth.`);
  }

  return value;
}

function getDashboardBaseUrl() {
  return (
    process.env.DASHBOARD_BASE_URL ||
    `http://localhost:${Number(process.env.DASHBOARD_PORT || 3000)}`
  ).replace(/\/+$/g, "");
}

function getRedirectUri() {
  return `${getDashboardBaseUrl()}/auth/discord/callback`;
}

function getDiscordOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: requireEnv("DISCORD_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "identify guilds",
    state,
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function fetchJson(url, options = {}) {
  if (typeof fetch !== "function") {
    throw new Error("Dashboard OAuth requires a Node.js runtime with fetch support.");
  }

  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error_description || payload.message || "Discord API request failed.");
  }

  return payload;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: requireEnv("DISCORD_CLIENT_ID"),
    client_secret: requireEnv("DISCORD_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  });

  return fetchJson(`${DISCORD_API_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

async function fetchDiscordUser(accessToken) {
  return fetchJson(`${DISCORD_API_BASE_URL}/users/@me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

async function fetchDiscordGuilds(accessToken) {
  return fetchJson(`${DISCORD_API_BASE_URL}/users/@me/guilds`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

function canManageGuild(guild) {
  if (guild.owner) {
    return true;
  }

  const permissions = BigInt(guild.permissions || 0);

  return (
    (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION ||
    (permissions & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION
  );
}

function getManageableGuildIds(guilds) {
  return guilds.filter(canManageGuild).map((guild) => guild.id);
}

function getDiscordAvatarUrl(user) {
  if (!user.avatar) {
    return null;
  }

  const extension = user.avatar.startsWith("a_") ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}`;
}

module.exports = {
  exchangeCodeForToken,
  fetchDiscordGuilds,
  fetchDiscordUser,
  getDiscordAvatarUrl,
  getDiscordOAuthUrl,
  getManageableGuildIds,
  getRedirectUri,
};
