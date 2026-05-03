const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { spherePrices } = require("../systems/captureSystem");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Show available sphere prices."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setTitle("Sphere Shop")
      .setColor(0xf1c40f)
      .setDescription(
        `Basic: ${spherePrices.basic} coins
Mega: ${spherePrices.mega} coins
Giga: ${spherePrices.giga} coins
Hyper: ${spherePrices.hyper} coins
Ultra: ${spherePrices.ultra} coins
Legendary: ${spherePrices.legendary} coins`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
