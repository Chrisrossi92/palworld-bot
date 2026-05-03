const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { claimStarterRewards } = require("../systems/captureSystem");

function formatStarterStatus(result) {
  if (!result.claimed) {
    return "Already claimed. No extra rewards were granted.";
  }

  return `Granted:
+${result.rewards.coins} coins
+${result.rewards.spheres.basic} basic spheres
+${result.rewards.spheres.mega} mega spheres
+${result.rewards.spheres.giga} giga sphere`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start your Palworld Bot journey and claim starter rewards."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = claimStarterRewards(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle("Welcome to Palworld Bot")
      .setColor(result.claimed ? 0x2ecc71 : 0x95a5a6)
      .setDescription(
        "Capture Pals, build your collection, earn rewards, and climb the rankings."
      )
      .addFields(
        {
          name: "Starter Rewards",
          value: formatStarterStatus(result),
        },
        {
          name: "Gameplay Loop",
          value:
            "`/daily` - Claim daily coins, XP, and spheres\n" +
            "`/capture` - Encounter and try to catch a wild Pal\n" +
            "`/mypals` - View your Pal collection\n" +
            "`/inspect` - Inspect a specific Pal\n" +
            "`/shop` and `/buy` - Check prices and buy spheres\n" +
            "`/leaderboard` - Compare progress with other players",
        },
        {
          name: "Current Inventory",
          value:
            `${result.user.coins} coins\n` +
            `Basic: ${result.user.spheres.basic}\n` +
            `Mega: ${result.user.spheres.mega}\n` +
            `Giga: ${result.user.spheres.giga}`,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
