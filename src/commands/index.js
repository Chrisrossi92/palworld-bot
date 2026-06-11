const pingCommand = require("./ping");
const captureCommand = require("./capture");
const myPalsCommand = require("./mypals");
const leaderboardCommand = require("./leaderboard");
const profileCommand = require("./profile");
const trainerCommand = require("./trainer");
const journalCommand = require("./journal");
const paldeckCommand = require("./paldeck");
const dailyCommand = require("./daily");
const spawnCommand = require("./spawn");
const inspectCommand = require("./inspect");
const shopCommand = require("./shop");
const buyCommand = require("./buy");
const helpCommand = require("./help");
const startCommand = require("./start");
const questsCommand = require("./quests");

const commandModules = [
  pingCommand,
  captureCommand,
  myPalsCommand,
  leaderboardCommand,
  profileCommand,
  trainerCommand,
  journalCommand,
  paldeckCommand,
  dailyCommand,
  spawnCommand,
  inspectCommand,
  shopCommand,
  buyCommand,
  helpCommand,
  startCommand,
  questsCommand,
];

const commandPayloads = commandModules.map((command) => command.data.toJSON());

module.exports = {
  commandModules,
  commandPayloads,
};
