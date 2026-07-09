const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Checks if PalMaster is online."),

  async execute(interaction) {
    await interaction.reply("PalMaster is online.");
  },
};
