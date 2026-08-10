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
  score: number;
}

function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  let score = 0;
  const reasons: string[] = [];

  const days = input.consecutiveTrainingDays;
  if (days >= 5) {
    score += 3;
    reasons.push(`${days} training days in a row`);
  } else if (days >= 3) {
    score += 2;
    reasons.push(`${days} training days in a row`);
  } else if (days === 2) {
    score += 1;
    reasons.push('2 training days in a row');
  }

  if (input.backToBackMuscles.length > 0) {
    score += Math.min(2, input.backToBackMuscles.length);
    reasons.push(`${formatList(input.backToBackMuscles)} trained 2 days running`);
  }

  if (
    input.recentVolumeAvg !== null &&
    input.priorVolumeAvg !== null &&
    input.priorVolumeAvg > 0
  ) {
    const ratio = input.recentVolumeAvg / input.priorVolumeAvg;
    if (ratio >= 1.15) {
      score += 1;
      reasons.push('Volume trending up');
    } else if (ratio <= 0.85) {
      score -= 1;
      reasons.push('Volume trending down');
    } else {
      reasons.push('Volume trending flat');
    }
  }

  if (reasons.length === 0) {
    reasons.push('No recent fatigue signals');
  }

  let level: ReadinessLevel;
  if (score <= 0) level = 'fresh';
  else if (score <= 2) level = 'moderate';
  else level = 'fatigued';

  const suggestion =
    level === 'fresh'
      ? 'Good to push today.'
      : level === 'moderate'
        ? 'A normal or a lighter day both work.'
        : 'Consider a lighter day or a rest day.';

  return { level, reasons, suggestion, score };
}
