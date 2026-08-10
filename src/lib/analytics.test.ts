import { describe, expect, it } from 'vitest';
import { addDays, dayDiff } from './dates';
import {
  averageWithinDays,
  rollingAverageByDays,
  trailingAverage,
  type DatedValue,
} from './rollingAverage';
import { countInLastDays, currentStreak, longestStreak, uniqueSortedDates } from './streak';

describe('date helpers', () => {
  it('dayDiff counts whole days', () => {
    expect(dayDiff('2026-08-10', '2026-08-03')).toBe(7);
    expect(dayDiff('2026-01-01', '2026-01-01')).toBe(0);
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('trailingAverage', () => {
  it('averages the trailing window', () => {
    expect(trailingAverage([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
  });
  it('window of 1 is the identity', () => {
    expect(trailingAverage([5, 7, 9], 1)).toEqual([5, 7, 9]);
  });
});

describe('rollingAverageByDays', () => {
  const daily: DatedValue[] = [
    { date: '2026-08-01', value: 200 },
    { date: '2026-08-02', value: 202 },
    { date: '2026-08-03', value: 198 },
    { date: '2026-08-04', value: 204 },
  ];

  it('smooths daily jitter with a trailing window', () => {
    const avg = rollingAverageByDays(daily, 3);
    expect(avg[0]).toBeCloseTo(200, 6);
    expect(avg[1]).toBeCloseTo(201, 6); // (200+202)/2
    expect(avg[2]).toBeCloseTo(200, 6); // (200+202+198)/3
    expect(avg[3]).toBeCloseTo(201.333, 3); // (202+198+204)/3
  });

  it('respects gaps in dates (window is by days, not samples)', () => {
    const gapped: DatedValue[] = [
      { date: '2026-08-01', value: 100 },
      { date: '2026-08-10', value: 200 }, // 9 days later — outside a 7-day window
    ];
    expect(rollingAverageByDays(gapped, 7)[1]).toBe(200);
  });
});

describe('averageWithinDays', () => {
  const points: DatedValue[] = [
    { date: '2026-08-01', value: 200 },
    { date: '2026-08-08', value: 210 },
    { date: '2026-08-10', value: 190 },
  ];
  it('averages only points inside the window', () => {
    // last 7 days up to 2026-08-10 → 08-08 (gap 2) and 08-10 (gap 0); 08-01 gap 9 excluded
    expect(averageWithinDays(points, 7, '2026-08-10')).toBe(200);
  });
  it('returns null when nothing is in range', () => {
    expect(averageWithinDays(points, 7, '2027-01-01')).toBeNull();
  });
});

describe('streaks', () => {
  it('counts consecutive days ending today', () => {
    const dates = ['2026-08-08', '2026-08-09', '2026-08-10'];
    expect(currentStreak(dates, '2026-08-10')).toBe(3);
  });

  it('keeps a live streak when today is not yet trained (anchors to yesterday)', () => {
    const dates = ['2026-08-08', '2026-08-09'];
    expect(currentStreak(dates, '2026-08-10')).toBe(2);
  });

  it('is 0 when the last workout is older than yesterday', () => {
    expect(currentStreak(['2026-08-01'], '2026-08-10')).toBe(0);
  });

  it('ignores duplicate days and gaps', () => {
    const dates = ['2026-08-10', '2026-08-10', '2026-08-09', '2026-08-06'];
    expect(currentStreak(dates, '2026-08-10')).toBe(2);
  });

  it('longestStreak finds the longest run', () => {
    const dates = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-06', '2026-08-07'];
    expect(longestStreak(dates)).toBe(3);
  });

  it('countInLastDays counts distinct days in the window', () => {
    const dates = ['2026-08-10', '2026-08-08', '2026-08-05', '2026-08-01'];
    expect(countInLastDays(dates, 7, '2026-08-10')).toBe(3); // 10, 08, 05
  });

  it('uniqueSortedDates dedupes and sorts', () => {
    expect(uniqueSortedDates(['2026-08-10', '2026-08-01', '2026-08-10'])).toEqual([
      '2026-08-01',
      '2026-08-10',
    ]);
  });
});
