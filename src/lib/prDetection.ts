import type { PRType } from '../types';
import { epley1RM } from './beatLastTime';

/**
 * Personal-record detection — pure, unit-tested. PRs are derived from a
 * workout's completed working (non-warm-up) sets and compared against the
 * best value seen so far, so they can be cached to `personal_records` with a
 * `previous_value` for the "previous best: 185×8" line.
 *
 * One cached scalar per (exercise, pr_type):
 * - heaviest_weight     — highest weight on any working set
 * - reps_at_weight      — most reps in a single working set (weight = context)
 * - estimated_1rm       — highest Epley e1RM across working sets
 * - best_set_volume     — highest weight × reps for one set
 * - best_workout_volume — highest total working volume in the session
 */

export interface WorkingSetLite {
  weight: number;
  reps: number;
  is_warmup: boolean;
  is_completed: boolean;
}

export interface PRCandidate {
  value: number;
  weight: number | null;
  reps: number | null;
}

export interface DetectedPR extends PRCandidate {
  pr_type: PRType;
  previous_value: number | null;
}

export const PR_TYPES: PRType[] = [
  'heaviest_weight',
  'reps_at_weight',
  'estimated_1rm',
  'best_set_volume',
  'best_workout_volume',
];

const EPSILON = 1e-9;

function workingSets(sets: readonly WorkingSetLite[]): WorkingSetLite[] {
  return sets.filter((s) => !s.is_warmup && s.is_completed && s.reps > 0);
}

/**
 * Compute the best candidate for each PR type from one exercise's session
 * sets. Returns null for a type when there are no qualifying sets.
 */
export function exercisePRCandidates(
  sets: readonly WorkingSetLite[],
): Record<PRType, PRCandidate | null> {
  const working = workingSets(sets);
  const empty: Record<PRType, PRCandidate | null> = {
    heaviest_weight: null,
    reps_at_weight: null,
    estimated_1rm: null,
    best_set_volume: null,
    best_workout_volume: null,
  };
  if (working.length === 0) return empty;

  let heaviest = working[0]!;
  let mostReps = working[0]!;
  let bestE1rm = working[0]!;
  let bestSetVol = working[0]!;
  let totalVolume = 0;

  for (const s of working) {
    totalVolume += s.weight * s.reps;
    if (s.weight > heaviest.weight || (s.weight === heaviest.weight && s.reps > heaviest.reps)) {
      heaviest = s;
    }
    if (s.reps > mostReps.reps || (s.reps === mostReps.reps && s.weight > mostReps.weight)) {
      mostReps = s;
    }
    if (epley1RM(s.weight, s.reps) > epley1RM(bestE1rm.weight, bestE1rm.reps)) {
      bestE1rm = s;
    }
    if (s.weight * s.reps > bestSetVol.weight * bestSetVol.reps) {
      bestSetVol = s;
    }
  }

  return {
    heaviest_weight: { value: heaviest.weight, weight: heaviest.weight, reps: heaviest.reps },
    reps_at_weight: { value: mostReps.reps, weight: mostReps.weight, reps: mostReps.reps },
    estimated_1rm: {
      value: epley1RM(bestE1rm.weight, bestE1rm.reps),
      weight: bestE1rm.weight,
      reps: bestE1rm.reps,
    },
    best_set_volume: {
      value: bestSetVol.weight * bestSetVol.reps,
      weight: bestSetVol.weight,
      reps: bestSetVol.reps,
    },
    best_workout_volume: { value: totalVolume, weight: null, reps: null },
  };
}

/**
 * Given candidates and the best value seen so far per type, return the types
 * that were beaten (strictly), each with its `previous_value`.
 */
export function detectPRs(
  candidates: Record<PRType, PRCandidate | null>,
  existingBest: Partial<Record<PRType, number>>,
): DetectedPR[] {
  const detected: DetectedPR[] = [];
  for (const type of PR_TYPES) {
    const candidate = candidates[type];
    if (!candidate) continue;
    const previous = existingBest[type];
    if (previous === undefined || candidate.value > previous + EPSILON) {
      detected.push({
        pr_type: type,
        value: candidate.value,
        weight: candidate.weight,
        reps: candidate.reps,
        previous_value: previous ?? null,
      });
    }
  }
  return detected;
}
