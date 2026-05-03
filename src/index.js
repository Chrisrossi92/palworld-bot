require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
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
const { startSpawnSystem } = require("./systems/spawnSystem");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.commands.set(pingCommand.data.name, pingCommand);
client.commands.set(captureCommand.data.name, captureCommand);
client.commands.set(myPalsCommand.data.name, myPalsCommand);
client.commands.set(leaderboardCommand.data.name, leaderboardCommand);
client.commands.set(profileCommand.data.name, profileCommand);
client.commands.set(dailyCommand.data.name, dailyCommand);
client.commands.set(spawnCommand.data.name, spawnCommand);
client.commands.set(inspectCommand.data.name, inspectCommand);
client.commands.set(shopCommand.data.name, shopCommand);
client.commands.set(buyCommand.data.name, buyCommand);
client.commands.set(helpCommand.data.name, helpCommand);
client.commands.set(startCommand.data.name, startCommand);

client.once("ready", () => {
  console.log(`✅ Palworld Bot online as ${client.user.tag}`);
  startSpawnSystem(client);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ Something went wrong running that command.",
        });
      } else if (interaction.replied) {
        await interaction.followUp({
          content: "❌ Something went wrong running that command.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Something went wrong running that command.",
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error("Failed to send interaction error response:", replyError);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
