// services/marketTiming/24hCycle.js

function get24hCycleTimes() {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const nextMidnight = new Date(startOfDay);
  nextMidnight.setDate(nextMidnight.getDate() + 1);

  return {
    startDate: startOfDay,
    endDate: nextMidnight
  };
}

module.exports = { get24hCycleTimes };