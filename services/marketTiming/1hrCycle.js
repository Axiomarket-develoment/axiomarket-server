function get1hCycleTimes() {
  const now = new Date();

  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(), // exact hour in UTC
      0,
      0,
      0
    )
  );

  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  return { startDate, endDate };
}

module.exports = { get1hCycleTimes };