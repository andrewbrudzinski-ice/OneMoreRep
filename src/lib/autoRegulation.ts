import type { Units } from '../types';

/**
 * Progression engine — two complementary systems:
 *
 *  1. Double-progression target (new, primary): looks at whether all sets were
 *     completed last session. If yes → bump weight by one increment. If not →
 *     hold at the same weight. Fires every session so you always see a target.
 *
 *  2. RPE auto-regulation (legacy): requires RPE ≤ 7 across two sessions.
 *     Still computed in the background; kept for backward compat.
 *
 * Both are pure functions, unit-testable, with no side effects.
 */

// ---------------------------------------------------------------------------
// Double-progression target (primary)
// ---------------------------------------------------------------------------

export type ProgressionStatus = 'first_time' | 'progress' | 'maintain';

export interface ProgressionTarget {
  status: ProgressionStatus;
  /** The weight to aim for today. */
  weight: number | null;
  /** Representative reps from last session (median of completed working sets). */
  reps: number | null;
  /** Short label shown on the chip, e.g. "↑ 102.5 kg" or "→ 100 kg". */
  label: string;
  /** One-line plain-English explanation. */
  detail: string;
}

/**
 * Compute the next-session target from the last session's sets.
 * Rule: all working sets completed → progress (weight + increment).
 *       Any incomplete → maintain (same weight, hit them all first).
 *       No prior data → first_time.
 */
export function computeProgressionTarget(
  lastSets: readonly { weight: number; reps: number; is_warmup: boolean; is_completed: boolean }[],
  unit: Units,
): ProgressionTarget {
  const working = lastSets.filter((s) => !s.is_warmup);
  if (working.length === 0) {
    return { status: 'first_time', weight: null, reps: null, label: 'First time', detail: '' };
  }

  const completed = working.filter((s) => s.is_completed);
  if (completed.length === 0) {
    return { status: 'first_time', weight: null, reps: null, label: 'First time', detail: '' };
  }

  const maxWeight = Math.max(...completed.map((s) => s.weight));
  const medianReps = Math.round(
    completed.reduce((sum, s) => sum + s.reps, 0) / completed.length,
  );
  const inc = defaultIncrement(unit);
  const allDone = completed.length === working.length;

  if (allDone) {
    const next = maxWeight + inc;
    return {
      status: 'progress',
      weight: next,
      reps: medianReps,
      label: `↑ ${next} ${unit}`,
      detail: `All ${working.length} set${working.length !== 1 ? 's' : ''} complete last time — add ${inc} ${unit}`,
    };
  }

  return {
    status: 'maintain',
    weight: maxWeight,
    reps: medianReps,
    label: `→ ${maxWeight} ${unit}`,
    detail: `${completed.length} of ${working.length} sets complete last time — hit all sets to progress`,
  };
}

// ---------------------------------------------------------------------------
// RPE auto-regulation (legacy — kept for backward compat)
// ---------------------------------------------------------------------------

export const RPE_EASY_THRESHOLD = 7;

export interface RpeSet {
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  is_completed: boolean;
}

export interface AutoRegResult {
  suggest: boolean;
  increment: number;
  unit: Units;
  suggestedWeight: number | null;
  reason: string | null;
}

/** Default progression increment for a unit. */
export function defaultIncrement(unit: Units): number {
  return unit === 'kg' ? 2.5 : 5;
}

/**
 * Does a session have a completed working set that hit `targetReps` at
 * RPE ≤ 7? Returns the heaviest such qualifying weight.
 */
export function sessionQualifies(
  sets: readonly RpeSet[],
  targetReps: number,
): { qualifies: boolean; weight: number } {
  let best = -Infinity;
  for (const s of sets) {
    if (s.is_warmup || !s.is_completed) continue;
    if (s.reps >= targetReps && s.rpe !== null && s.rpe <= RPE_EASY_THRESHOLD) {
      best = Math.max(best, s.weight);
    }
  }
  return best === -Infinity ? { qualifies: false, weight: 0 } : { qualifies: true, weight: best };
}

/**
 * Suggest a weight bump when the two most recent sessions both qualified.
 * `recentSessions` are working sets per session, most-recent first.
 */
export function suggestProgression(
  recentSessions: readonly RpeSet[][],
  targetReps: number,
  unit: Units,
): AutoRegResult {
  const increment = defaultIncrement(unit);
  const base: AutoRegResult = {
    suggest: false,
    increment,
    unit,
    suggestedWeight: null,
    reason: null,
  };

  if (recentSessions.length < 2) return base;

  const a = sessionQualifies(recentSessions[0]!, targetReps);
  const b = sessionQualifies(recentSessions[1]!, targetReps);
  if (!a.qualifies || !b.qualifies) return base;

  const suggestedWeight = Math.max(a.weight, b.weight) + increment;
  return {
    suggest: true,
    increment,
    unit,
    suggestedWeight,
    reason: `Hit ${targetReps}+ reps at RPE ≤${RPE_EASY_THRESHOLD} two sessions running — try ${suggestedWeight} ${unit} (+${increment}).`,
  };
}
