function get6hCycleTimes() {
  const now = new Date();

  const currentHour = now.getUTCHours();

  // 0, 6, 12, 18
  const roundedHour = Math.floor(currentHour / 6) * 6;

  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      roundedHour,
      0,
      0,
      0
    )
  );

  const endDate = new Date(
    startDate.getTime() + 6 * 60 * 60 * 1000
  );

  return { startDate, endDate };
}

module.exports = { get6hCycleTimes };