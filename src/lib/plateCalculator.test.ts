import { describe, expect, it } from 'vitest';
import {
  computePlates,
  DEFAULT_PLATES_KG,
  DEFAULT_PLATES_LBS,
  formatPerSide,
} from './plateCalculator';

function perSideMap(target: number, bar = 45, plates = DEFAULT_PLATES_LBS) {
  const result = computePlates(target, bar, plates);
  const map: Record<number, number> = {};
  for (const p of result.perSide) map[p.plate] = p.count;
  return { result, map };
}

describe('computePlates (lbs, 45 bar)', () => {
  it('135 → one 45 per side', () => {
    const { result, map } = perSideMap(135);
    expect(map).toEqual({ 45: 1 });
    expect(result.achievable).toBe(true);
    expect(result.perSideWeight).toBe(45);
  });

  it('185 → 45 + 25 per side', () => {
    const { map, result } = perSideMap(185);
    expect(map).toEqual({ 45: 1, 25: 1 });
    expect(result.achievable).toBe(true);
    expect(formatPerSide(result)).toBe('45 + 25');
  });

  it('225 → two 45s per side', () => {
    const { map } = perSideMap(225);
    expect(map).toEqual({ 45: 2 });
  });

  it('100 → 25 + 2.5 per side, exactly achievable', () => {
    const { map, result } = perSideMap(100);
    expect(map).toEqual({ 25: 1, 2.5: 1 });
    expect(result.achievable).toBe(true);
  });

  it('empty bar (45) → no plates, achievable', () => {
    const { result } = perSideMap(45);
    expect(result.perSide).toEqual([]);
    expect(result.achievable).toBe(true);
    expect(formatPerSide(result)).toBe('empty bar');
  });

  it('target below bar → not achievable, leftover reported', () => {
    const result = computePlates(30, 45, DEFAULT_PLATES_LBS);
    expect(result.achievable).toBe(false);
    expect(result.perSide).toEqual([]);
  });

  it('unreachable remainder → leftover > 0, not achievable', () => {
    // 46 lbs on a 45 bar = 0.5/side, smaller than any plate.
    const result = computePlates(46, 45, DEFAULT_PLATES_LBS);
    expect(result.achievable).toBe(false);
    expect(result.leftover).toBeGreaterThan(0);
  });

  it('greedy uses the largest plates first', () => {
    // 315 = 135/side → 45+45+45
    const { map } = perSideMap(315);
    expect(map).toEqual({ 45: 3 });
  });
});

describe('computePlates (kg, 20 bar)', () => {
  it('60 kg → one 20 per side', () => {
    const result = computePlates(60, 20, DEFAULT_PLATES_KG);
    expect(result.perSide).toEqual([{ plate: 20, count: 1 }]);
    expect(result.achievable).toBe(true);
  });

  it('102.5 kg → 41.25/side = 25 + 15 + 1.25 (largest-first greedy)', () => {
    const result = computePlates(102.5, 20, DEFAULT_PLATES_KG);
    const map: Record<number, number> = {};
    for (const p of result.perSide) map[p.plate] = p.count;
    expect(map).toEqual({ 25: 1, 15: 1, 1.25: 1 });
    expect(result.achievable).toBe(true);
  });
});
