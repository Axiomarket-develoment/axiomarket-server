function get24hCycleTimes() {
  const now = new Date();

  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

  return { startDate, endDate };
}

module.exports = { get24hCycleTimes };