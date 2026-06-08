const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const {
  getJournalSummary,
  getPaldeckSummary,
  readUserPals,
  readUsers,
} = require("../systems/captureSystem");
const {
  buildTrainerSummary,
} = require("../systems/trainerIdentitySystem");
const {
  renderTrainerCard,
} = require("../systems/cardRenderer");

function buildTrainerFallbackEmbed(summary) {
  const favoritePal = summary.favoritePal
    ? `${summary.favoritePal.name} (Lv. ${summary.favoritePal.level || "?"}, ${summary.favoritePal.rarity || "common"})`
    : "No favorite Pal yet. Start with /capture.";

  return new EmbedBuilder()
    .setTitle(`${summary.username}'s Trainer Card`)
    .setColor(0xd6a84f)
    .addFields(
      {
        name: "Trainer",
        value: `${summary.title}\nLevel ${summary.level}`,
      },
      {
        name: "Favorite Pal",
        value: favoritePal,
      },
      {
        name: "Paldeck",
        value:
          `${summary.paldeck.ownedSpeciesCount}/${summary.paldeck.totalSpeciesCount} ` +
          `(${summary.paldeck.completionPercentage}%)`,
        inline: true,
      },
      {
        name: "Journal",
        value:
          `${summary.journal.unlockedCount}/${summary.journal.totalDefinitions} ` +
          `(${summary.journal.completionPercentage}%)`,
        inline: true,
      }
    )
    .setFooter({ text: "Trainer cards use current progress and collection data." })
    .setTimestamp();
}

async function buildTrainerPayload({
  guildId,
  userId,
  username,
  renderCard = renderTrainerCard,
} = {}) {
  const [users, allUserPals] = await Promise.all([
    readUsers(),
    readUserPals(),
  ]);
  const guildUsers = users[guildId] || {};
  const guildUserPals = allUserPals[guildId] || {};
  const userRecord = guildUsers[userId] || {};
  const ownedPals = Array.isArray(guildUserPals[userId])
    ? guildUserPals[userId]
    : [];
  const [paldeckSummary, journalSummary] = await Promise.all([
    getPaldeckSummary(guildId, userId, ownedPals, {
      recentLimit: 3,
      missingPreviewLimit: 0,
    }),
    getJournalSummary(guildId, userId, ownedPals),
  ]);
  const summary = buildTrainerSummary({
    username,
    userRecord,
    ownedPals,
    paldeckSummary,
    journalSummary,
  });

  try {
    const card = await renderCard(summary);
    const attachmentName = card.filename || "trainer-card.png";
    const attachmentSource = card.buffer || card.path;

    if (!attachmentSource) {
      throw new Error("Trainer card renderer did not return a buffer or path.");
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(`${summary.username}'s Trainer Card`)
          .setColor(0xd6a84f)
          .setImage(`attachment://${attachmentName}`)
          .setTimestamp(),
      ],
      files: [
        new AttachmentBuilder(attachmentSource, {
          name: attachmentName,
        }),
      ],
    };
  } catch (error) {
    console.error("[trainer] Failed to render trainer card:", error);

    return {
      embeds: [buildTrainerFallbackEmbed(summary)],
    };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trainer")
    .setDescription("Share your PalMaster trainer card."),

  async execute(interaction) {
    await interaction.deferReply();

    await interaction.editReply(
      await buildTrainerPayload({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
      })
    );
  },
  buildTrainerFallbackEmbed,
  buildTrainerPayload,
};
