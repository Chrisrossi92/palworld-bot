require("dotenv").config();

const { registerConfiguredCommands } = require("./commandRegistration");

async function registerCommands() {
  try {
    await registerConfiguredCommands();
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
    process.exitCode = 1;
  }
}

registerCommands();
