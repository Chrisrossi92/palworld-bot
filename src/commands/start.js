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
    .setDescription("Start your PalMaster journey and claim starter rewards."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await claimStarterRewards(interaction.guildId, interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle("Welcome to PalMaster")
      .setColor(result.claimed ? 0x2ecc71 : 0x95a5a6)
      .setDescription(
        "Start here. Claim your starter rewards, then catch Pals, earn rewards, and climb the rankings."
      )
      .addFields(
        {
          name: "Starter Rewards",
          value: formatStarterStatus(result),
        },
        {
          name: "First 5 Minutes",
          value:
            "`/capture` - Encounter and try to catch a wild Pal\n" +
            "`/daily` - Claim daily coins, XP, and spheres\n" +
            "`/quests` - Check goals and claim completed rewards\n" +
            "`/profile` or `/mypals` - Track your progress and collection\n" +
            "`/leaderboard` - See how your server ranks",
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
