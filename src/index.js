require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const pingCommand = require("./commands/ping");
const captureCommand = require("./commands/capture");
const myPalsCommand = require("./commands/mypals");
const leaderboardCommand = require("./commands/leaderboard");
const profileCommand = require("./commands/profile");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.commands.set(pingCommand.data.name, pingCommand);
client.commands.set(captureCommand.data.name, captureCommand);
client.commands.set(myPalsCommand.data.name, myPalsCommand);
client.commands.set(leaderboardCommand.data.name, leaderboardCommand);
client.commands.set(profileCommand.data.name, profileCommand);

client.once("ready", () => {
  console.log(`✅ Palworld Bot online as ${client.user.tag}`);
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
