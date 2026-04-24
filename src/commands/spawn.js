const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ComponentType,
} = require("discord.js");
const {
  createEncounterForLevel,
  consumeSphere,
  getUserLevel,
  MAX_LEVEL,
  resolveCaptureEncounter,
} = require("../systems/captureSystem");
const captureCommand = require("./capture");

const publicSpawnButtonsInventory = {
  basic: 1,
  mega: 1,
  giga: 1,
  hyper: 1,
  ultra: 1,
  legendary: 1,
};

let activeSpawn = null;

function clearActiveSpawn(messageId) {
  if (activeSpawn && activeSpawn.message.id === messageId) {
    activeSpawn = null;
    console.log(`[spawn] activeSpawn cleared message=${messageId}`);
  }
}

function buildExpiredSpawnEmbed(encounter) {
  return captureCommand.buildEncounterEmbed(encounter, publicSpawnButtonsInventory, {
    title: "💨 The wild Pal wandered off.",
    description: "No trainer acted in time.",
    showInventory: false,
  });
}

function buildSpawnResolvedEmbed(result, remaining, user) {
  const embed = captureCommand.buildResolvedEmbed(result, remaining);

  if (!result.success) {
    return embed;
  }

  embed.setTitle(
    result.pal.isShiny
      ? `✨ SHINY Pal Captured by ${user.username}!`
      : `✅ Pal Captured by ${user.username}!`
  );
  embed.addFields({
    name: "Captured By",
    value: `<@${user.id}>`,
  });

  return embed;
}

async function startPublicSpawn(channel) {
  if (!channel) {
    throw new Error("A valid channel is required to start a public spawn.");
  }

  if (activeSpawn) {
    return {
      started: false,
      reason: "active_spawn",
      message: activeSpawn.message,
    };
  }

  const encounter = createEncounterForLevel(MAX_LEVEL, {
    includeLevel: false,
    levelLabel: "Scales to trainer",
  });

  const message = await channel.send({
    embeds: [
      captureCommand.buildEncounterEmbed(encounter, publicSpawnButtonsInventory, {
        title: encounter.isShiny ? "✨ A SHINY Pal Appeared!" : "🔥 A Wild Pal Appeared!",
        description: "First trainer to throw a sphere gets the chance!",
        showInventory: false,
      }),
    ],
    components: captureCommand.buildSphereButtons(
      publicSpawnButtonsInventory,
      false,
      "spawn"
    ),
  });

  activeSpawn = {
    encounter,
    isResolved: false,
    isResolving: false,
    message,
  };
  console.log(`[spawn] public spawn started message=${message.id} channel=${channel.id}`);

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000,
  });

  collector.on("collect", async (buttonInteraction) => {
    console.log(
      `[spawn] public spawn button received message=${message.id} user=${buttonInteraction.user.id} customId=${buttonInteraction.customId}`
    );

    try {
      await buttonInteraction.deferUpdate();
      console.log(
        `[spawn] deferUpdate succeeded message=${message.id} user=${buttonInteraction.user.id}`
      );
    } catch (error) {
      console.error(
        `[spawn] deferUpdate failed message=${message.id} user=${buttonInteraction.user.id}`,
        error
      );
      return;
    }

    try {
      if (!activeSpawn || activeSpawn.message.id !== message.id) {
        return;
      }

      if (activeSpawn.isResolved || activeSpawn.isResolving) {
        console.log(`[spawn] spawn already resolved message=${message.id}`);
        return;
      }

      const [, sphere] = buttonInteraction.customId.split(":");
      const sphereUse = consumeSphere(buttonInteraction.user.id, sphere);

      if (!sphereUse.consumed) {
        console.log(
          `[spawn] no sphere available message=${message.id} user=${buttonInteraction.user.id} sphere=${sphereUse.sphere}`
        );
        await buttonInteraction.followUp({
          content: `❌ You don't have any ${sphereUse.sphere} spheres.`,
          ephemeral: true,
        });
        return;
      }

      activeSpawn.isResolving = true;

      const resolvedEncounter = {
        ...encounter,
        level: getUserLevel(buttonInteraction.user.id),
      };

      await message.edit({
        embeds: [captureCommand.buildThrowEmbed(resolvedEncounter, sphere)],
        components: captureCommand.buildSphereButtons(
          publicSpawnButtonsInventory,
          true,
          "spawn"
        ),
      });

      await new Promise((res) => setTimeout(res, 1000));

      await message.edit({
        embeds: [captureCommand.buildShakeEmbed(resolvedEncounter)],
        components: captureCommand.buildSphereButtons(
          publicSpawnButtonsInventory,
          true,
          "spawn"
        ),
      });

      await new Promise((res) => setTimeout(res, 500));

      const result = resolveCaptureEncounter(
        buttonInteraction.user.id,
        resolvedEncounter,
        sphere
      );

      await message.edit({
        embeds: [
          buildSpawnResolvedEmbed(
            result,
            sphereUse.remaining,
            buttonInteraction.user
          ),
        ],
        components: captureCommand.buildSphereButtons(
          publicSpawnButtonsInventory,
          true,
          "spawn"
        ),
      });

      activeSpawn.isResolved = true;
      console.log(
        `[spawn] public spawn resolved message=${message.id} user=${buttonInteraction.user.id}`
      );
      collector.stop("resolved");
    } catch (error) {
      console.error("[spawn] Error resolving public encounter:", error);

      try {
        await message.edit({
          content: "❌ Something went wrong while processing /spawn.",
          embeds: [],
          components: captureCommand.buildSphereButtons(
            publicSpawnButtonsInventory,
            true,
            "spawn"
          ),
        });
      } catch (editError) {
        console.error("[spawn] Failed to edit spawn message after error:", editError);
      }

      collector.stop("error");
    }
  });

  collector.on("end", async (collected, reason) => {
    try {
      if (reason !== "resolved" && reason !== "error") {
        console.log(`[spawn] public spawn expired message=${message.id}`);
        await message.edit({
          embeds: [buildExpiredSpawnEmbed(encounter)],
          components: captureCommand.buildSphereButtons(
            publicSpawnButtonsInventory,
            true,
            "spawn"
          ),
        });
      }
    } catch (error) {
      console.error("[spawn] Failed to disable spawn buttons:", error);
    } finally {
      clearActiveSpawn(message.id);
    }
  });

  return {
    started: true,
    message,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("spawn")
    .setDescription("Spawn a public wild Pal encounter in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const hasAdminPermission =
      interaction.memberPermissions &&
      (interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild) ||
        interaction.memberPermissions.has(PermissionFlagsBits.Administrator));

    if (!hasAdminPermission) {
      await interaction.reply({
        content: "❌ You need Manage Guild or Administrator permission to use /spawn.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await startPublicSpawn(interaction.channel);

      if (!result.started) {
        await interaction.editReply(
          "⚠️ A public spawn is already active. Resolve it before creating another."
        );
        return;
      }

      await interaction.editReply("✅ A wild Pal has spawned in this channel.");
    } catch (error) {
      console.error("[spawn] Error executing /spawn:", error);
      await interaction.editReply("❌ Something went wrong while starting /spawn.");
    }
  },
  startPublicSpawn,
};
