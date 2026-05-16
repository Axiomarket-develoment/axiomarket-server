function get15mCycleTimes() {
  const now = new Date();

  const minutes = now.getUTCMinutes();

  // Round down to nearest 15
  const roundedMinutes = Math.floor(minutes / 15) * 15;

  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      roundedMinutes,
      0,
      0
    )
  );

  const endDate = new Date(
    startDate.getTime() + 15 * 60 * 1000
  );

  return { startDate, endDate };
}

module.exports = { get15mCycleTimes };