const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Checks if the Palworld bot is online."),

  async execute(interaction) {
    await interaction.reply("🏝️ Palworld Bot is alive.");
  },
};