require("dotenv").config();

const { REST, Routes } = require("discord.js");
const pingCommand = require("./commands/ping");
const captureCommand = require("./commands/capture");
const myPalsCommand = require("./commands/mypals");
const leaderboardCommand = require("./commands/leaderboard");
const profileCommand = require("./commands/profile");
const dailyCommand = require("./commands/daily");
const spawnCommand = require("./commands/spawn");
const inspectCommand = require("./commands/inspect");
const shopCommand = require("./commands/shop");
const buyCommand = require("./commands/buy");
const helpCommand = require("./commands/help");
const startCommand = require("./commands/start");
const questsCommand = require("./commands/quests");

const commands = [
  pingCommand.data.toJSON(),
  captureCommand.data.toJSON(),
  myPalsCommand.data.toJSON(),
  leaderboardCommand.data.toJSON(),
  profileCommand.data.toJSON(),
  dailyCommand.data.toJSON(),
  spawnCommand.data.toJSON(),
  inspectCommand.data.toJSON(),
  shopCommand.data.toJSON(),
  buyCommand.data.toJSON(),
  helpCommand.data.toJSON(),
  startCommand.data.toJSON(),
  questsCommand.data.toJSON(),
];

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function getRegistrationConfig() {
  const token = requireEnv("DISCORD_TOKEN");
  const clientId = requireEnv("DISCORD_CLIENT_ID");
  const scope = (process.env.REGISTER_COMMANDS_SCOPE || "global")
    .trim()
    .toLowerCase();

  if (scope === "guild") {
    const guildId = requireEnv("DISCORD_GUILD_ID");

    return {
      token,
      route: Routes.applicationGuildCommands(clientId, guildId),
      label: `dev guild ${guildId}`,
    };
  }

  return {
    token,
    route: Routes.applicationCommands(clientId),
    label: "global application commands",
  };
}

async function registerCommands() {
  try {
    const config = getRegistrationConfig();
    const rest = new REST({ version: "10" }).setToken(config.token);

    console.log(`🔄 Registering ${commands.length} slash commands to ${config.label}...`);

    await rest.put(config.route, { body: commands });

    console.log(`✅ Slash commands registered to ${config.label}.`);
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
    process.exitCode = 1;
  }
}

registerCommands();
