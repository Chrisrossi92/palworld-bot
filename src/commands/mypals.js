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

function formatStars(stars) {
  return "⭐".repeat(stars || 0) || "No stars";
}

function formatEssenceProgress(pal) {
  const thresholds = [2, 5, 10, 20];

  if ((pal.stars ?? 0) >= 4) {
    return pal.extraEssence > 0
      ? `Maxed (+${pal.extraEssence} extra essence)`
      : "Maxed";
  }

  const nextThreshold = thresholds[pal.stars ?? 0];
  return `${pal.essence ?? 0}/${nextThreshold}`;
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
        return `• ${pal.name} | Lv. ${pal.level} | ${pal.rarity} | ${formatStars(
          pal.stars
        )} | Essence ${formatEssenceProgress(pal)} | ${formatCaughtDate(pal.caughtAt)}`;
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
