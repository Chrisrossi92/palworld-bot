const { REST, Routes } = require("discord.js");
const { commandPayloads } = require("./commands");

function requireEnv(name, env = process.env) {
  const value = env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function getCommandRegistrationConfig(env = process.env) {
  const token = requireEnv("DISCORD_TOKEN", env);
  const clientId = requireEnv("DISCORD_CLIENT_ID", env);
  const scope = (env.REGISTER_COMMANDS_SCOPE || "global").trim().toLowerCase();

  if (scope === "guild") {
    const guildId = requireEnv("DISCORD_GUILD_ID", env);

    return {
      token,
      route: Routes.applicationGuildCommands(clientId, guildId),
      label: `dev guild ${guildId}`,
      scope,
    };
  }

  return {
    token,
    route: Routes.applicationCommands(clientId),
    label: "global application commands",
    scope: "global",
  };
}

function createCommandRest(token) {
  return new REST({ version: "10" }).setToken(token);
}

async function putCommandPayloads(rest, route) {
  return rest.put(route, { body: commandPayloads });
}

async function registerConfiguredCommands({
  env = process.env,
  restFactory = createCommandRest,
  logger = console,
} = {}) {
  const config = getCommandRegistrationConfig(env);
  const rest = restFactory(config.token);

  logger.log(`🔄 Registering ${commandPayloads.length} slash commands to ${config.label}...`);

  await putCommandPayloads(rest, config.route);

  logger.log(`✅ Slash commands registered to ${config.label}.`);

  return config;
}

async function registerGuildCommands(guildId, {
  env = process.env,
  restFactory = createCommandRest,
  logger = console,
} = {}) {
  const token = requireEnv("DISCORD_TOKEN", env);
  const clientId = requireEnv("DISCORD_CLIENT_ID", env);
  const route = Routes.applicationGuildCommands(clientId, guildId);
  const rest = restFactory(token);
  const label = `guild ${guildId}`;

  logger.log(`[commands] Registering ${commandPayloads.length} slash commands to ${label}...`);

  await putCommandPayloads(rest, route);

  logger.log(`[commands] Registered ${commandPayloads.length} slash commands to ${label}.`);

  return {
    route,
    label,
  };
}

module.exports = {
  commandPayloads,
  getCommandRegistrationConfig,
  registerConfiguredCommands,
  registerGuildCommands,
  requireEnv,
};
