const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { readUserPals } = require("../systems/captureSystem");

const pageSize = 10;
const palboxButtonPrefix = "mypals";
const rarityRank = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};
const viewLabels = {
  all: "All Pals",
  shinies: "Shinies",
  maxed: "Maxed Pals",
  legendary: "Legendary Pals",
};
const sortLabels = {
  recent: "Most Recent",
  level: "Level",
  stars: "Stars",
  rarity: "Rarity",
};

function formatCaughtDate(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStars(stars) {
  return "⭐".repeat(stars || 0) || "No stars";
}

function formatEssenceProgress(pal) {
  const thresholds = [2, 5, 10, 20];

  if ((pal.stars ?? 0) >= 4) {
    return null;
  }

  const nextThreshold = thresholds[pal.stars ?? 0];
  return `${pal.essence ?? 0}/${nextThreshold}`;
}

function getCaughtAtTime(pal) {
  const caughtAtTime = new Date(pal.caughtAt).getTime();
  return Number.isNaN(caughtAtTime) ? 0 : caughtAtTime;
}

function getSummary(userPals) {
  return {
    totalOwnedSpecies: new Set(userPals.map((pal) => pal.name)).size,
    shinyCount: userPals.filter((pal) => pal.isShiny).length,
    maxedCount: userPals.filter((pal) => (pal.stars ?? 0) >= 4).length,
  };
}

function filterPals(userPals, view) {
  if (view === "shinies") {
    return userPals.filter((pal) => pal.isShiny);
  }

  if (view === "maxed") {
    return userPals.filter((pal) => (pal.stars ?? 0) >= 4);
  }

  if (view === "legendary") {
    return userPals.filter((pal) => pal.rarity === "legendary");
  }

  return userPals;
}

function sortPals(userPals, sort) {
  return userPals
    .map((pal, index) => ({ pal, index }))
    .sort((a, b) => {
      if (sort === "level") {
        return (
          (b.pal.level ?? 0) - (a.pal.level ?? 0) ||
          getCaughtAtTime(b.pal) - getCaughtAtTime(a.pal) ||
          a.pal.name.localeCompare(b.pal.name)
        );
      }

      if (sort === "stars") {
        return (
          (b.pal.stars ?? 0) - (a.pal.stars ?? 0) ||
          (b.pal.essence ?? 0) - (a.pal.essence ?? 0) ||
          getCaughtAtTime(b.pal) - getCaughtAtTime(a.pal) ||
          a.pal.name.localeCompare(b.pal.name)
        );
      }

      if (sort === "rarity") {
        return (
          (rarityRank[b.pal.rarity] ?? 0) - (rarityRank[a.pal.rarity] ?? 0) ||
          (b.pal.level ?? 0) - (a.pal.level ?? 0) ||
          a.pal.name.localeCompare(b.pal.name)
        );
      }

      return getCaughtAtTime(b.pal) - getCaughtAtTime(a.pal) || b.index - a.index;
    })
    .map(({ pal }) => pal);
}

function formatPalLine(pal) {
  const essenceProgress = formatEssenceProgress(pal);
  const parts = [
    `${pal.isShiny ? "✨ " : ""}${pal.name}`,
    `Lv. ${pal.level}`,
    pal.rarity,
    formatStars(pal.stars),
  ];

  if (essenceProgress) {
    parts.push(`Essence ${essenceProgress}`);
  }

  parts.push(formatCaughtDate(pal.caughtAt));

  return `• ${parts.join(" | ")}`;
}

function buildPalboxEmbed({
  user,
  userPals,
  filteredPals,
  view,
  sort,
  page,
}) {
  const summary = getSummary(userPals);
  const totalPages = Math.max(1, Math.ceil(filteredPals.length / pageSize));
  const startIndex = page * pageSize;
  const pagePals = filteredPals.slice(startIndex, startIndex + pageSize);
  const description = [
    `Total owned species: ${summary.totalOwnedSpecies}`,
    `Shiny count: ${summary.shinyCount}`,
    `4-star/maxed count: ${summary.maxedCount}`,
  ].join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`${user.username}'s Palbox`)
    .setDescription(description)
    .setColor(0x5865f2)
    .addFields(
      {
        name: "View",
        value: viewLabels[view] || viewLabels.all,
        inline: true,
      },
      {
        name: "Sort",
        value: sortLabels[sort] || sortLabels.recent,
        inline: true,
      },
      {
        name: "Pals",
        value:
          pagePals.length > 0
            ? pagePals.map(formatPalLine).join("\n")
            : "No Pals match that view yet.",
      }
    )
    .setFooter({ text: `Page ${page + 1} / ${totalPages}` })
    .setTimestamp();

  return embed;
}

function buildPalboxComponents(userId, page, totalPages, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${palboxButtonPrefix}:previous:${userId}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || page <= 0),
      new ButtonBuilder()
        .setCustomId(`${palboxButtonPrefix}:next:${userId}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || page >= totalPages - 1)
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mypals")
    .setDescription("Show the pals you have captured.")
    .addStringOption((option) =>
      option
        .setName("view")
        .setDescription("Choose which Pals to show.")
        .addChoices(
          { name: "all", value: "all" },
          { name: "shinies", value: "shinies" },
          { name: "maxed", value: "maxed" },
          { name: "legendary", value: "legendary" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("sort")
        .setDescription("Choose how to sort your Palbox.")
        .addChoices(
          { name: "recent", value: "recent" },
          { name: "level", value: "level" },
          { name: "stars", value: "stars" },
          { name: "rarity", value: "rarity" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = interaction.options.getString("view") || "all";
    const sort = interaction.options.getString("sort") || "recent";
    const allUserPals = await readUserPals();
    const guildUserPals = allUserPals[interaction.guildId] || {};
    const userPals = Array.isArray(guildUserPals[interaction.user.id])
      ? guildUserPals[interaction.user.id]
      : [];

    if (userPals.length === 0) {
      await interaction.editReply(
        "Your Palbox is empty for now. Use /capture to catch your first Pal."
      );
      return;
    }

    const filteredPals = sortPals(filterPals(userPals, view), sort);

    if (filteredPals.length === 0) {
      await interaction.editReply({
        embeds: [
          buildPalboxEmbed({
            user: interaction.user,
            userPals,
            filteredPals,
            view,
            sort,
            page: 0,
          }),
        ],
        components: buildPalboxComponents(interaction.user.id, 0, 1, true),
      });
      return;
    }

    let page = 0;
    const totalPages = Math.ceil(filteredPals.length / pageSize);
    const message = await interaction.editReply({
      embeds: [
        buildPalboxEmbed({
          user: interaction.user,
          userPals,
          filteredPals,
          view,
          sort,
          page,
        }),
      ],
      components: buildPalboxComponents(interaction.user.id, page, totalPages),
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: "This is someone else's Palbox.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await buttonInteraction.deferUpdate();

      const [prefix, action, ownerId] = buttonInteraction.customId.split(":");
      if (prefix !== palboxButtonPrefix || ownerId !== interaction.user.id) {
        return;
      }

      if (action === "previous") {
        page = Math.max(0, page - 1);
      }

      if (action === "next") {
        page = Math.min(totalPages - 1, page + 1);
      }

      await interaction.editReply({
        embeds: [
          buildPalboxEmbed({
            user: interaction.user,
            userPals,
            filteredPals,
            view,
            sort,
            page,
          }),
        ],
        components: buildPalboxComponents(interaction.user.id, page, totalPages),
      });
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply({
          embeds: [
            buildPalboxEmbed({
              user: interaction.user,
              userPals,
              filteredPals,
              view,
              sort,
              page,
            }),
          ],
          components: buildPalboxComponents(interaction.user.id, page, totalPages, true),
        });
      } catch (error) {
        console.error("[mypals] Failed to disable Palbox buttons:", error);
      }
    });
  },
};
