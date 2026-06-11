require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { commandModules } = require("./commands");
const { registerGuildCommands } = require("./commandRegistration");
const {
  ensureDefaultSpawnSettingsForGuild,
  startSpawnSystem,
} = require("./systems/spawnSystem");

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
for (const command of commandModules) {
  client.commands.set(command.data.name, command);
}

client.once("ready", () => {
  console.log(`✅ Palworld Bot online as ${client.user.tag}`);
  console.log(`Connected to ${client.guilds.cache.size} guild(s).`);
  console.log(
    `[runtime] pid=${process.pid} storageProvider=${getStorageProviderLabel()}`
  );
  startSpawnSystem(client);
});

client.on("guildCreate", async (guild) => {
  console.log(
    `[guildCreate] Added to guild id=${guild.id} name="${guild.name}" members=${guild.memberCount ?? "unknown"}`
  );

  try {
    await registerGuildCommands(guild.id);
  } catch (error) {
    console.error(
      `[guildCreate] Failed to register slash commands for guild id=${guild.id} name="${guild.name}" code=${error?.code || "none"}`,
      error
    );
  }

  await ensureDefaultSpawnSettingsForGuild(guild);
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
