const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const {
  claimDailyQuestReward,
  getDailyQuestStatus,
} = require("../systems/captureSystem");

const claimButtonId = "quests:claim";

function formatQuestProgress(current, goal) {
  return `${Math.min(current, goal)}/${goal}`;
}

function formatRewards(rewards) {
  return (
    `${rewards.coins} coins\n` +
    `${rewards.xp} XP\n` +
    `${rewards.spheres.basic} basic spheres\n` +
    `${rewards.spheres.mega} mega sphere`
  );
}

function formatLevelUp(progression) {
  return (
    `Level ${progression.oldLevel} → ${progression.level}\n` +
    `Title: ${progression.trainerTitle}` +
    (progression.unlockMessages.length > 0
      ? `\n${progression.unlockMessages.join("\n")}`
      : "")
  );
}

function buildQuestsEmbed(status, claimResult = null) {
  const { dailyQuests, goals, rewards, complete } = status;
  const claimed = claimResult ? claimResult.dailyQuests.claimed : dailyQuests.claimed;
  const embed = new EmbedBuilder()
    .setTitle("Daily Quests")
    .setColor(claimed ? 0x95a5a6 : complete ? 0x2ecc71 : 0x3498db)
    .addFields(
      {
        name: "Try 3 captures",
        value: formatQuestProgress(
          dailyQuests.captureAttempts,
          goals.captureAttempts
        ),
        inline: true,
      },
      {
        name: "Successfully catch 1 Pal",
        value: formatQuestProgress(
          dailyQuests.successfulCaptures,
          goals.successfulCaptures
        ),
        inline: true,
      },
      {
        name: "Reward",
        value: formatRewards(rewards),
      },
      {
        name: "Status",
        value: claimed
          ? "Claimed for today."
          : complete
            ? "Complete. Claim your reward."
            : "In progress.",
      }
    )
    .setFooter({ text: `Quest date: ${dailyQuests.date}` })
    .setTimestamp();

  if (claimResult && claimResult.claimed) {
    embed.addFields({
      name: "Reward Claimed",
      value:
        `+${claimResult.rewards.coins} coins\n` +
        `+${claimResult.rewards.xp} XP\n` +
        `+${claimResult.rewards.spheres.basic} basic spheres\n` +
        `+${claimResult.rewards.spheres.mega} mega sphere`,
    });
  }

  if (claimResult && claimResult.progression?.leveledUp) {
    embed.addFields({
      name: "🎉 LEVEL UP!",
      value: formatLevelUp(claimResult.progression),
    });
  }

  return embed;
}

function buildClaimComponents(status) {
  if (!status.complete || status.dailyQuests.claimed) {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(claimButtonId)
        .setLabel("Claim Reward")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quests")
    .setDescription("Show today's daily quests and claim completed rewards."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const status = getDailyQuestStatus(interaction.user.id);
    const message = await interaction.editReply({
      embeds: [buildQuestsEmbed(status)],
      components: buildClaimComponents(status),
    });

    if (!status.complete || status.dailyQuests.claimed) {
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: "This quest panel belongs to another trainer.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await buttonInteraction.deferUpdate();

      if (buttonInteraction.customId !== claimButtonId) {
        return;
      }

      const claimResult = claimDailyQuestReward(interaction.user.id);
      const updatedStatus = getDailyQuestStatus(interaction.user.id);

      await interaction.editReply({
        embeds: [buildQuestsEmbed(updatedStatus, claimResult)],
        components: [],
      });

      collector.stop("claimed");
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "claimed") {
        return;
      }

      try {
        const updatedStatus = getDailyQuestStatus(interaction.user.id);
        await interaction.editReply({
          embeds: [buildQuestsEmbed(updatedStatus)],
          components: [],
        });
      } catch (error) {
        console.error("[quests] Failed to disable claim button:", error);
      }
    });
  },
};
