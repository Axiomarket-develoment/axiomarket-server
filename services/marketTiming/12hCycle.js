function get12hCycleTimes() {
  const now = new Date();

  const startOfDay = new Date(
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

  const noon = new Date(startOfDay.getTime() + 12 * 60 * 60 * 1000);

  const nowUTC = Date.now();

  let startDate, endDate;

  if (nowUTC < noon.getTime()) {
    startDate = startOfDay;
    endDate = noon;
  } else {
    startDate = noon;
    endDate = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
}

module.exports = { get12hCycleTimes };