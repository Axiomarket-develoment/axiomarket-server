// services/marketTiming/5mCycle.js
function get5mCycleTimes() {
  const now = new Date();

  const startDate = new Date(now);
  startDate.setSeconds(0, 0);

  const endDate = new Date(startDate.getTime() + 5 * 60 * 1000);

  return { startDate, endDate };
}

module.exports = { get5mCycleTimes };