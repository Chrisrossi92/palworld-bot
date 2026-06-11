const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_BOT_INSTALL_SCOPE = "bot applications.commands";
const DEFAULT_DISCORD_BOT_PERMISSIONS = "379904";

function isDiscordAuthorizeUrl(url) {
  return (
    (url.hostname === "discord.com" || url.hostname === "discordapp.com") &&
    (url.pathname === "/oauth2/authorize" || url.pathname === "/api/oauth2/authorize")
  );
}

function getDiscordBotPermissions(env = process.env, searchParams = null) {
  return (
    env.DISCORD_BOT_PERMISSIONS ||
    (searchParams && searchParams.get("permissions")) ||
    DEFAULT_DISCORD_BOT_PERMISSIONS
  );
}

function normalizeDiscordInstallUrl(inviteUrl, env = process.env) {
  let url;

  try {
    url = new URL(inviteUrl);
  } catch {
    return inviteUrl;
  }

  if (!isDiscordAuthorizeUrl(url)) {
    return inviteUrl;
  }

  url.searchParams.set("scope", DISCORD_BOT_INSTALL_SCOPE);
  url.searchParams.set("permissions", getDiscordBotPermissions(env, url.searchParams));

  return url.toString();
}

function getDiscordInstallUrl(env = process.env) {
  if (env.DISCORD_BOT_INVITE_URL) {
    return normalizeDiscordInstallUrl(env.DISCORD_BOT_INVITE_URL, env);
  }

  if (!env.DISCORD_CLIENT_ID) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    scope: DISCORD_BOT_INSTALL_SCOPE,
    permissions: getDiscordBotPermissions(env),
  });

  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}

module.exports = {
  DEFAULT_DISCORD_BOT_PERMISSIONS,
  DISCORD_BOT_INSTALL_SCOPE,
  getDiscordInstallUrl,
  normalizeDiscordInstallUrl,
};
