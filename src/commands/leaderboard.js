const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { readUserPals } = require("../systems/captureSystem");

async function resolveUsername(interaction, userId) {
  try {
    const member = await interaction.guild.members.fetch(userId);
    return member.user.username;
  } catch (error) {
    return `User ${userId}`;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top users by total captures."),

  async execute(interaction) {
    await interaction.deferReply();

    const allUserPals = readUserPals();
    const rankings = Object.entries(allUserPals)
      .map(([userId, pals]) => ({
        userId,
        captureCount: Array.isArray(pals) ? pals.length : 0,
      }))
      .filter((entry) => entry.captureCount > 0)
      .sort((a, b) => b.captureCount - a.captureCount)
      .slice(0, 10);

    if (rankings.length === 0) {
      await interaction.editReply(
        "No captures yet. Be the first with /capture!"
      );
      return;
    }

    const lines = await Promise.all(
      rankings.map(async (entry, index) => {
        const username = interaction.guild
          ? await resolveUsername(interaction, entry.userId)
          : `User ${entry.userId}`;

        return `${index + 1}. ${username} - ${entry.captureCount} captures`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle("🏆 Capture Leaderboard")
      .setDescription(lines.join("\n"))
      .setColor(0xf1c40f)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
