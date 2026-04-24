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

const commands = [
  pingCommand.data.toJSON(),
  captureCommand.data.toJSON(),
  myPalsCommand.data.toJSON(),
  leaderboardCommand.data.toJSON(),
  profileCommand.data.toJSON(),
  dailyCommand.data.toJSON(),
  spawnCommand.data.toJSON(),
  inspectCommand.data.toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    console.log("🔄 Registering slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
}

registerCommands();
