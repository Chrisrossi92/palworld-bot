require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const pingCommand = require("./commands/ping");
const captureCommand = require("./commands/capture");
const myPalsCommand = require("./commands/mypals");
const leaderboardCommand = require("./commands/leaderboard");
const profileCommand = require("./commands/profile");
const dailyCommand = require("./commands/daily");
const spawnCommand = require("./commands/spawn");
const inspectCommand = require("./commands/inspect");
const shopCommand = require("./commands/shop");
const buyCommand = require("./commands/buy");
const helpCommand = require("./commands/help");
const startCommand = require("./commands/start");
const questsCommand = require("./commands/quests");
const { startSpawnSystem } = require("./systems/spawnSystem");

const UNKNOWN_INTERACTION_CODE = 10062;
const INTERACTION_ALREADY_ACKNOWLEDGED_CODE = 40060;

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.commands.set(pingCommand.data.name, pingCommand);
client.commands.set(captureCommand.data.name, captureCommand);
client.commands.set(myPalsCommand.data.name, myPalsCommand);
client.commands.set(leaderboardCommand.data.name, leaderboardCommand);
client.commands.set(profileCommand.data.name, profileCommand);
client.commands.set(dailyCommand.data.name, dailyCommand);
client.commands.set(spawnCommand.data.name, spawnCommand);
client.commands.set(inspectCommand.data.name, inspectCommand);
client.commands.set(shopCommand.data.name, shopCommand);
client.commands.set(buyCommand.data.name, buyCommand);
client.commands.set(helpCommand.data.name, helpCommand);
client.commands.set(startCommand.data.name, startCommand);
client.commands.set(questsCommand.data.name, questsCommand);

client.once("ready", () => {
  console.log(`✅ Palworld Bot online as ${client.user.tag}`);
  console.log(`Connected to ${client.guilds.cache.size} guild(s).`);
  console.log(
    `[runtime] pid=${process.pid} storageProvider=${getStorageProviderLabel()}`
  );
  startSpawnSystem(client);
});

client.on("guildCreate", (guild) => {
  console.log(
    `[guildCreate] Added to guild id=${guild.id} name="${guild.name}" members=${guild.memberCount ?? "unknown"}`
  );
});

client.on("guildDelete", (guild) => {
  console.log(`[guildDelete] Removed from guild id=${guild.id} name="${guild.name}"`);
});

function getStorageProviderLabel() {
  return process.env.STORAGE_PROVIDER || "json";
}

function getInteractionLogContext(interaction) {
  return [
    `id=${interaction.id}`,
    `command=${interaction.commandName || "unknown"}`,
    `guild=${interaction.guildId || "dm"}`,
    `user=${interaction.user?.id || "unknown"}`,
    `deferred=${interaction.deferred}`,
    `replied=${interaction.replied}`,
    `provider=${getStorageProviderLabel()}`,
    `pid=${process.pid}`,
  ].join(" ");
}

function isUnknownInteractionError(error) {
  return error && error.code === UNKNOWN_INTERACTION_CODE;
}

function isAlreadyAcknowledgedError(error) {
  return error && error.code === INTERACTION_ALREADY_ACKNOWLEDGED_CODE;
}

function isInteractionNotRepliedError(error) {
  return error && error.name === "InteractionNotReplied";
}

function logInteractionState(label, interaction) {
  console.log(`[interaction:${label}] ${getInteractionLogContext(interaction)}`);
}

function logSkippedErrorResponse(reason, interaction, error) {
  console.warn(
    `[interaction:error-response-skipped] reason=${reason} ${getInteractionLogContext(interaction)} code=${error?.code || "none"}`
  );
}

async function sendInteractionError(interaction) {
  const payload = {
    content: "❌ Something went wrong running that command.",
  };

  try {
    if (interaction.deferred) {
      await interaction.editReply(payload);
      return;
    }

    if (interaction.replied) {
      await interaction.followUp({
        ...payload,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      ...payload,
      ephemeral: true,
    });
  } catch (error) {
    if (isUnknownInteractionError(error)) {
      logSkippedErrorResponse("unknown-or-expired", interaction, error);
      return;
    }

    if (isAlreadyAcknowledgedError(error)) {
      logSkippedErrorResponse("already-acknowledged", interaction, error);
      return;
    }

    if (isInteractionNotRepliedError(error)) {
      logSkippedErrorResponse("not-replied", interaction, error);
      return;
    }

    throw error;
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return;
  }

  logInteractionState("dispatch", interaction);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `[interaction:command-error] ${getInteractionLogContext(interaction)} code=${error?.code || "none"}`,
      error
    );

    try {
      await sendInteractionError(interaction);
    } catch (replyError) {
      console.error("Failed to send interaction error response:", replyError);
    }
  }
});

client.login(requireEnv("DISCORD_TOKEN"));
