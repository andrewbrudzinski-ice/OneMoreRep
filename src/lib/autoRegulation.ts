import type { Units } from '../types';

/**
 * RPE auto-regulation — a transparent, opt-in nudge. The rule (spec §11):
 * "hit target reps at RPE ≤ 7 in the last two sessions → suggest +5 lb
 * (+2.5 kg)". The reason is always shown; nothing changes automatically.
 * Pure + unit-tested.
 */

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
