const cron = require("node-cron");
const Market = require("../models/Market");
const { generateMarkets } = require("../services/market/marketGenerator");

// ---------------------
// helper
// ---------------------
async function runCycle(durationMinutes, minLive, label) {
  const liveCount = await Market.countDocuments({
    status: "LIVE",
    durationMinutes
  });

  console.log(`📊 ${label} LIVE: ${liveCount}`);

  if (liveCount < minLive) {
    console.log(`⚡ Generating ${label} markets...`);

    await generateMarkets({
      durationMinutes
    });
  }
}

// ---------------------
// 5 MIN CYCLE
// ---------------------
function start5mCron() {
  cron.schedule("*/1 * * * *", async () => {
    await runCycle(5, 20, "5m");
  });
}

// ---------------------
// 1 HOUR CYCLE
// ---------------------
// function start1hCron() {
//   cron.schedule("*/1 * * * *", async () => {
//     await runCycle(60, 15, "1h");
//   });
// }

// // ---------------------
// // 12 HOUR CYCLE
// // ---------------------
// function start12hCron() {
//   cron.schedule("*/10 * * * *", async () => {
//     await runCycle(720, 10, "12h");
//   });
// }

// // ---------------------
// // 24 HOUR CYCLE
// // ---------------------
// function start24hCron() {
//   cron.schedule("*/15 * * * *", async () => {
//     await runCycle(1440, 8, "24h");
//   });
// }

function startAllCycleCrons() {
  // start1hCron();
  // start12hCron();
  // start24hCron();
  start5mCron();

  console.log("🚀 All cycle crons started");
}

module.exports = { startAllCycleCrons };