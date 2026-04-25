const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show how to use Palworld Bot commands."),

  async execute(interaction) {
    await interaction.deferReply();

    const embed = new EmbedBuilder()
      .setTitle("🎮 Palworld Bot Help")
      .setColor(0x2ecc71)
      .addFields(
        {
          name: "📦 Core Gameplay",
          value:
            "`/capture` — Encounter a wild Pal\n" +
            "`/spawn` — (Admin) Spawn a public Pal\n" +
            "`/daily` — Claim daily rewards",
        },
        {
          name: "📊 Your Progress",
          value:
            "`/profile` — View your stats\n" +
            "`/mypals` — View your collection\n" +
            "`/inspect` — View a specific Pal",
        },
        {
          name: "🏪 Economy",
          value:
            "`/shop` — View sphere prices\n" +
            "`/buy` — Purchase spheres",
        },
        {
          name: "💰 Earning Rewards",
          value:
            "`/capture` — Earn coins and XP whether you catch or miss\n" +
            "`/daily` — Claim daily coins, XP, and sphere rewards\n" +
            "Public spawns — First player to throw gets the reward chance\n" +
            "Shiny Pals — Give bonus XP and coins",
        },
        {
          name: "🏆 Competition",
          value: "`/leaderboard` — View rankings",
        },
        {
          name: "💡 Tips",
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
