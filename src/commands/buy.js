const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { buySpheres } = require("../systems/captureSystem");

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
    .setName("buy")
    .setDescription("Buy spheres with coins.")
    .addStringOption((option) => {
      option
        .setName("sphere")
        .setDescription("The sphere type to buy.")
        .setRequired(true);

      for (const [name, value] of sphereChoices) {
        option.addChoices({ name, value });
      }

      return option;
    })
    .addIntegerOption((option) =>
      option
        .setName("quantity")
        .setDescription("How many spheres to buy.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const sphere = interaction.options.getString("sphere");
    const quantity = interaction.options.getInteger("quantity");
    const result = buySpheres(interaction.user.id, sphere, quantity);

    if (!result.success) {
      await interaction.editReply(
        `❌ You need ${result.totalCost} coins but only have ${result.coins}.`
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Purchase Complete")
      .setColor(0x57f287)
      .addFields(
        {
          name: "Sphere Purchased",
          value: result.sphere,
          inline: true,
        },
        {
          name: "Quantity",
          value: `${result.quantity}`,
          inline: true,
        },
        {
          name: "Total Cost",
          value: `${result.totalCost} coins`,
          inline: true,
        },
        {
          name: "Remaining Coins",
          value: `${result.coins}`,
          inline: true,
        },
        {
          name: "Updated Sphere Count",
          value: `${result.updatedSphereCount}`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
