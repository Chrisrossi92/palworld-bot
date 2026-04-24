const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { readUserPals, readUsers } = require("../systems/captureSystem");

const LEADERBOARD_TYPES = {
  captures: {
    title: "🏆 Capture Leaderboard",
    emptyMessage: "No captures yet. Be the first with /capture!",
    compute(allUserPals) {
      return Object.entries(allUserPals).map(([userId, pals]) => ({
        userId,
        value: Array.isArray(pals) ? pals.length : 0,
        format(value) {
          return `${value} captures`;
        },
      }));
    },
  },
  level: {
    title: "📈 Level Leaderboard",
    emptyMessage: "No levels tracked yet. Start progressing with /capture!",
    compute(_allUserPals, allUsers) {
      return Object.entries(allUsers).map(([userId, user]) => ({
        userId,
        value: user.level || 1,
        tiebreaker: user.xp || 0,
        format(value) {
          return `Lv. ${value}`;
        },
      }));
    },
  },
  coins: {
    title: "💰 Coins Leaderboard",
    emptyMessage: "No coins tracked yet. Start earning with /capture or /daily!",
    compute(_allUserPals, allUsers) {
      return Object.entries(allUsers).map(([userId, user]) => ({
        userId,
        value: user.coins || 0,
        format(value) {
          return `${value} coins`;
        },
      }));
    },
  },
  shinies: {
    title: "✨ Shiny Leaderboard",
    emptyMessage: "No shiny Pals yet. Keep hunting!",
    compute(allUserPals) {
      return Object.entries(allUserPals).map(([userId, pals]) => ({
        userId,
        value: Array.isArray(pals)
          ? pals.filter((pal) => pal.isShiny).length
          : 0,
        format(value) {
          return `${value} shinies`;
        },
      }));
    },
  },
  stars: {
    title: "⭐ Star Leaderboard",
    emptyMessage: "No stars yet. Condense duplicate Pals to build stars!",
    compute(allUserPals) {
      return Object.entries(allUserPals).map(([userId, pals]) => ({
        userId,
        value: Array.isArray(pals)
          ? pals.reduce((total, pal) => total + (pal.stars || 0), 0)
          : 0,
        format(value) {
          return `${value} stars`;
        },
      }));
    },
  },
};

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
    .setDescription("Show leaderboard rankings for captures, level, coins, and more.")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Choose which leaderboard to view.")
        .addChoices(
          { name: "captures", value: "captures" },
          { name: "level", value: "level" },
          { name: "coins", value: "coins" },
          { name: "shinies", value: "shinies" },
          { name: "stars", value: "stars" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const type = interaction.options.getString("type") || "captures";
    const config = LEADERBOARD_TYPES[type] || LEADERBOARD_TYPES.captures;
    const allUserPals = readUserPals();
    const allUsers = readUsers();
    const rankings = config
      .compute(allUserPals, allUsers)
      .filter((entry) => entry.value > 0)
      .sort((a, b) => {
        if (b.value !== a.value) {
          return b.value - a.value;
        }

        return (b.tiebreaker || 0) - (a.tiebreaker || 0);
      })
      .slice(0, 10);

    if (rankings.length === 0) {
      await interaction.editReply(config.emptyMessage);
      return;
    }

    const lines = await Promise.all(
      rankings.map(async (entry, index) => {
        const username = interaction.guild
          ? await resolveUsername(interaction, entry.userId)
          : `User ${entry.userId}`;

        return `${index + 1}. ${username} - ${entry.format(entry.value)}`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle(config.title)
      .setDescription(lines.join("\n"))
      .setColor(0xf1c40f)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
