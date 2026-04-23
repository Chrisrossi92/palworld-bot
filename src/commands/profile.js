const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { readUsers, readUserPals } = require("../systems/captureSystem");

const rarityRank = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSuccessRate(successRate, failedCaptures) {
  if (failedCaptures === 0) {
    return `${(successRate * 100).toFixed(1)}% tracked`;
  }

  return formatPercent(successRate);
}

function formatCapture(pal) {
  if (!pal) {
    return "None";
  }

  return `${pal.name} (Lv. ${pal.level}, ${pal.rarity})`;
}

function getRarestPal(pals) {
  return pals.reduce((rarest, pal) => {
    if (!rarest) {
      return pal;
    }

    const currentRank = rarityRank[pal.rarity] ?? 0;
    const rarestRank = rarityRank[rarest.rarity] ?? 0;

    if (currentRank > rarestRank) {
      return pal;
    }

    return rarest;
  }, null);
}

function getMostRecentCapture(pals) {
  return pals.reduce((recent, pal) => {
    if (!recent) {
      return pal;
    }

    const palTime = new Date(pal.caughtAt).getTime();
    const recentTime = new Date(recent.caughtAt).getTime();

    if (Number.isNaN(palTime)) {
      return recent;
    }

    if (Number.isNaN(recentTime) || palTime > recentTime) {
      return pal;
    }

    return recent;
  }, null);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show your capture progression and stats."),

  async execute(interaction) {
    await interaction.deferReply();

    const users = readUsers();
    const allUserPals = readUserPals();
    const user = users[interaction.user.id];
    const userPals = Array.isArray(allUserPals[interaction.user.id])
      ? allUserPals[interaction.user.id]
      : [];
    const actualCapturedPalsCount = userPals.length;

    if (!user) {
      await interaction.editReply(
        "You have no progress yet. Start with /capture!"
      );
      return;
    }

    const attempts = actualCapturedPalsCount + user.failedCaptures;
    const successRate = attempts > 0 ? actualCapturedPalsCount / attempts : 0;
    const nextLevelXp = user.level * 100;
    const rarestPal = getRarestPal(userPals);
    const recentCapture = getMostRecentCapture(userPals);

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Profile`)
      .setColor(0x3498db)
      .addFields(
        {
          name: "Level / XP",
          value: `Level ${user.level} | ${user.xp} XP | Next: ${nextLevelXp} XP`,
        },
        {
          name: "Total Captures",
          value: `${actualCapturedPalsCount}`,
          inline: true,
        },
        {
          name: "Failed Captures",
          value: `${user.failedCaptures}`,
          inline: true,
        },
        {
          name: "Success Rate",
          value: formatSuccessRate(successRate, user.failedCaptures),
          inline: true,
        },
        {
          name: "Rarest Pal",
          value: formatCapture(rarestPal),
        },
        {
          name: "Recent Capture",
          value: formatCapture(recentCapture),
        }
      )
      .setFooter({
        text: "Success rate only includes attempts tracked after XP was added.",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
