const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { claimDailyReward } = require("../systems/captureSystem");

function formatSphereRewards(rewards) {
  return Object.entries(rewards)
    .filter(([, amount]) => amount > 0)
    .map(([sphere, amount]) => `+${amount} ${sphere}`)
    .join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily XP reward."),

  async execute(interaction) {
    await interaction.deferReply();

    const result = claimDailyReward(interaction.user.id);

    if (!result.claimed) {
      await interaction.editReply(
        "You already claimed your daily reward today. Come back tomorrow."
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Daily Reward Claimed")
      .setColor(0xf1c40f)
      .addFields(
        {
          name: "XP Gained",
          value: `${result.progression.xpGained} XP`,
          inline: true,
        },
        {
          name: "Current Level",
          value: `${result.progression.level}`,
          inline: true,
        },
        {
          name: "Total XP",
          value: `${result.progression.xp}`,
          inline: true,
        },
        {
          name: "Progress",
          value: result.progression.leveledUp
            ? "Level Up!"
            : "No level change.",
        },
        {
          name: "Sphere Rewards",
          value: formatSphereRewards(result.sphereRewards),
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
