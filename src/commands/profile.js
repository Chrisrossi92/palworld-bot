const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const {
  getJournalSummary,
  readUsers,
  readUserPals,
} = require("../systems/captureSystem");

const defaultSpheres = {
  basic: 10,
  mega: 3,
  giga: 1,
  hyper: 0,
  ultra: 0,
  legendary: 0,
};

const rarityRank = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

function logDeferState(label, interaction) {
  console.log(
    `[profile:${label}] id=${interaction.id} deferred=${interaction.deferred} replied=${interaction.replied} provider=${process.env.STORAGE_PROVIDER || "json"} pid=${process.pid}`
  );
}

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

function getSphereInventory(user) {
  const spheres = user && user.spheres && typeof user.spheres === "object"
    ? user.spheres
    : {};

  return {
    basic: Number.isInteger(spheres.basic) && spheres.basic >= 0
      ? spheres.basic
      : defaultSpheres.basic,
    mega: Number.isInteger(spheres.mega) && spheres.mega >= 0
      ? spheres.mega
      : defaultSpheres.mega,
    giga: Number.isInteger(spheres.giga) && spheres.giga >= 0
      ? spheres.giga
      : defaultSpheres.giga,
    hyper: Number.isInteger(spheres.hyper) && spheres.hyper >= 0
      ? spheres.hyper
      : defaultSpheres.hyper,
    ultra: Number.isInteger(spheres.ultra) && spheres.ultra >= 0
      ? spheres.ultra
      : defaultSpheres.ultra,
    legendary:
      Number.isInteger(spheres.legendary) && spheres.legendary >= 0
        ? spheres.legendary
        : defaultSpheres.legendary,
  };
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

function formatJournalSummary(summary) {
  if (!summary) {
    return "No Journal data yet.";
  }

  const progressLine =
    `${summary.unlockedCount}/${summary.totalDefinitions} unlocked ` +
    `(${summary.completionPercentage}% complete)`;
  const recent = Array.isArray(summary.recentUnlocks) && summary.recentUnlocks.length > 0
    ? summary.recentUnlocks
      .map((entry) => `Unlocked: ${entry.category} - ${entry.title}`)
      .join("\n")
    : "Unlocked: None yet";
  const nextMilestones = Array.isArray(summary.nextMilestones) && summary.nextMilestones.length > 0
    ? summary.nextMilestones
      .map((milestone) =>
        `Next: ${milestone.category} - ${milestone.title} ` +
        `(${milestone.value}/${milestone.target} ${milestone.metricLabel})`
      )
      .join("\n")
    : "Next: All current Journal entries complete";

  return `${progressLine}\n${recent}\n${nextMilestones}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show your capture progression and stats."),

  async execute(interaction) {
    logDeferState("before-defer", interaction);

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      logDeferState("after-defer", interaction);
    } else {
      logDeferState("skip-defer", interaction);
    }

    const users = await readUsers();
    const allUserPals = await readUserPals();
    const guildUsers = users[interaction.guildId] || {};
    const guildUserPals = allUserPals[interaction.guildId] || {};
    const user = guildUsers[interaction.user.id];
    const userPals = Array.isArray(guildUserPals[interaction.user.id])
      ? guildUserPals[interaction.user.id]
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
    const sphereInventory = getSphereInventory(user);
    const journalSummary = await getJournalSummary(
      interaction.guildId,
      interaction.user.id,
      userPals
    );

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Profile`)
      .setColor(0x3498db)
      .addFields(
        {
          name: "Level / XP",
          value: `Level ${user.level} | ${user.xp} XP | Next: ${nextLevelXp} XP`,
        },
        {
          name: "Coins",
          value: `${user.coins ?? 100}`,
          inline: true,
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
        },
        {
          name: "Journal",
          value: formatJournalSummary(journalSummary),
        },
        {
          name: "🎒 Spheres",
          value: `Basic: ${sphereInventory.basic}
Mega: ${sphereInventory.mega}
Giga: ${sphereInventory.giga}
Hyper: ${sphereInventory.hyper}
Ultra: ${sphereInventory.ultra}
Legendary: ${sphereInventory.legendary}`,
        }
      )
      .setFooter({
        text: "Success rate only includes attempts tracked after XP was added.",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
