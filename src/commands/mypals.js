const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { readUserPals } = require("../systems/captureSystem");

function formatCaughtDate(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mypals")
    .setDescription("Show the pals you have captured."),

  async execute(interaction) {
    await interaction.deferReply();

    const allUserPals = readUserPals();
    const userPals = Array.isArray(allUserPals[interaction.user.id])
      ? allUserPals[interaction.user.id]
      : [];

    if (userPals.length === 0) {
      await interaction.editReply(
        "You do not have any pals yet. Use /capture to catch your first one."
      );
      return;
    }

    const recentPals = userPals.slice(-10).reverse();
    const palsList = recentPals
      .map((pal) => {
        return `• ${pal.name} | Lv. ${pal.level} | ${pal.rarity} | ${formatCaughtDate(
          pal.caughtAt
        )}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Pals`)
      .setColor(0x5865f2)
      .addFields(
        {
          name: "Total Count",
          value: `${userPals.length}`,
          inline: true,
        },
        {
          name: "Most Recent Captures",
          value: palsList,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
