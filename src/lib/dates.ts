/**
 * Small date helpers for calendar-day math on "YYYY-MM-DD" strings. All math
 * is done in UTC day-numbers so it never drifts across timezones/DST.
 */

/** Integer day number (days since the Unix epoch) for a "YYYY-MM-DD" date. */
export function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/** Whole calendar days from `b` to `a` (a - b). */
export function dayDiff(a: string, b: string): number {
  return dayNumber(a) - dayNumber(b);
}

/** Add `n` days to a "YYYY-MM-DD" date, returning a "YYYY-MM-DD" date. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
