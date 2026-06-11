const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_DISCORD_BOT_PERMISSIONS,
  DISCORD_BOT_INSTALL_SCOPE,
  getDiscordInstallUrl,
} = require("../dashboard/installUrl");

test("dashboard install URL builds Discord bot install OAuth from client id", () => {
  const installUrl = getDiscordInstallUrl({
    DISCORD_CLIENT_ID: "1496971693669748787",
    DISCORD_BOT_PERMISSIONS: "12345",
  });
  const url = new URL(installUrl);

  assert.equal(url.origin + url.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "1496971693669748787");
  assert.equal(url.searchParams.get("scope"), DISCORD_BOT_INSTALL_SCOPE);
  assert.equal(url.searchParams.get("permissions"), "12345");
});

test("dashboard install URL normalizes configured client-only Discord invite URL", () => {
  const installUrl = getDiscordInstallUrl({
    DISCORD_BOT_INVITE_URL: "https://discord.com/oauth2/authorize?client_id=1496971693669748787",
  });
  const url = new URL(installUrl);

  assert.equal(url.searchParams.get("client_id"), "1496971693669748787");
  assert.equal(url.searchParams.get("scope"), DISCORD_BOT_INSTALL_SCOPE);
  assert.equal(url.searchParams.get("permissions"), DEFAULT_DISCORD_BOT_PERMISSIONS);
});
