const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { readUserPals } = require("../systems/captureSystem");

const fallbackPalImageUrls = {
  cattiva:
    "https://static.wikia.nocookie.net/palworld/images/5/59/Cattiva.png/revision/latest?cb=20240630132255",
  foxparks:
    "https://static.wikia.nocookie.net/palworld/images/d/dd/Foxparks.png/revision/latest?cb=20240630115853",
  lamball:
    "https://static.wikia.nocookie.net/palworld/images/4/47/Lamball.png/revision/latest?cb=20240630125836",
  pengullet:
    "https://static.wikia.nocookie.net/palworld/images/b/b3/Pengullet.png/revision/latest?cb=20240630021748",
  direhowl:
    "https://static.wikia.nocookie.net/palworld/images/1/14/Direhowl.png/revision/latest?cb=20240123181301",
  anubis:
    "https://static.wikia.nocookie.net/palworld/images/2/26/Anubis.png/revision/latest?cb=20250120160026",
  jetragon:
    "https://static.wikia.nocookie.net/palworld/images/f/fd/Jetragon.png/revision/latest?cb=20240123200132",
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
    return pal.extraEssence > 0
      ? `Maxed (+${pal.extraEssence} extra essence)`
      : "Maxed";
  }

  const nextThreshold = thresholds[pal.stars ?? 0];
  return `${pal.essence ?? 0}/${nextThreshold}`;
}

function getPalImageUrl(pal) {
  if (pal && typeof pal.imageUrl === "string" && pal.imageUrl.trim() !== "") {
    return pal.imageUrl.trim();
  }

  if (!pal || typeof pal.name !== "string") {
    return "";
  }

  return fallbackPalImageUrls[pal.name.toLowerCase()] || "";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("inspect")
    .setDescription("Inspect one Pal you own.")
    .addStringOption((option) =>
      option
        .setName("pal")
        .setDescription("The Pal name to inspect.")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetName = interaction.options.getString("pal");
    const allUserPals = readUserPals();
    const userPals = Array.isArray(allUserPals[interaction.user.id])
      ? allUserPals[interaction.user.id]
      : [];
    const pal = userPals.find(
      (entry) => entry.name.toLowerCase() === targetName.toLowerCase()
    );

    if (!pal) {
      await interaction.editReply("You don't own that Pal yet.");
      return;
    }

    const imageUrl = getPalImageUrl(pal);
    const embed = new EmbedBuilder()
      .setTitle(`${pal.isShiny ? "✨ " : ""}${pal.name}`)
      .setColor(pal.isShiny ? 0xf1c40f : 0x5865f2)
      .addFields(
        {
          name: "Level",
          value: `${pal.level}`,
          inline: true,
        },
        {
          name: "Rarity",
          value: pal.rarity,
          inline: true,
        },
        {
          name: "Stars",
          value: formatStars(pal.stars),
          inline: true,
        },
        ...(pal.isShiny
          ? [
              {
                name: "Variant",
                value: "✨ SHINY",
                inline: true,
              },
            ]
          : []),
        {
          name: "Essence Progress",
          value: formatEssenceProgress(pal),
        },
        {
          name: "Caught At",
          value: formatCaughtDate(pal.caughtAt),
        }
      )
      .setTimestamp();

    if ((pal.stars ?? 0) >= 4 && (pal.extraEssence ?? 0) > 0) {
      embed.addFields({
        name: "Extra Essence",
        value: `${pal.extraEssence}`,
        inline: true,
      });
    }

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
