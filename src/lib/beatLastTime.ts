import type { Units, WorkoutIntent } from '../types';

/**
 * The Beat Last Time engine — pure, fully unit-tested. Compares a logged set
 * to the best comparable set from the last session of that exercise and
 * returns a reason-tagged status. "Chase green, never punish": a Down set is
 * neutral grey, never red, and is suppressed entirely on deliberate light /
 * deload days.
 *
 * See spec §2. `LOAD_ALWAYS_GREEN = true` is the finalized default: heavier
 * weight with ≥1 rep always reads green (load), reason-tagged, with the honest
 * e1RM comparison surfaced in `detail`.
 */

/** Epley estimated 1RM: weight × (1 + reps / 30). */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export type BeatStatus = 'beat' | 'matched' | 'down' | 'neutral';
export type BeatAxis = 'load' | 'reps' | 'strength';
export type BeatColor = 'green' | 'amber' | 'grey';

export interface ComparableSet {
  weight: number;
  reps: number;
}

export interface SetSnapshot extends ComparableSet {
  e1rm: number;
}

export interface BeatEvaluation {
  status: BeatStatus;
  axis: BeatAxis | null;
  /** Short reason tag, e.g. "+5 lbs", "+2 reps", "stronger", or null. */
  tag: string | null;
  color: BeatColor;
  current: SetSnapshot;
  /** The comparable set from last session, or null if none (first time). */
  comparison: SetSnapshot | null;
  /** Honest e1RM comparison line, e.g. "240.7 vs 246.7", or null. */
  detail: string | null;
}

export interface BeatOptions {
  /** Default true — heavier weight (≥1 rep) always reads green (load). */
  loadAlwaysGreen?: boolean;
  /** Workout intent; 'light' / 'deload' suppress the Down status. */
  intent?: WorkoutIntent;
  /** Unit label for tags. Default 'lbs'. */
  unit?: Units;
  /** e1RM band (fraction) for "Matched". Default 0.02 (~2%). */
  matchThreshold?: number;
}

const DEFAULT_MATCH_THRESHOLD = 0.02;

function snapshot(weight: number, reps: number): SetSnapshot {
  return { weight, reps, e1rm: epley1RM(weight, reps) };
}

/** Format a (possibly fractional) weight delta without a trailing ".0". */
function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * The comparable set = the prior-session set with the closest weight to the
 * current set. Ties (same weight) break toward the strongest set (highest
 * e1RM), matching the spec's headline example (190×8 compared to 185×10).
 *
 * Callers must pass WORKING sets only — warm-ups are never comparable.
 */
export function findComparableSet(
  currentWeight: number,
  priorSets: readonly ComparableSet[],
): SetSnapshot | null {
  let best: SetSnapshot | null = null;
  let bestDistance = Infinity;
  for (const set of priorSets) {
    const distance = Math.abs(set.weight - currentWeight);
    const snap = snapshot(set.weight, set.reps);
    if (distance < bestDistance || (distance === bestDistance && best && snap.e1rm > best.e1rm)) {
      best = snap;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Evaluate a single working set against the prior session's working sets.
 * `priorSets` must exclude warm-ups.
 */
export function evaluateSet(
  current: ComparableSet,
  priorSets: readonly ComparableSet[],
  options: BeatOptions = {},
): BeatEvaluation {
  const {
    loadAlwaysGreen = true,
    intent = 'normal',
    unit = 'lbs',
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
  } = options;

  const cur = snapshot(current.weight, current.reps);
  const prev = findComparableSet(current.weight, priorSets);

  // First time doing this exercise (or no prior working sets): nothing to beat.
  if (!prev) {
    return {
      status: 'neutral',
      axis: null,
      tag: null,
      color: 'grey',
      current: cur,
      comparison: null,
      detail: null,
    };
  }

  const detail = `${cur.e1rm.toFixed(1)} vs ${prev.e1rm.toFixed(1)}`;
  const suppressDown = intent === 'light' || intent === 'deload';

  const green = (axis: BeatAxis, tag: string): BeatEvaluation => ({
    status: 'beat',
    axis,
    tag,
    color: 'green',
    current: cur,
    comparison: prev,
    detail,
  });

  // 1. Load: heavier weight (≥1 rep) → green (when LOAD_ALWAYS_GREEN).
  if (loadAlwaysGreen && cur.weight > prev.weight && cur.reps >= 1) {
    return green('load', `+${fmtNumber(cur.weight - prev.weight)} ${unit}`);
  }

  // 2. Reps: more reps at ≥ same weight → green.
  if (cur.weight >= prev.weight && cur.reps > prev.reps) {
    const delta = cur.reps - prev.reps;
    return green('reps', `+${delta} ${delta === 1 ? 'rep' : 'reps'}`);
  }

  // 3. Strength: e1RM clearly higher (beyond the match band) → green.
  if (cur.e1rm >= prev.e1rm * (1 + matchThreshold)) {
    return green('strength', 'stronger');
  }

  // 4. Matched: within ±band of prior e1RM, no clear load/rep win → amber.
  if (cur.e1rm >= prev.e1rm * (1 - matchThreshold)) {
    return {
      status: 'matched',
      axis: null,
      tag: null,
      color: 'amber',
      current: cur,
      comparison: prev,
      detail,
    };
  }

  // 5. Down: below all of the above → neutral grey (never red). On a light /
  //    deload day, suppress the judgment entirely (log neutral).
  return {
    status: suppressDown ? 'neutral' : 'down',
    axis: null,
    tag: null,
    color: 'grey',
    current: cur,
    comparison: prev,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Volume / e1RM aggregates (warm-ups excluded)
// ---------------------------------------------------------------------------

export interface VolumeSet {
  weight: number;
  reps: number;
  is_warmup: boolean;
  is_completed: boolean;
}

/** Sum of weight × reps over completed working (non-warm-up) sets. */
export function workingVolume(sets: readonly VolumeSet[]): number {
  return sets
    .filter((s) => !s.is_warmup && s.is_completed)
    .reduce((total, s) => total + s.weight * s.reps, 0);
}

/** Best (max) Epley e1RM over completed working sets, or 0 if none. */
export function bestE1RM(sets: readonly VolumeSet[]): number {
  return sets
    .filter((s) => !s.is_warmup && s.is_completed)
    .reduce((best, s) => Math.max(best, epley1RM(s.weight, s.reps)), 0);
}
