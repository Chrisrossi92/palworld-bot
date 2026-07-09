const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show how to use PalMaster commands."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setTitle("PalMaster Help")
      .setColor(0x2ecc71)
      .addFields(
        {
          name: "First 5 Minutes",
          value:
            "`/start` -> `/capture` -> `/daily` -> `/quests` -> " +
            "`/profile` or `/mypals` -> `/leaderboard`",
        },
        {
          name: "Core Gameplay",
          value:
            "`/capture` — Encounter a wild Pal\n" +
            "`/daily` — Claim daily rewards\n" +
            "`/quests` — View daily quests and claim quest rewards",
        },
        {
          name: "Your Progress",
          value:
            "`/profile` — View your stats\n" +
            "`/trainer` — Share your trainer card\n" +
            "`/journal` — View your Journal milestones\n" +
            "`/paldeck` — View collection completion\n" +
            "`/mypals` — View your collection\n" +
            "`/inspect` — View a specific Pal",
        },
        {
          name: "Economy",
          value:
            "`/shop` — View sphere prices\n" +
            "`/buy` — Purchase spheres",
        },
        {
          name: "Earning Rewards",
          value:
            "`/capture` — Earn coins and XP whether you catch or miss\n" +
            "`/daily` — Claim daily coins, XP, and sphere rewards\n" +
            "Shiny Pals — Give bonus XP and coins",
        },
        {
          name: "Competition",
          value: "`/leaderboard` — View rankings",
        },
        {
          name: "Tips",
          value:
            "• Better spheres increase capture chance\n" +
            "• Duplicates strengthen your Pal with stars\n" +
            "• Rare Pals give better rewards\n" +
            "• Shiny Pals give bonus XP and coins",
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
