import { dayDiff } from './dates';

/**
 * Rolling / trailing averages — pure, unit-tested. Trends use these so one
 * jittery day (a heavy meal, water weight) never spikes a line.
 */

/** Trailing average over the last `window` samples for each index. */
export function trailingAverage(values: readonly number[], window: number): number[] {
  if (window < 1) throw new Error('window must be >= 1');
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    let sum = 0;
    for (let j = start; j <= i; j++) sum += values[j]!;
    out.push(sum / (i - start + 1));
  }
  return out;
}

export interface DatedValue {
  date: string; // YYYY-MM-DD
  value: number;
}

/**
 * Date-aware trailing average: for each point, the mean of all points whose
 * date falls within the trailing `days`-day window ending at that point.
 * Points must be sorted ascending by date.
 */
export function rollingAverageByDays(points: readonly DatedValue[], days: number): number[] {
  if (days < 1) throw new Error('days must be >= 1');
  return points.map((point, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      const gap = dayDiff(point.date, points[j]!.date);
      if (gap >= days) break;
      sum += points[j]!.value;
      count += 1;
    }
    return sum / count;
  });
}

/** Mean of the points whose date is within the last `days` days up to `asOf`. */
export function averageWithinDays(
  points: readonly DatedValue[],
  days: number,
  asOf: string,
): number | null {
  const inWindow = points.filter((p) => {
    const gap = dayDiff(asOf, p.date);
    return gap >= 0 && gap < days;
  });
  if (inWindow.length === 0) return null;
  return inWindow.reduce((s, p) => s + p.value, 0) / inWindow.length;
}
