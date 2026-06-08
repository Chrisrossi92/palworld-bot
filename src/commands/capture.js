const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const {
  renderCaptureShakeCard,
  renderCaptureResultCard,
  renderCaptureThrowCard,
  renderPalCardBuffer,
} = require("../systems/cardRenderer");
const {
  createEncounter,
  consumeSphere,
  getUserInventory,
  resolveCaptureEncounter,
} = require("../systems/captureSystem");

const CAPTURE_COOLDOWN_MS = 10_000;
const LIGHTWEIGHT_SHAKE_DELAY_MS = 400;
const SUCCESS_SHAKE_COUNT = 3;
const FAILED_SHAKE_COUNT = 2;
const MAX_SHAKE_COUNT = 3;
const captureCooldowns = new Map();

const rarityColors = {
  common: 0x95a5a6,
  uncommon: 0x2ecc71,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf1c40f,
};
const shinyColor = 0xf1c40f;

const rarityEmojis = {
  common: "⚪",
  uncommon: "🟢",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡",
};

const palImageUrls = {
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

const sphereChoices = [
  ["Basic", "basic"],
  ["Mega", "mega"],
  ["Giga", "giga"],
  ["Hyper", "hyper"],
  ["Ultra", "ultra"],
  ["Legendary", "legendary"],
];

function logDeferState(label, interaction) {
  console.log(
    `[capture:${label}] id=${interaction.id} deferred=${interaction.deferred} replied=${interaction.replied} provider=${process.env.STORAGE_PROVIDER || "json"} pid=${process.pid}`
  );
}

function isImageDebugEnabled() {
  return process.env.PALMASTER_IMAGE_DEBUG === "1" ||
    process.env.CARD_IMAGE_DEBUG === "1";
}

function logCaptureImageDebug(message) {
  if (!isImageDebugEnabled()) {
    return;
  }

  console.warn(`[capture:image] ${message}`);
}

function getPalImageUrl(pal) {
  if (pal && typeof pal.imageUrl === "string" && pal.imageUrl.trim() !== "") {
    return pal.imageUrl.trim();
  }

  if (!pal || typeof pal.name !== "string") {
    return "";
  }

  return palImageUrls[pal.name.toLowerCase()] || "";
}

function formatCompactSphereInventory(inventory) {
  return sphereChoices
    .map(([name, value]) => `${name} ${inventory[value] ?? 0}`)
    .join(" • ");
}

function buildSphereButtons(
  inventory,
  disabled = false,
  customIdPrefix = "capture"
) {
  const buttons = sphereChoices.map(([name, value]) =>
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}:${value}`)
      .setLabel(name)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || (inventory[value] ?? 0) <= 0)
  );

  return [
    new ActionRowBuilder().addComponents(buttons.slice(0, 5)),
    new ActionRowBuilder().addComponents(buttons.slice(5)),
  ];
}

function buildEncounterEmbed(encounter, inventory, options = {}) {
  const rarityEmoji = rarityEmojis[encounter.rarity] || "";
  const imageUrl = getPalImageUrl(encounter);
  const fields = [
    {
      name: "Wild Pal",
      value: `${rarityEmoji} ${encounter.name} (Lv. ${encounter.level}, ${encounter.rarity})`,
    },
  ];

  if (encounter.isShiny) {
    fields.push({
      name: "Variant",
      value: "✨ SHINY",
      inline: true,
    });
  }

  if (options.showInventory !== false) {
    fields.push({
      name: "🎒 Spheres",
      value: formatCompactSphereInventory(inventory),
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(
      options.title || (encounter.isShiny ? "✨ A SHINY Pal Appeared!" : "Wild Pal Encounter")
    )
    .setColor(encounter.isShiny ? shinyColor : rarityColors[encounter.rarity] || 0x95a5a6)
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (options.description) {
    embed.setDescription(options.description);
  }

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  return embed;
}

function buildEncounterCardEmbed(encounter, attachmentName) {
  return new EmbedBuilder()
    .setTitle(encounter.isShiny ? "Lucky Pal Encounter" : "Wild Pal Encounter")
    .setColor(encounter.isShiny ? shinyColor : rarityColors[encounter.rarity] || 0x95a5a6)
    .setDescription("Choose a sphere to throw.")
    .setImage(`attachment://${attachmentName}`)
    .setTimestamp();
}

async function buildEncounterPayload(encounter, inventory, options = {}) {
  const components = buildSphereButtons(
    inventory,
    options.buttonsDisabled === true
  );
  const renderCard = options.renderCard || renderPalCardBuffer;
  const imageUrl =
    encounter && typeof encounter.imageUrl === "string"
      ? encounter.imageUrl
      : "";

  logCaptureImageDebug(
    `encounter payload pal="${encounter?.name || "Unknown Pal"}" ` +
    `rarity="${encounter?.rarity || "unknown"}" level="${encounter?.level ?? "unknown"}" ` +
    `isLucky=${Boolean(encounter?.isShiny)} imageUrl="${imageUrl}" ` +
    `imageUrlMissing=${imageUrl.trim() === ""} willRenderCard=true`
  );

  try {
    const card = await renderCard({
      pal: encounter,
      level: encounter.level,
      rarity: encounter.rarity,
      isShiny: encounter.isShiny,
    });
    const attachmentName = card.filename || "encounter-card.png";
    const attachmentSource = card.buffer || card.path;

    if (!attachmentSource) {
      throw new Error("Encounter card renderer did not return a buffer or path.");
    }

    return {
      embeds: [buildEncounterCardEmbed(encounter, attachmentName)],
      components,
      files: [
        new AttachmentBuilder(attachmentSource, {
          name: attachmentName,
        }),
      ],
    };
  } catch (error) {
    console.error("[capture] Failed to render encounter card:", error);

    return {
      embeds: [buildEncounterEmbed(encounter, inventory)],
      components,
    };
  }
}

function getWeeklyServerGoalCompletionField(result) {
  if (!result?.success || !result.weeklyServerGoal?.newlyCompleted) {
    return null;
  }

  return {
    name: "Server Goal Complete",
    value: "Together, the server captured 100 Pals this week.",
  };
}

function buildResolvedEmbed(result, remaining) {
  const rarityEmoji = rarityEmojis[result.pal.rarity] || "";
  const embedColor = result.pal.isShiny
    ? shinyColor
    : result.success
      ? ["epic", "legendary"].includes(result.pal.rarity)
        ? rarityColors[result.pal.rarity] || 0x57f287
        : 0x57f287
      : 0xed4245;
  const flavorText = result.success
    ? "Nice throw — added to your collection."
    : "It broke free. Better luck next time.";
  const imageUrl = getPalImageUrl(result.pal);
  const collectionProgress = result.collectionUpdate
    ? result.collectionUpdate.nextStarThreshold
      ? `${result.collectionUpdate.essence}/${result.collectionUpdate.nextStarThreshold}`
      : `Maxed (+${result.collectionUpdate.extraEssence} extra essence)`
    : "No change";
  const progressNotes = [];
  const levelUpFields = [];
  const journalUnlockFields = [];
  const weeklyGoalCompletionField = getWeeklyServerGoalCompletionField(result);

  if (result.progression.leveledUp) {
    progressNotes.push("Level Up!");
    levelUpFields.push({
      name: "🎉 LEVEL UP!",
      value:
        `Level ${result.progression.oldLevel} → ${result.progression.level}\n` +
        `Title: ${result.progression.trainerTitle}` +
        (result.progression.unlockMessages.length > 0
          ? `\n${result.progression.unlockMessages.join("\n")}`
          : ""),
    });
  }

  if (result.collectionUpdate && result.collectionUpdate.starIncreased) {
    progressNotes.push("Star Up!");
  }

  if (result.journal && result.journal.newlyUnlocked.length > 0) {
    progressNotes.push("Journal Updated!");
    const visibleUnlocks = result.journal.newlyUnlocked.slice(0, 3);
    const hiddenUnlockCount = result.journal.newlyUnlocked.length - visibleUnlocks.length;
    journalUnlockFields.push({
      name: result.journal.newlyUnlocked.length === 1
        ? "New Journal Entry"
        : "New Journal Entries",
      value: [
        ...visibleUnlocks
        .map((entry) => `${entry.category}: ${entry.title}`)
          .map((line) => `• ${line}`),
        ...(hiddenUnlockCount > 0 ? [`• +${hiddenUnlockCount} more`] : []),
      ].join("\n"),
    });
  }

  if (weeklyGoalCompletionField) {
    progressNotes.push("Server Goal Complete!");
  }

  if (progressNotes.length === 0) {
    progressNotes.push("No level change.");
  }

  const embed = new EmbedBuilder()
    .setTitle(
      result.pal.isShiny
        ? result.success
          ? "✨ SHINY Pal Captured!"
          : "✨ SHINY Pal Escaped!"
        : result.success
          ? "✅ Pal Captured!"
          : "❌ Pal Escaped!"
    )
    .setColor(embedColor)
    .addFields(
      {
        name: "Wild Pal",
        value: `${rarityEmoji} ${result.pal.name} (Lv. ${result.pal.level}, ${result.pal.rarity})`,
      },
      ...(result.pal.isShiny
        ? [
            {
              name: "Variant",
              value: "✨ SHINY",
              inline: true,
            },
          ]
        : []),
      {
        name: "Sphere Used",
        value: result.sphere,
        inline: true,
      },
      {
        name: "Remaining",
        value: `${remaining}`,
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
        name: result.success ? "Added To Collection" : "Escaped",
        value: result.success
          ? result.collectionUpdate && result.collectionUpdate.outcome === "duplicate"
            ? `${result.pal.name} was condensed into your existing Pal.`
            : `${result.pal.name} Lv. ${result.pal.level} has joined your Palbox.`
          : `${result.pal.name} broke free and ran off.`,
      },
      {
        name: "Collection Result",
        value: result.success
          ? result.collectionUpdate && result.collectionUpdate.outcome === "duplicate"
            ? "Duplicate Condensed"
            : "New Pal Added"
          : "No Pal Added",
      },
      {
        name: "Flavor",
        value: flavorText,
      },
      {
        name: "XP Gained",
        value: `${result.progression.xpGained} XP`,
        inline: true,
      },
      {
        name: "Coins Gained",
        value: `${result.progression.coinsGained} coins`,
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
        name: "Total Coins",
        value: `${result.progression.coins}`,
        inline: true,
      },
      {
        name: "🔥 Streak",
        value: `${result.progression.streak}`,
        inline: true,
      },
      {
        name: "Current Stars",
        value: result.collectionUpdate
          ? `${"⭐".repeat(result.collectionUpdate.stars || 0) || "None"}`
          : "None",
        inline: true,
      },
      {
        name: "Essence Progress",
        value: result.success ? collectionProgress : "None",
        inline: true,
      },
      {
        name: "Progress",
        value: progressNotes.join(" | "),
      },
      ...levelUpFields,
      ...journalUnlockFields,
      ...(weeklyGoalCompletionField ? [weeklyGoalCompletionField] : [])
    )
    .setTimestamp();

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  return embed;
}

function buildResolvedCardEmbed(result, attachmentName) {
  return new EmbedBuilder()
    .setTitle(result.success ? "Pal Captured" : "Pal Escaped")
    .setColor(
      result.pal.isShiny
        ? shinyColor
        : result.success
          ? 0x57f287
          : 0xed4245
    )
    .setDescription(
      result.success
        ? "Capture result recorded."
        : "The encounter ended without a capture."
    )
    .setImage(`attachment://${attachmentName}`)
    .setTimestamp();
}

function buildThrowCardEmbed(encounter, sphere, attachmentName) {
  return new EmbedBuilder()
    .setTitle("Sphere Thrown")
    .setColor(encounter.isShiny ? shinyColor : 0xf1c40f)
    .setDescription(`${sphere} Sphere is in motion.`)
    .setImage(`attachment://${attachmentName}`)
    .setTimestamp();
}

function buildShakeCardEmbed(encounter, attachmentName, options = {}) {
  const shakeCount =
    Number.isInteger(options.shakeCount) && options.shakeCount > 0
      ? options.shakeCount
      : 1;
  const maxShakes =
    Number.isInteger(options.maxShakes) && options.maxShakes > 0
      ? options.maxShakes
      : MAX_SHAKE_COUNT;

  return new EmbedBuilder()
    .setTitle("The Sphere Shakes")
    .setColor(encounter.isShiny ? shinyColor : 0xf39c12)
    .setDescription(`Shake ${Math.min(shakeCount, maxShakes)}/${maxShakes}.`)
    .setImage(`attachment://${attachmentName}`)
    .setTimestamp();
}

function getCaptureShakeSteps(result) {
  const shakeCount = result?.success ? SUCCESS_SHAKE_COUNT : FAILED_SHAKE_COUNT;

  return Array.from({ length: shakeCount }, (_, index) => ({
    shakeCount: index + 1,
    maxShakes: MAX_SHAKE_COUNT,
    delayMs: LIGHTWEIGHT_SHAKE_DELAY_MS,
  }));
}

function getCapturePresentationSteps() {
  return [];
}

async function buildThrowPayload(encounter, sphere, inventory, options = {}) {
  const renderCard = options.renderCard || renderCaptureThrowCard;
  const components = buildSphereButtons(inventory, true);

  try {
    const card = await renderCard({
      pal: encounter,
      sphere,
    });
    const attachmentName = card.filename || "capture-throw.png";
    const attachmentSource = card.buffer || card.path;

    if (!attachmentSource) {
      throw new Error("Throw card renderer did not return a buffer or path.");
    }

    return {
      content: "",
      embeds: [buildThrowCardEmbed(encounter, sphere, attachmentName)],
      components,
      attachments: [],
      files: [
        new AttachmentBuilder(attachmentSource, {
          name: attachmentName,
        }),
      ],
    };
  } catch (error) {
    console.error("[capture] Failed to render throw card:", error);

    return {
      content: "",
      embeds: [buildThrowEmbed(encounter, sphere)],
      components,
      attachments: [],
    };
  }
}

async function buildShakePayload(encounter, sphere, inventory, options = {}) {
  const renderCard = options.renderCard || renderCaptureShakeCard;
  const components = buildSphereButtons(inventory, true);

  try {
    const card = await renderCard({
      pal: encounter,
      sphere,
      shakeCount: options.shakeCount,
      maxShakes: options.maxShakes,
    });
    const attachmentName = card.filename || "capture-shake.png";
    const attachmentSource = card.buffer || card.path;

    if (!attachmentSource) {
      throw new Error("Shake card renderer did not return a buffer or path.");
    }

    return {
      content: "",
      embeds: [buildShakeCardEmbed(encounter, attachmentName, {
        shakeCount: options.shakeCount,
        maxShakes: options.maxShakes,
      })],
      components,
      attachments: [],
      files: [
        new AttachmentBuilder(attachmentSource, {
          name: attachmentName,
        }),
      ],
    };
  } catch (error) {
    console.error("[capture] Failed to render shake card:", error);

    return {
      content: "",
      embeds: [buildShakeEmbed(encounter, {
        shakeCount: options.shakeCount,
        maxShakes: options.maxShakes,
      })],
      components,
      attachments: [],
    };
  }
}

function buildImmediateCaptureFeedbackPayload(inventory) {
  return {
    content: "Sphere thrown...",
    components: buildSphereButtons(inventory, true),
  };
}

function buildLightweightShakePayload(inventory) {
  return buildImmediateCaptureFeedbackPayload(inventory);
}

async function buildResolvedPayload(result, remaining, inventory, options = {}) {
  const components = buildSphereButtons(inventory, true);
  const renderCard = options.renderCard || renderCaptureResultCard;

  try {
    const card = await renderCard(result);
    const attachmentName = card.filename || "capture-result.png";
    const attachmentSource = card.buffer || card.path;

    if (!attachmentSource) {
      throw new Error("Result card renderer did not return a buffer or path.");
    }

    return {
      content: "",
      embeds: [buildResolvedCardEmbed(result, attachmentName)],
      components,
      attachments: [],
      files: [
        new AttachmentBuilder(attachmentSource, {
          name: attachmentName,
        }),
      ],
    };
  } catch (error) {
    console.error("[capture] Failed to render result card:", error);

    return {
      content: "",
      embeds: [buildResolvedEmbed(result, remaining)],
      components,
      attachments: [],
    };
  }
}

function buildThrowEmbed(encounter, sphere) {
  const imageUrl = getPalImageUrl(encounter);
  const embed = new EmbedBuilder()
    .setTitle(
      encounter.isShiny
        ? `✨ Throwing ${sphere} Sphere at a SHINY Pal...`
        : `🎯 Throwing ${sphere} Sphere...`
    )
    .setColor(encounter.isShiny ? shinyColor : 0xf1c40f)
    .setDescription(
      `${encounter.name} is in sight. The sphere is flying toward its target...`
    )
    .setTimestamp();

  if (encounter.isShiny) {
    embed.addFields({
      name: "Variant",
      value: "✨ SHINY",
      inline: true,
    });
  }

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  return embed;
}

function buildShakeEmbed(encounter, options = {}) {
  const imageUrl = getPalImageUrl(encounter);
  const shakeCount =
    Number.isInteger(options.shakeCount) && options.shakeCount > 0
      ? options.shakeCount
      : null;
  const maxShakes =
    Number.isInteger(options.maxShakes) && options.maxShakes > 0
      ? options.maxShakes
      : MAX_SHAKE_COUNT;
  const shakeLabel = shakeCount
    ? `Shake ${Math.min(shakeCount, maxShakes)}/${maxShakes}. `
    : "";
  const embed = new EmbedBuilder()
    .setTitle("...shake...shake...")
    .setColor(encounter.isShiny ? shinyColor : 0xf39c12)
    .setDescription(`${shakeLabel}The sphere rocks on the ground...`)
    .setTimestamp();

  if (encounter.isShiny) {
    embed.addFields({
      name: "Variant",
      value: "✨ SHINY",
      inline: true,
    });
  }

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  return embed;
}

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
    .setDescription("Encounter a wild Pal and choose a sphere to throw."),

  async execute(interaction) {
    const now = Date.now();
    const guildId = interaction.guildId;
    const cooldownKey = `${guildId}:${interaction.user.id}`;
    const lastCaptureAt = captureCooldowns.get(cooldownKey);

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

    captureCooldowns.set(cooldownKey, now);

    try {
      console.log(
        `[capture] command received user=${interaction.user.id} command=/capture`
      );
    } catch (error) {
      console.error("[capture] Failed to log command receipt:", error);
    }

    try {
      logDeferState("before-defer", interaction);
      await interaction.deferReply();
      logDeferState("after-defer", interaction);
      console.log(`[capture] after deferReply user=${interaction.user.id}`);
    } catch (error) {
      console.error("[capture] Failed during deferReply:", error);
      throw error;
    }

    try {
      const encounter = await createEncounter(guildId, interaction.user.id);
      const inventory = await getUserInventory(guildId, interaction.user.id);
      const message = await interaction.editReply(
        await buildEncounterPayload(encounter, inventory)
      );

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
      });

      collector.on("collect", async (buttonInteraction) => {
        let resolvedResult = null;
        let resolvedSphereUse = null;

        try {
          await buttonInteraction.deferUpdate();
          if (buttonInteraction.user.id !== interaction.user.id) {
            console.log(
              `[capture] blocked button click from non-owner user=${buttonInteraction.user.id} owner=${interaction.user.id}`
            );
            return;
          }

          const [, sphere] = buttonInteraction.customId.split(":");
          console.log(
            `[capture] resolving encounter user=${interaction.user.id} sphere=${sphere}`
          );

          const sphereUse = await consumeSphere(guildId, interaction.user.id, sphere);
          resolvedSphereUse = sphereUse;

          if (!sphereUse.consumed) {
            const disabledInventory = await getUserInventory(
              guildId,
              interaction.user.id
            );

            await interaction.editReply({
              content: `❌ You don't have any ${sphereUse.sphere} spheres.`,
              embeds: [],
              components: buildSphereButtons(disabledInventory, true),
              attachments: [],
            });
            collector.stop("resolved");
            return;
          }

          const immediateInventory = await getUserInventory(
            guildId,
            interaction.user.id
          );

          try {
            await interaction.editReply(
              buildImmediateCaptureFeedbackPayload(immediateInventory)
            );
          } catch (feedbackError) {
            console.error(
              "[capture] Failed to send immediate capture feedback:",
              feedbackError
            );
          }

          const result = await resolveCaptureEncounter(
            guildId,
            interaction.user.id,
            encounter,
            sphere,
            {
              trackDailyResearch: true,
              trackWeeklyServerGoal: true,
            }
          );
          resolvedResult = result;

          console.log(
            `[capture] after capture system result user=${interaction.user.id} success=${result.success} pal=${result.pal.name} level=${result.pal.level} sphere=${result.sphere} chance=${result.captureChance}`
          );

          const presentationSteps = getCapturePresentationSteps(result);

          for (const step of presentationSteps) {
            const shakeInventory = await getUserInventory(
              guildId,
              interaction.user.id
            );

            if (step.type === "lightweight-shake") {
              await interaction.editReply(
                buildLightweightShakePayload(shakeInventory)
              );
            } else {
              await interaction.editReply(
                await buildShakePayload(encounter, sphere, shakeInventory, {
                  shakeCount: step.shakeCount,
                  maxShakes: step.maxShakes,
                })
              );
            }

            await new Promise((res) => setTimeout(res, step.delayMs));
          }

          const resolvedInventory = await getUserInventory(
            guildId,
            interaction.user.id
          );

          await interaction.editReply(
            await buildResolvedPayload(
              result,
              sphereUse.remaining,
              resolvedInventory
            )
          );

          collector.stop("resolved");
        } catch (error) {
          console.error("[capture] Error resolving encounter button:", error);

          if (resolvedResult) {
            try {
              const resolvedInventory = await getUserInventory(
                guildId,
                interaction.user.id
              );

              await interaction.editReply(
                await buildResolvedPayload(
                  resolvedResult,
                  resolvedSphereUse?.remaining ?? 0,
                  resolvedInventory
                )
              );

              collector.stop("resolved");
              return;
            } catch (finalError) {
              console.error(
                "[capture] Failed to render stable final result after resolved capture:",
                finalError
              );
            }
          }

          const errorInventory = await getUserInventory(
            guildId,
            interaction.user.id
          );

          await interaction.editReply({
            content: "❌ Something went wrong while processing /capture.",
            embeds: [],
            components: buildSphereButtons(errorInventory, true),
            attachments: [],
          });

          collector.stop("error");
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "resolved" || reason === "error") {
          return;
        }

        try {
          const disabledInventory = await getUserInventory(guildId, interaction.user.id);

          await interaction.editReply(
            await buildEncounterPayload(encounter, disabledInventory, {
              buttonsDisabled: true,
            })
          );
        } catch (error) {
          console.error("[capture] Failed to disable encounter buttons:", error);
        }
      });
    } catch (error) {
      console.error("[capture] Error executing /capture:", error);

      await safeEditReply(
        interaction,
        "❌ Something went wrong while processing /capture."
      );
    }
  },
  buildEncounterCardEmbed,
  buildEncounterEmbed,
  buildEncounterPayload,
  buildResolvedCardEmbed,
  buildResolvedEmbed,
  buildResolvedPayload,
  buildImmediateCaptureFeedbackPayload,
  buildLightweightShakePayload,
  buildShakeCardEmbed,
  buildShakeEmbed,
  buildShakePayload,
  buildSphereButtons,
  buildThrowCardEmbed,
  buildThrowEmbed,
  buildThrowPayload,
  getCapturePresentationSteps,
  getCaptureShakeSteps,
  getWeeklyServerGoalCompletionField,
};
