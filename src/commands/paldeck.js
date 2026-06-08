const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const {
  getJournalSummary,
  getPaldeckSummary,
} = require("../systems/captureSystem");

function formatPaldeckCompletion(summary) {
  if (!summary || summary.totalSpeciesCount <= 0) {
    return "Catalog unavailable.";
  }

  return [
    `${summary.ownedSpeciesCount}/${summary.totalSpeciesCount} species discovered`,
    `${summary.completionPercentage}% complete`,
  ].join("\n");
}

function formatRecentSpecies(summary) {
  const recentSpecies = Array.isArray(summary?.recentSpecies)
    ? summary.recentSpecies.slice(0, 5)
    : [];

  if (recentSpecies.length === 0) {
    return "None yet.";
  }

  return recentSpecies
    .map((species) => species.name)
    .filter(Boolean)
    .join(", ") || "None yet.";
}

function formatMissingSpeciesPreview(summary) {
  if (!summary || summary.totalSpeciesCount <= 0) {
    return "Catalog unavailable.";
  }

  const missingSpecies = Array.isArray(summary.missingSpeciesPreview)
    ? summary.missingSpeciesPreview.slice(0, 10)
    : [];

  if (missingSpecies.length === 0) {
    return "No missing species in the current catalog preview.";
  }

  return missingSpecies.join(", ");
}

function formatNextCollectionMilestone(summary) {
  const nextCollectionMilestone = Array.isArray(summary?.nextMilestones)
    ? summary.nextMilestones.find((milestone) => milestone.metric === "uniqueSpecies")
    : null;

  if (!nextCollectionMilestone) {
    return "All current Collector entries complete.";
  }

  return `${nextCollectionMilestone.title} ` +
    `(${nextCollectionMilestone.value}/${nextCollectionMilestone.target} ` +
    `${nextCollectionMilestone.metricLabel})`;
}

function buildPaldeckEmbed(username, paldeckSummary, journalSummary) {
  return new EmbedBuilder()
    .setTitle(`${username}'s Paldeck`)
    .setColor(0x3498db)
    .addFields(
      {
        name: "Completion",
        value: formatPaldeckCompletion(paldeckSummary),
      },
      {
        name: "Recent Species",
        value: formatRecentSpecies(paldeckSummary),
      },
      {
        name: "Missing Species Preview",
        value: formatMissingSpeciesPreview(paldeckSummary),
      },
      {
        name: "Next Collection Milestone",
        value: formatNextCollectionMilestone(journalSummary),
      }
    )
    .setFooter({ text: "/mypals shows the Pals you own." })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("paldeck")
    .setDescription("Show your Paldeck completion and collection gaps."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [paldeckSummary, journalSummary] = await Promise.all([
      getPaldeckSummary(interaction.guildId, interaction.user.id, null, {
        recentLimit: 5,
        missingPreviewLimit: 10,
      }),
      getJournalSummary(interaction.guildId, interaction.user.id),
    ]);

    await interaction.editReply({
      embeds: [
        buildPaldeckEmbed(
          interaction.user.username,
          paldeckSummary,
          journalSummary
        ),
      ],
    });
  },
  buildPaldeckEmbed,
  formatMissingSpeciesPreview,
  formatNextCollectionMilestone,
  formatPaldeckCompletion,
  formatRecentSpecies,
};
