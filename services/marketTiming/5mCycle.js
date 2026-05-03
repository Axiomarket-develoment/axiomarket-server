function get5mCycleTimes() {
  const now = new Date();

  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes() - (now.getUTCMinutes() % 5),
      0,
      0
    )
  );

  const endDate = new Date(startDate.getTime() + 5 * 60 * 1000);

  return { startDate, endDate };
}

module.exports = { get5mCycleTimes };