/**
 * Weekly coaching digest — pure, rule-based, no network.
 *
 * Takes data already loaded on the Progress screen and produces a
 * structured digest: week label, key numbers, and 2–3 prioritised
 * coaching lines with plain-English explanations.
 */

import { addDays, startOfWeek } from './dates';
import { todayDateString } from './id';
import type { MuscleImbalanceReport } from './muscleImbalance';
import type { Units } from '../types';

export interface DigestLine {
  kind: 'good' | 'tip' | 'warn' | 'pr';
  text: string;
}

export interface WeeklyDigest {
  /** "Mon Oct 13 – Sun Oct 19" */
  weekLabel: string;
  workouts: number;
  volume: number;
  unit: Units;
  /** Top coaching bullets (2–4). */
  lines: DigestLine[];
}

function fmtShortDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function fmtVol(v: number, unit: Units): string {
  return `${v.toLocaleString()} ${unit}`;
}

export function generateWeeklyDigest(params: {
  workoutsThisWeek: number;
  currentStreak: number;
  volume: number;
  unit: Units;
  imbalances: MuscleImbalanceReport;
  topMuscleName: string | null;
  newPRsThisWeek: { exerciseName: string; value: number }[];
}): WeeklyDigest {
  const today = todayDateString();
  const monday = startOfWeek(today);
  const sunday = addDays(monday, 6);
  const weekLabel = `${fmtShortDate(monday)} – ${fmtShortDate(sunday)}`;

  const {
    workoutsThisWeek,
    currentStreak,
    volume,
    unit,
    imbalances,
    topMuscleName,
    newPRsThisWeek,
  } = params;

  const lines: DigestLine[] = [];

  // 1. PRs first — highest signal
  for (const pr of newPRsThisWeek.slice(0, 2)) {
    lines.push({
      kind: 'pr',
      text: `PR: ${pr.exerciseName} — ${pr.value.toLocaleString()} ${unit}`,
    });
  }

  // 2. Volume / workout count summary
  if (workoutsThisWeek === 0) {
    lines.push({
      kind: 'tip',
      text: 'No sessions yet this week. Even a 20-minute workout keeps momentum going.',
    });
  } else if (workoutsThisWeek >= 6) {
    lines.push({
      kind: 'warn',
      text: `${workoutsThisWeek} sessions this week — your nervous system may need a full rest day before next session.`,
    });
  } else {
    lines.push({
      kind: 'good',
      text: `${workoutsThisWeek} session${workoutsThisWeek !== 1 ? 's' : ''} logged — ${fmtVol(volume, unit)} total volume.`,
    });
  }

  // 3. Streak note
  if (currentStreak >= 14) {
    lines.push({
      kind: 'tip',
      text: `${currentStreak}-day streak. Impressive consistency — make sure sleep and nutrition are supporting the load.`,
    });
  } else if (currentStreak >= 7) {
    lines.push({
      kind: 'good',
      text: `${currentStreak}-day streak. You're building serious momentum.`,
    });
  }

  // 4. Muscle imbalance flags (top one)
  if (imbalances.flags.length > 0) {
    lines.push({
      kind: 'warn',
      text: imbalances.flags[0]!.suggestion!,
    });
  }

  // 5. Top muscle focus note
  if (topMuscleName && lines.length < 3) {
    lines.push({
      kind: 'tip',
      text: `Most-trained muscle this week: ${topMuscleName}. Vary stimulus to hit secondary movers too.`,
    });
  }

  return { weekLabel, workouts: workoutsThisWeek, volume, unit, lines: lines.slice(0, 4) };
}
