/**
 * Nutrition math — pure, unit-tested. Food entries store a per-serving macro
 * snapshot taken at log time; an entry's contribution is that snapshot scaled
 * by its servings. Editing the underlying food later never changes past logs.
 */

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const ZERO_MACROS: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
};

/** Per-serving macros (e.g. from a Food row). */
export interface PerServingMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** The snapshot fields carried on a food entry, plus its servings. */
export interface SnapshotEntry {
  servings: number;
  calories_snapshot: number;
  protein_snapshot: number;
  carbs_snapshot: number;
  fat_snapshot: number;
  fiber_snapshot: number;
}

export function scaleMacros(perServing: PerServingMacros, servings: number): MacroTotals {
  return {
    calories: perServing.calories * servings,
    protein: perServing.protein * servings,
    carbs: perServing.carbs * servings,
    fat: perServing.fat * servings,
    fiber: perServing.fiber * servings,
  };
}

export function addMacros(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

/** The macro contribution of a single logged entry (snapshot × servings). */
export function entryTotals(entry: SnapshotEntry): MacroTotals {
  return scaleMacros(
    {
      calories: entry.calories_snapshot,
      protein: entry.protein_snapshot,
      carbs: entry.carbs_snapshot,
      fat: entry.fat_snapshot,
      fiber: entry.fiber_snapshot,
    },
    entry.servings,
  );
}

/** Sum the macro contributions of many entries. */
export function sumEntries(entries: readonly SnapshotEntry[]): MacroTotals {
  return entries.reduce((total, entry) => addMacros(total, entryTotals(entry)), { ...ZERO_MACROS });
}

/** Progress ratio toward a target, clamped to [0, 1]. null target → 0. */
export function progressRatio(value: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

/** Whether a value has met-or-exceeded its target (for ring "complete" state). */
export function isTargetMet(value: number, target: number | null): boolean {
  return target !== null && target > 0 && value >= target;
}
