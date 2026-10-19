/**
 * Muscle-balance analysis — pure, unit-testable.
 * Takes 4-week per-muscle volume totals and surfaces push/pull, quad/posterior
 * and upper/lower imbalances with plain-English suggestions.
 */

// Stable muscle-group slug sets (match seedData.ts).
export const PUSH_IDS = new Set(['mg-chest', 'mg-shoulders', 'mg-triceps']);
export const PULL_IDS = new Set(['mg-back', 'mg-biceps', 'mg-forearms']);
export const QUAD_IDS = new Set(['mg-quads']);
export const POSTERIOR_IDS = new Set(['mg-hamstrings', 'mg-glutes', 'mg-calves']);

export type ImbalanceSeverity = 'good' | 'warn' | 'alert';

export interface BalanceBar {
  labelA: string;
  labelB: string;
  volumeA: number;
  volumeB: number;
  /** volumeA / (volumeA + volumeB), 0–1. */
  fractionA: number;
  severity: ImbalanceSeverity;
  suggestion: string | null;
}

export interface MuscleImbalanceReport {
  pushPull: BalanceBar;
  upperLower: BalanceBar;
  quadPosterior: BalanceBar;
  /** True if there was enough data to generate any bars. */
  hasData: boolean;
  /** Any alert/warn bars with actionable suggestions. */
  flags: BalanceBar[];
}

function sumVolume(
  totals: readonly { muscleGroupId: string; volume: number }[],
  ids: Set<string>,
): number {
  return totals
    .filter((t) => ids.has(t.muscleGroupId))
    .reduce((sum, t) => sum + t.volume, 0);
}

function severity(fractionA: number): ImbalanceSeverity {
  // fractionA far from 0.5 = imbalanced.
  const deviation = Math.abs(fractionA - 0.5);
  if (deviation >= 0.3) return 'alert'; // ≥ 4:1 ratio
  if (deviation >= 0.18) return 'warn'; // ≥ 1.9:1 ratio
  return 'good';
}

function fraction(a: number, b: number): number {
  return a + b > 0 ? a / (a + b) : 0.5;
}

export function computeImbalances(
  totals: readonly { muscleGroupId: string; volume: number }[],
): MuscleImbalanceReport {
  const push = sumVolume(totals, PUSH_IDS);
  const pull = sumVolume(totals, PULL_IDS);
  const quad = sumVolume(totals, QUAD_IDS);
  const post = sumVolume(totals, POSTERIOR_IDS);
  const upper = push + pull;
  const lower = quad + post;
  const totalVolume = upper + lower;

  const hasData = totalVolume > 0;

  const ppFrac = fraction(push, pull);
  const ppSev = severity(ppFrac);
  const pushPull: BalanceBar = {
    labelA: 'Push',
    labelB: 'Pull',
    volumeA: push,
    volumeB: pull,
    fractionA: ppFrac,
    severity: ppSev,
    suggestion:
      ppSev !== 'good'
        ? ppFrac > 0.5
          ? 'Push-dominant — add rows, pull-ups, or face pulls to balance'
          : 'Pull-dominant — add bench press, overhead press, or dips to balance'
        : null,
  };

  const ulFrac = fraction(upper, lower);
  const ulSev = severity(ulFrac);
  const upperLower: BalanceBar = {
    labelA: 'Upper',
    labelB: 'Lower',
    volumeA: upper,
    volumeB: lower,
    fractionA: ulFrac,
    severity: ulSev,
    suggestion:
      ulSev !== 'good'
        ? ulFrac > 0.5
          ? 'Upper-dominant — add squats, deadlifts, or lunges'
          : 'Lower-dominant — add pressing and rowing movements'
        : null,
  };

  const qpFrac = fraction(quad, post);
  const qpSev = severity(qpFrac);
  const quadPosterior: BalanceBar = {
    labelA: 'Quads',
    labelB: 'Post. chain',
    volumeA: quad,
    volumeB: post,
    fractionA: qpFrac,
    severity: qpSev,
    suggestion:
      qpSev !== 'good'
        ? qpFrac > 0.5
          ? 'Quad-dominant — add deadlifts, Romanian deadlifts, or hip thrusts'
          : 'Posterior-dominant — add squats or leg press'
        : null,
  };

  const bars = [pushPull, upperLower, quadPosterior];
  const flags = bars.filter((b) => b.severity !== 'good' && b.suggestion !== null);

  return { pushPull, upperLower, quadPosterior, hasData, flags };
}
