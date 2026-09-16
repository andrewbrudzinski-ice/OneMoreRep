import { describe, expect, it } from 'vitest';
import { addDays, dayDiff, startOfWeek } from './dates';

describe('dates', () => {
  it('dayDiff counts whole calendar days', () => {
    expect(dayDiff('2026-08-14', '2026-08-10')).toBe(4);
    expect(dayDiff('2026-08-10', '2026-08-14')).toBe(-4);
  });

  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  describe('startOfWeek (Monday)', () => {
    it('returns the same day when given a Monday', () => {
      // 2026-08-10 is a Monday.
      expect(startOfWeek('2026-08-10')).toBe('2026-08-10');
    });

    it('walks back to Monday from mid-week', () => {
      expect(startOfWeek('2026-08-14')).toBe('2026-08-10'); // Friday → Monday
    });

    it('treats Sunday as the end of the Monday-started week', () => {
      expect(startOfWeek('2026-08-16')).toBe('2026-08-10'); // Sunday → prior Monday
    });
  });
});
