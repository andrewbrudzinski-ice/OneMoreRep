/**
 * Training Readiness — a qualitative, non-medical heuristic computed from the
 * user's OWN log. Fresh / Moderate / Fatigued, with the reasons shown plainly.
 * Rules are transparent and tweakable (spec §8). Pure + unit-tested.
 */

export type ReadinessLevel = 'fresh' | 'moderate' | 'fatigued';

export const READINESS_DISCLAIMER =
  'A rough read from your own training log — not medical or recovery-science advice.';

export interface ReadinessInput {
  /** Consecutive calendar days trained, ending today/yesterday. */
  consecutiveTrainingDays: number;
  /** Muscle-group names trained on both of the last two training days. */
  backToBackMuscles: string[];
  /** Mean working volume of the recent sessions (last ~3), or null. */
  recentVolumeAvg: number | null;
  /** Mean working volume of the prior sessions (the ~3 before), or null. */
  priorVolumeAvg: number | null;
}

export interface ReadinessResult {
  level: ReadinessLevel;
  reasons: string[];
  suggestion: string;
  /**
   * A 0–100 readiness index (100 = fully recovered). A transparent, deterministic
   * transform of the same signals below — a lighter read when your log shows a
   * long streak, back-to-back muscle days, or rising volume. Not a medical or
   * recovery-science score (see the disclaimer); it only summarises your own log.
   */
  index: number;
  /** Raw accumulated fatigue penalty (0 = none) — the inverse basis of `index`. */
  penalty: number;
  /**
   * The raw signals the engine read, echoed back so the UI can surface them
   * (e.g. the Home readiness "signals" grid) and keep the level auditable.
   * Presentational only — no new metric is invented here.
   */
  input: ReadinessInput;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Fatigue points for a consecutive-training-day streak (steeper as it grows). */
function dayPenalty(days: number): number {
  if (days <= 1) return 0;
  if (days === 2) return 14;
  if (days === 3) return 26;
  if (days === 4) return 36;
  if (days === 5) return 44;
  return Math.min(60, 44 + (days - 5) * 4);
}

function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  let penalty = 0;
  const reasons: string[] = [];

  const days = input.consecutiveTrainingDays;
  penalty += dayPenalty(days);
  if (days >= 2) {
    reasons.push(`${days} training days in a row`);
  }

  if (input.backToBackMuscles.length > 0) {
    penalty += Math.min(3, input.backToBackMuscles.length) * 8;
    reasons.push(`${formatList(input.backToBackMuscles)} trained 2 days running`);
  }

  if (
    input.recentVolumeAvg !== null &&
    input.priorVolumeAvg !== null &&
    input.priorVolumeAvg > 0
  ) {
    const ratio = input.recentVolumeAvg / input.priorVolumeAvg;
    if (ratio >= 1.15) {
      penalty += 8;
      reasons.push('Volume trending up');
    } else if (ratio <= 0.85) {
      penalty -= 8; // easing back eases fatigue
      reasons.push('Volume trending down');
    } else {
      reasons.push('Volume trending flat');
    }
  }

  if (reasons.length === 0) {
    reasons.push('No recent fatigue signals');
  }

  penalty = Math.max(0, penalty);
  const index = clamp(Math.round(100 - penalty), 5, 100);

  // Thresholds chosen so the index and the qualitative level always agree.
  let level: ReadinessLevel;
  if (index >= 85) level = 'fresh';
  else if (index >= 55) level = 'moderate';
  else level = 'fatigued';

  const suggestion =
    level === 'fresh'
      ? 'Good to push today.'
      : level === 'moderate'
        ? 'A normal or a lighter day both work.'
        : 'Consider a lighter day or a rest day.';

  return { level, reasons, suggestion, index, penalty, input };
}
