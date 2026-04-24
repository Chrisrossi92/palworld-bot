const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ComponentType,
} = require("discord.js");
const {
  createEncounter,
  consumeSphere,
  getUserInventory,
  resolveCaptureEncounter,
} = require("../systems/captureSystem");
const captureCommand = require("./capture");

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

    await interaction.deferReply();

    try {
      const encounter = createEncounter();
      const message = await interaction.editReply({
        embeds: [
          captureCommand.buildEncounterEmbed(encounter, getUserInventory(interaction.user.id), {
            title: "🔥 A Wild Pal Appeared!",
            description: "First trainer to throw a sphere gets the chance!",
            showInventory: false,
          }),
        ],
        components: captureCommand.buildSphereButtons(
          {
            basic: 1,
            mega: 1,
            giga: 1,
            hyper: 1,
            ultra: 1,
            legendary: 1,
          },
          false,
          "spawn"
        ),
      });

      let isResolving = false;
      let isResolved = false;

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
      });

      collector.on("collect", async (buttonInteraction) => {
        try {
          await buttonInteraction.deferUpdate();

          if (isResolved || isResolving) {
            return;
          }

          const [, sphere] = buttonInteraction.customId.split(":");
          const sphereUse = consumeSphere(buttonInteraction.user.id, sphere);

          if (!sphereUse.consumed) {
            await buttonInteraction.followUp({
              content: `❌ You don't have any ${sphereUse.sphere} spheres.`,
              ephemeral: true,
            });
            return;
          }

          isResolving = true;

          await interaction.editReply({
            content: "",
            embeds: [captureCommand.buildThrowEmbed(encounter, sphere)],
            components: captureCommand.buildSphereButtons(
              {
                basic: 1,
                mega: 1,
                giga: 1,
                hyper: 1,
                ultra: 1,
                legendary: 1,
              },
              true,
              "spawn"
            ),
          });

          await new Promise((res) => setTimeout(res, 1000));

          await interaction.editReply({
            content: "",
            embeds: [captureCommand.buildShakeEmbed(encounter)],
            components: captureCommand.buildSphereButtons(
              {
                basic: 1,
                mega: 1,
                giga: 1,
                hyper: 1,
                ultra: 1,
                legendary: 1,
              },
              true,
              "spawn"
            ),
          });

          await new Promise((res) => setTimeout(res, 500));

          const result = resolveCaptureEncounter(
            buttonInteraction.user.id,
            encounter,
            sphere
          );

          await interaction.editReply({
            content: "",
            embeds: [
              captureCommand.buildResolvedEmbed(result, sphereUse.remaining),
            ],
            components: captureCommand.buildSphereButtons(
              {
                basic: 1,
                mega: 1,
                giga: 1,
                hyper: 1,
                ultra: 1,
                legendary: 1,
              },
              true,
              "spawn"
            ),
          });

          isResolved = true;
          collector.stop("resolved");
        } catch (error) {
          console.error("[spawn] Error resolving public encounter:", error);

          try {
            await interaction.editReply({
              content: "❌ Something went wrong while processing /spawn.",
              embeds: [],
              components: captureCommand.buildSphereButtons(
                {
                  basic: 1,
                  mega: 1,
                  giga: 1,
                  hyper: 1,
                  ultra: 1,
                  legendary: 1,
                },
                true,
                "spawn"
              ),
            });
          } catch (editError) {
            console.error("[spawn] Failed to edit spawn reply after error:", editError);
          }

          collector.stop("error");
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "resolved" || reason === "error") {
          return;
        }

        try {
          await interaction.editReply({
            embeds: [
              captureCommand.buildEncounterEmbed(
                encounter,
                getUserInventory(interaction.user.id),
                {
                  title: "🔥 A Wild Pal Appeared!",
                  description: "First trainer to throw a sphere gets the chance!",
                  showInventory: false,
                }
              ),
            ],
            components: captureCommand.buildSphereButtons(
              {
                basic: 1,
                mega: 1,
                giga: 1,
                hyper: 1,
                ultra: 1,
                legendary: 1,
              },
              true,
              "spawn"
            ),
          });
        } catch (error) {
          console.error("[spawn] Failed to disable spawn buttons:", error);
        }
      });
    } catch (error) {
      console.error("[spawn] Error executing /spawn:", error);

      await interaction.editReply("❌ Something went wrong while starting /spawn.");
    }
  },
};
