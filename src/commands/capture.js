const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { attemptCapture } = require("../systems/captureSystem");

const CAPTURE_COOLDOWN_MS = 10_000;
const captureCooldowns = new Map();

const sphereChoices = [
  ["Basic", "basic"],
  ["Mega", "mega"],
  ["Giga", "giga"],
  ["Hyper", "hyper"],
  ["Ultra", "ultra"],
  ["Legendary", "legendary"],
];

async function safeEditReply(interaction, payload) {
  try {
    console.log("[capture] before editReply");
    await interaction.editReply(payload);
    console.log("[capture] after editReply");
    return true;
  } catch (error) {
    console.error("[capture] Failed to edit reply:", error);
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("capture")
    .setDescription("Encounter and attempt to capture a wild Pal.")
    .addStringOption((option) => {
      option
        .setName("sphere")
        .setDescription("Choose which sphere to use.")
        .setRequired(false);

      for (const [name, value] of sphereChoices) {
        option.addChoices({ name, value });
      }

      return option;
    }),

  async execute(interaction) {
    const now = Date.now();
    const lastCaptureAt = captureCooldowns.get(interaction.user.id);

    if (lastCaptureAt && now - lastCaptureAt < CAPTURE_COOLDOWN_MS) {
      const secondsLeft = Math.ceil(
        (CAPTURE_COOLDOWN_MS - (now - lastCaptureAt)) / 1000
      );
      const secondLabel = secondsLeft === 1 ? "second" : "seconds";

      console.log(
        `[capture] cooldown blocked user=${interaction.user.id} secondsLeft=${secondsLeft}`
      );

      await interaction.reply({
        content: `⏳ You must wait ${secondsLeft} ${secondLabel} before capturing again.`,
        ephemeral: true,
      });
      return;
    }

    captureCooldowns.set(interaction.user.id, now);

    try {
      console.log(
        `[capture] command received user=${interaction.user.id} command=/capture`
      );
    } catch (error) {
      console.error("[capture] Failed to log command receipt:", error);
    }

    try {
      await interaction.deferReply();
      console.log(`[capture] after deferReply user=${interaction.user.id}`);
    } catch (error) {
      console.error("[capture] Failed during deferReply:", error);
      throw error;
    }

    try {
      const sphere = interaction.options.getString("sphere") || "basic";
      console.log(
        `[capture] before capture system call user=${interaction.user.id} sphere=${sphere}`
      );
      const result = attemptCapture(interaction.user.id, sphere);
      console.log(
        `[capture] after capture system result user=${interaction.user.id} success=${result.success} pal=${result.pal.name} level=${result.pal.level} sphere=${result.sphere} chance=${result.captureChance}`
      );

      const embed = new EmbedBuilder()
        .setTitle("Wild Pal Encounter")
        .setColor(result.success ? 0x57f287 : 0xed4245)
        .addFields(
          {
            name: "Wild Pal",
            value: `${result.pal.name} (Lv. ${result.pal.level}, ${result.pal.rarity})`,
          },
          {
            name: "Sphere Used",
            value: result.sphere,
            inline: true,
          },
          {
            name: "Capture Chance",
            value: `${result.captureChance}%`,
            inline: true,
          },
          {
            name: "Result",
            value: result.success
              ? "Success! The Pal was captured."
              : "Failure! The Pal broke free.",
          },
          {
            name: "XP Gained",
            value: `${result.progression.xpGained} XP`,
            inline: true,
          },
          {
            name: "Current Level",
            value: `${result.progression.level}`,
            inline: true,
          },
          {
            name: "Total XP",
            value: `${result.progression.xp}`,
            inline: true,
          },
          {
            name: "Progress",
            value: result.progression.leveledUp
              ? "Level Up!"
              : "No level change.",
          }
        )
        .setTimestamp();

      const replied = await safeEditReply(interaction, { embeds: [embed] });

      if (!replied) {
        throw new Error("editReply failed after capture result was built");
      }
    } catch (error) {
      console.error("[capture] Error executing /capture:", error);

      await safeEditReply(
        interaction,
        "❌ Something went wrong while processing /capture."
      );
    }
  },
};
