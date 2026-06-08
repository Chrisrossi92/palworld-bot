const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { getJournalSummary } = require("../systems/captureSystem");

function formatJournalProgress(summary) {
  return [
    `${summary.unlockedCount}/${summary.totalDefinitions} unlocked`,
    `${summary.completionPercentage}% complete`,
  ].join("\n");
}

function formatCategoryBreakdown(summary) {
  const breakdown = Array.isArray(summary?.categoryBreakdown)
    ? summary.categoryBreakdown
    : [];

  if (breakdown.length === 0) {
    return "No Journal categories available.";
  }

  return breakdown
    .map((entry) =>
      `${entry.category}: ${entry.unlockedCount}/${entry.totalDefinitions}`
    )
    .join("\n");
}

function formatRecentUnlocks(summary) {
  const recentUnlocks = Array.isArray(summary?.recentUnlocks)
    ? summary.recentUnlocks.slice(0, 3)
    : [];

  if (recentUnlocks.length === 0) {
    return "None yet.";
  }

  return recentUnlocks
    .map((entry) => `${entry.category}: ${entry.title}`)
    .join("\n");
}

function formatNextMilestones(summary) {
  const nextMilestones = Array.isArray(summary?.nextMilestones)
    ? summary.nextMilestones.slice(0, 3)
    : [];

  if (nextMilestones.length === 0) {
    return "All current Journal entries complete.";
  }

  return nextMilestones
    .map((milestone) =>
      `${milestone.category}: ${milestone.title} ` +
      `(${milestone.value}/${milestone.target} ${milestone.metricLabel})`
    )
    .join("\n");
}

function buildJournalEmbed(username, summary) {
  const safeSummary = summary || {
    unlockedCount: 0,
    totalDefinitions: 0,
    completionPercentage: 0,
    categoryBreakdown: [],
    recentUnlocks: [],
    nextMilestones: [],
  };

  return new EmbedBuilder()
    .setTitle(`${username}'s Journal`)
    .setColor(0x8e44ad)
    .addFields(
      {
        name: "Summary",
        value: formatJournalProgress(safeSummary),
      },
      {
        name: "Categories",
        value: formatCategoryBreakdown(safeSummary),
      },
      {
        name: "Recent Unlocks",
        value: formatRecentUnlocks(safeSummary),
      },
      {
        name: "Next Milestones",
        value: formatNextMilestones(safeSummary),
      }
    )
    .setFooter({
      text: "Journal updates after captures and progression changes.",
    })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("journal")
    .setDescription("Show your Journal milestones and next goals."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const summary = await getJournalSummary(
      interaction.guildId,
      interaction.user.id
    );

    await interaction.editReply({
      embeds: [buildJournalEmbed(interaction.user.username, summary)],
    });
  },
  buildJournalEmbed,
  formatCategoryBreakdown,
  formatNextMilestones,
  formatRecentUnlocks,
};
