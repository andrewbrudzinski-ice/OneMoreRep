import { describe, expect, it } from 'vitest';
import {
  entryTotals,
  progressRatio,
  scaleMacros,
  sumEntries,
  type SnapshotEntry,
} from './nutrition';

function entry(servings: number, cal: number, p: number, c: number, f: number, fib: number): SnapshotEntry {
  return {
    servings,
    calories_snapshot: cal,
    protein_snapshot: p,
    carbs_snapshot: c,
    fat_snapshot: f,
    fiber_snapshot: fib,
  };
}

describe('scaleMacros', () => {
  it('scales every macro by servings', () => {
    expect(scaleMacros({ calories: 100, protein: 10, carbs: 5, fat: 2, fiber: 1 }, 2.5)).toEqual({
      calories: 250,
      protein: 25,
      carbs: 12.5,
      fat: 5,
      fiber: 2.5,
    });
  });
});

describe('entryTotals', () => {
  it('multiplies the snapshot by servings', () => {
    expect(entryTotals(entry(2, 200, 40, 5, 4, 2))).toEqual({
      calories: 400,
      protein: 80,
      carbs: 10,
      fat: 8,
      fiber: 4,
    });
  });
});

describe('sumEntries', () => {
  it('adds up a day of entries', () => {
    const totals = sumEntries([
      entry(1, 300, 30, 40, 10, 5), // breakfast
      entry(2, 250, 25, 20, 8, 3), // lunch (×2)
      entry(1, 500, 40, 45, 20, 6), // dinner
    ]);
    expect(totals).toEqual({
      calories: 300 + 500 + 500,
      protein: 30 + 50 + 40,
      carbs: 40 + 40 + 45,
      fat: 10 + 16 + 20,
      fiber: 5 + 6 + 6,
    });
  });

  it('is zero for an empty day', () => {
    expect(sumEntries([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });
});

describe('progressRatio', () => {
  it('clamps to [0,1] and handles null/zero targets', () => {
    expect(progressRatio(50, 100)).toBe(0.5);
    expect(progressRatio(150, 100)).toBe(1);
    expect(progressRatio(50, null)).toBe(0);
    expect(progressRatio(50, 0)).toBe(0);
  });
});
