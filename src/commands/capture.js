const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { attemptCapture } = require("../systems/captureSystem");

const sphereChoices = [
  ["Basic", "basic"],
  ["Mega", "mega"],
  ["Giga", "giga"],
  ["Hyper", "hyper"],
  ["Ultra", "ultra"],
  ["Legendary", "legendary"],
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("capture")
    .setDescription("Encounter and attempt to capture a wild Pal.")
    .addStringOption((option) => {
      option
        .setName("sphere")
        .setDescription("Choose which sphere to use.")
        .setRequired(false);

      for (const [name, value] of sphereChoices) {
        option.addChoices({ name, value });
      }

      return option;
    }),

  async execute(interaction) {
    const sphere = interaction.options.getString("sphere") || "basic";
    const result = attemptCapture(interaction.user.id, sphere);

    const embed = new EmbedBuilder()
      .setTitle("Wild Pal Encounter")
      .setColor(result.success ? 0x57f287 : 0xed4245)
      .addFields(
        {
          name: "Wild Pal",
          value: `${result.pal.name} (Lv. ${result.pal.level}, ${result.pal.rarity})`,
        },
        {
          name: "Sphere Used",
          value: result.sphere,
          inline: true,
        },
        {
          name: "Capture Chance",
          value: `${result.captureChance}%`,
          inline: true,
        },
        {
          name: "Result",
          value: result.success
            ? "Success! The Pal was captured."
            : "Failure! The Pal broke free.",
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
