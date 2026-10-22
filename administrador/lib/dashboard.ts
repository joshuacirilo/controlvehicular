const DAY_MS = 86_400_000;

/** Bounds for the existing wall-clock BSON dates, not ordinary UTC timestamps. */
export function dashboardPeriod(value: unknown, now = new Date()) {
  const days = value === '30' ? 30 : 7;
  const local = new Date(now.getTime() - 6 * 3_600_000);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start = new Date(today - (days - 1) * DAY_MS);
  const end = new Date(today + DAY_MS);
  const dates = Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10));
  return { days, start, end, dates };
}
