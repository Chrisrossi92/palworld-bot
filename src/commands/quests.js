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
  claimDailyResearchReward,
  claimDailyQuestReward,
  getDailyResearchStatus,
  getDailyQuestStatus,
  getWeeklyServerGoalStatus,
} = require("../systems/captureSystem");

const claimButtonId = "quests:claim";
const researchClaimButtonId = "research:claim";

function formatQuestProgress(current, goal) {
  return `${Math.min(current, goal)}/${goal}`;
}

function formatQuestLine(label, current, goal) {
  const icon = current >= goal ? "✅" : "⏳";

  return `${icon} ${label} — ${formatQuestProgress(current, goal)}`;
}

function formatRewards(rewards) {
  return (
    `${rewards.coins} coins\n` +
    `${rewards.xp} XP\n` +
    `${rewards.spheres.basic} basic spheres\n` +
    `${rewards.spheres.mega} mega sphere`
  );
}

function formatResearchRewards(rewards) {
  return `${rewards.coins} coins\n${rewards.xp} XP`;
}

function formatServerGoal(serverGoalStatus) {
  if (!serverGoalStatus) {
    return "Server goal unavailable.";
  }

  return [
    serverGoalStatus.definition.title,
    formatQuestLine(
      serverGoalStatus.definition.description,
      serverGoalStatus.state.progress,
      serverGoalStatus.state.target
    ),
    `Completion: ${serverGoalStatus.completionPercentage}%`,
    `Reset: ${serverGoalStatus.resetLabel}`,
    `Status: ${serverGoalStatus.complete ? "✅ Complete" : "⏳ In Progress"}`,
  ].join("\n");
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

function buildQuestsEmbed(
  status,
  researchStatus,
  serverGoalStatus,
  claimResult = null
) {
  const { dailyQuests, goals, rewards, complete } = status;
  const claimed = dailyQuests.claimed;
  const statusLabel = claimed
    ? "✅ Claimed"
    : complete
      ? "🎁 Ready to Claim"
      : "⏳ In Progress";
  const embed = new EmbedBuilder()
    .setTitle(claimResult?.claimed ? "🎉 Reward Claimed!" : "Daily Quests")
    .setColor(claimed ? 0x95a5a6 : complete ? 0x2ecc71 : 0x3498db)
    .addFields(
      {
        name: "Today's Quests",
        value: [
          formatQuestLine(
            "Try 3 captures",
            dailyQuests.captureAttempts,
            goals.captureAttempts
          ),
          formatQuestLine(
            "Catch 1 Pal",
            dailyQuests.successfulCaptures,
            goals.successfulCaptures
          ),
        ].join("\n"),
      },
      {
        name: "Reward",
        value: formatRewards(rewards),
      },
      {
        name: "Status",
        value: statusLabel,
      },
      {
        name: "Daily Research",
        value: [
          researchStatus.assignment.title,
          formatQuestLine(
            researchStatus.assignment.description,
            researchStatus.state.progress,
            researchStatus.state.target
          ),
          `Reward: ${formatResearchRewards(researchStatus.rewards)}`,
          `Status: ${
            researchStatus.state.claimed
              ? "✅ Claimed"
              : researchStatus.claimable
                ? "🎁 Ready to Claim"
                : "⏳ In Progress"
          }`,
        ].join("\n"),
      },
      {
        name: "Server Goal",
        value: formatServerGoal(serverGoalStatus),
      }
    )
    .setFooter({ text: `Quest date: ${dailyQuests.date}` })
    .setTimestamp();

  if (claimResult && claimResult.claimed && claimResult.dailyQuests) {
    embed.addFields({
      name: "Reward Claimed",
      value:
        `+${claimResult.rewards.coins} coins\n` +
        `+${claimResult.rewards.xp} XP\n` +
        `+${claimResult.rewards.spheres.basic} basic spheres\n` +
        `+${claimResult.rewards.spheres.mega} mega sphere`,
    });
  }

  if (claimResult && claimResult.claimed && claimResult.state) {
    embed.addFields({
      name: "Research Reward Claimed",
      value:
        `+${claimResult.rewards.coins} coins\n` +
        `+${claimResult.rewards.xp} XP`,
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

function buildClaimComponents(status, researchStatus) {
  const buttons = [];

  if (status.complete && !status.dailyQuests.claimed) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(claimButtonId)
        .setLabel("🎁 Claim Quest Reward")
        .setStyle(ButtonStyle.Success)
    );
  }

  if (researchStatus.claimable) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(researchClaimButtonId)
        .setLabel("🔎 Claim Research")
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (buttons.length === 0) {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(buttons),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quests")
    .setDescription("Show today's daily quests and claim completed rewards."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [status, researchStatus, serverGoalStatus] = await Promise.all([
      getDailyQuestStatus(interaction.guildId, interaction.user.id),
      getDailyResearchStatus(interaction.guildId, interaction.user.id),
      getWeeklyServerGoalStatus(interaction.guildId),
    ]);
    const message = await interaction.editReply({
      embeds: [buildQuestsEmbed(status, researchStatus, serverGoalStatus)],
      components: buildClaimComponents(status, researchStatus),
    });

    if (
      (!status.complete || status.dailyQuests.claimed) &&
      !researchStatus.claimable
    ) {
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: "Not your quest.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await buttonInteraction.deferUpdate();

      if (
        buttonInteraction.customId !== claimButtonId &&
        buttonInteraction.customId !== researchClaimButtonId
      ) {
        return;
      }

      const claimResult = buttonInteraction.customId === claimButtonId
        ? await claimDailyQuestReward(interaction.guildId, interaction.user.id)
        : await claimDailyResearchReward(interaction.guildId, interaction.user.id);
      const [updatedStatus, updatedResearchStatus, updatedServerGoalStatus] = await Promise.all([
        getDailyQuestStatus(interaction.guildId, interaction.user.id),
        getDailyResearchStatus(interaction.guildId, interaction.user.id),
        getWeeklyServerGoalStatus(interaction.guildId),
      ]);

      await interaction.editReply({
        embeds: [
          buildQuestsEmbed(
            updatedStatus,
            updatedResearchStatus,
            updatedServerGoalStatus,
            claimResult
          ),
        ],
        components: buildClaimComponents(updatedStatus, updatedResearchStatus),
      });

      if (
        (!updatedStatus.complete || updatedStatus.dailyQuests.claimed) &&
        !updatedResearchStatus.claimable
      ) {
        collector.stop("claimed");
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "claimed") {
        return;
      }

      try {
        const [updatedStatus, updatedResearchStatus, updatedServerGoalStatus] = await Promise.all([
          getDailyQuestStatus(interaction.guildId, interaction.user.id),
          getDailyResearchStatus(interaction.guildId, interaction.user.id),
          getWeeklyServerGoalStatus(interaction.guildId),
        ]);
        await interaction.editReply({
          embeds: [
            buildQuestsEmbed(
              updatedStatus,
              updatedResearchStatus,
              updatedServerGoalStatus
            ),
          ],
          components: [],
        });
      } catch (error) {
        console.error("[quests] Failed to disable claim button:", error);
      }
    });
  },
};
