// services/marketTiming/1hCycle.js
function get1hCycleTimes() {
  const now = new Date();

  const startDate = new Date(now);
  startDate.setMinutes(0, 0, 0); // reset to start of the hour

  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour

  return { startDate, endDate };
}

module.exports = { get1hCycleTimes };