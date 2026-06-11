const test = require("node:test");
const assert = require("node:assert/strict");
const { Routes } = require("discord.js");
const {
  commandPayloads,
  getCommandRegistrationConfig,
  registerConfiguredCommands,
  registerGuildCommands,
} = require("../src/commandRegistration");

function createMockRest(calls) {
  return {
    async put(route, payload) {
      calls.push({ route, payload });
      return [];
    },
  };
}

test("command payloads include PalMaster gameplay commands", () => {
  const names = commandPayloads.map((command) => command.name);

  assert.ok(names.includes("capture"));
  assert.ok(names.includes("daily"));
  assert.ok(names.includes("profile"));
  assert.ok(names.includes("leaderboard"));
  assert.ok(names.includes("buy"));
});

test("configured command registration defaults to global application commands", () => {
  const config = getCommandRegistrationConfig({
    DISCORD_TOKEN: "token",
    DISCORD_CLIENT_ID: "client-1",
  });

  assert.equal(config.route, Routes.applicationCommands("client-1"));
  assert.equal(config.label, "global application commands");
});

test("configured command registration preserves single-guild dev workflow", () => {
  const config = getCommandRegistrationConfig({
    DISCORD_TOKEN: "token",
    DISCORD_CLIENT_ID: "client-1",
    REGISTER_COMMANDS_SCOPE: "guild",
    DISCORD_GUILD_ID: "guild-1",
  });

  assert.equal(config.route, Routes.applicationGuildCommands("client-1", "guild-1"));
  assert.equal(config.label, "dev guild guild-1");
});

test("guild join registration writes all commands to the joined guild", async () => {
  const calls = [];

  await registerGuildCommands("guild-2", {
    env: {
      DISCORD_TOKEN: "token",
      DISCORD_CLIENT_ID: "client-1",
    },
    restFactory() {
      return createMockRest(calls);
    },
    logger: { log() {} },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].route, Routes.applicationGuildCommands("client-1", "guild-2"));
  assert.deepEqual(calls[0].payload, { body: commandPayloads });
});

test("manual registration uses configured route and command payloads", async () => {
  const calls = [];

  await registerConfiguredCommands({
    env: {
      DISCORD_TOKEN: "token",
      DISCORD_CLIENT_ID: "client-1",
      REGISTER_COMMANDS_SCOPE: "guild",
      DISCORD_GUILD_ID: "guild-1",
    },
    restFactory() {
      return createMockRest(calls);
    },
    logger: { log() {} },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].route, Routes.applicationGuildCommands("client-1", "guild-1"));
  assert.deepEqual(calls[0].payload, { body: commandPayloads });
});
