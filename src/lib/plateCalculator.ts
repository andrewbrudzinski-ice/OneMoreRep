import type { Units } from '../types';

/**
 * Plate calculator — pure, no storage. Given a target weight and bar weight,
 * compute the per-side plate breakdown using the available plate sizes
 * (largest-first greedy). See spec §6.
 */

export const DEFAULT_PLATES_LBS = [45, 35, 25, 10, 5, 2.5];
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export const DEFAULT_BAR_LBS = 45;
export const DEFAULT_BAR_KG = 20;

export function defaultPlates(unit: Units): number[] {
  return unit === 'kg' ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LBS;
}

export function defaultBar(unit: Units): number {
  return unit === 'kg' ? DEFAULT_BAR_KG : DEFAULT_BAR_LBS;
}

export interface PlateCount {
  plate: number;
  count: number;
}

export interface PlateResult {
  targetWeight: number;
  barWeight: number;
  /** Per-side plate stack, largest first. */
  perSide: PlateCount[];
  /** Total weight loaded on one side. */
  perSideWeight: number;
  /** Weight that couldn't be matched by the available plates (per side ×2). */
  leftover: number;
  /** True when the target is reachable exactly (bar + matched plates). */
  achievable: boolean;
}

const EPSILON = 1e-6;

/**
 * Compute the per-side plate breakdown for `targetWeight` on a `barWeight`
 * bar. Plate inventory is treated as unlimited; `availablePlates` just defines
 * which sizes exist. Any unreachable remainder is reported as `leftover`.
 */
export function computePlates(
  targetWeight: number,
  barWeight: number,
  availablePlates: readonly number[],
): PlateResult {
  const base: PlateResult = {
    targetWeight,
    barWeight,
    perSide: [],
    perSideWeight: 0,
    leftover: 0,
    achievable: false,
  };

  // Can't load a bar heavier than the target, or a negative target.
  if (targetWeight < barWeight - EPSILON) {
    return { ...base, leftover: Math.max(0, targetWeight - barWeight) };
  }

  let remainingPerSide = (targetWeight - barWeight) / 2;
  const plates = [...availablePlates].sort((a, b) => b - a);
  const perSide: PlateCount[] = [];

  for (const plate of plates) {
    if (plate <= 0) continue;
    const count = Math.floor((remainingPerSide + EPSILON) / plate);
    if (count > 0) {
      perSide.push({ plate, count });
      remainingPerSide -= count * plate;
    }
  }

  const leftover = remainingPerSide <= EPSILON ? 0 : remainingPerSide * 2;
  const perSideWeight = perSide.reduce((sum, p) => sum + p.plate * p.count, 0);

  return {
    targetWeight,
    barWeight,
    perSide,
    perSideWeight,
    leftover,
    achievable: leftover <= EPSILON,
  };
}

/** Human-readable per-side summary, e.g. "45 + 25" or "empty bar". */
export function formatPerSide(result: PlateResult): string {
  if (result.perSide.length === 0) return 'empty bar';
  return result.perSide
    .flatMap((p) => Array<number>(p.count).fill(p.plate))
    .join(' + ');
}
