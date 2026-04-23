require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const pingCommand = require("./commands/ping");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.commands.set(pingCommand.data.name, pingCommand);

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
      if (interaction.replied || interaction.deferred) {
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
