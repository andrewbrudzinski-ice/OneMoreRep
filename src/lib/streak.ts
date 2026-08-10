import { addDays } from './dates';

/**
 * Workout streak & frequency — pure, unit-tested. A "streak" is the run of
 * consecutive calendar days with a completed workout, ending today (or
 * yesterday, so an as-yet-untrained today doesn't break a live streak).
 */

/** Unique "YYYY-MM-DD" days, ascending. */
export function uniqueSortedDates(dates: readonly string[]): string[] {
  return [...new Set(dates)].sort();
}

/**
 * Consecutive-day streak ending at `today` or `yesterday`. Returns 0 if the
 * most recent workout is older than yesterday.
 */
export function currentStreak(dates: readonly string[], today: string): number {
  const set = new Set(dates);
  let anchor: string;
  if (set.has(today)) anchor = today;
  else if (set.has(addDays(today, -1))) anchor = addDays(today, -1);
  else return 0;

  let streak = 0;
  let cursor = anchor;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest consecutive-day run anywhere in the history. */
export function longestStreak(dates: readonly string[]): number {
  const sorted = uniqueSortedDates(dates);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of sorted) {
    if (prev !== null && addDays(prev, 1) === date) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}

/** Count of days (from the set) within the last `days` days up to `today`. */
export function countInLastDays(dates: readonly string[], days: number, today: string): number {
  const set = new Set(dates);
  let count = 0;
  for (let i = 0; i < days; i++) {
    if (set.has(addDays(today, -i))) count += 1;
  }
  return count;
}
