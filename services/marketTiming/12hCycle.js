function get12hCycleTimes() {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const noon = new Date(startOfDay);
  noon.setHours(12, 0, 0, 0);

  let startDate, endDate;

  if (now < noon) {
    // 🟢 First cycle: 00:00 → 12:00
    startDate = startOfDay;
    endDate = noon;
  } else {
    // 🔵 Second cycle: 12:00 → 00:00 (next day)
    startDate = noon;

    const nextMidnight = new Date(startOfDay);
    nextMidnight.setDate(nextMidnight.getDate() + 1);

    endDate = nextMidnight;
  }

  return { startDate, endDate };
}

module.exports = { get12hCycleTimes };