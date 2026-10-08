export function weekFromDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const week = Math.floor((date.getTime() - start.getTime()) / 604_800_000) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function datesForPerformanceWeek(week: string) {
  const year = Number(week.slice(0, 4));
  if (!/^\d{4}-W\d{2}$/.test(week) || !Number.isFinite(year)) return [];
  const dates: string[] = [];
  for (let date = new Date(Date.UTC(year, 0, 1)); date.getUTCFullYear() === year; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    if (weekFromDate(key) === week) dates.push(key);
  }
  return dates;
}
