/**
 * Rule-based workout recap — pure function, no AI dependency.
 * Generates a 2–3 sentence plain-English summary from the session's own data.
 */

import type { WorkoutSummaryData } from '../repository/Repository';
import type { Settings } from '../types';
import { formatNumber } from './format';

export interface BeatStats {
  total: number;
  won: number;
}

function epley(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function computeBeatStats(
  exercises: Array<{
    exercise_id: string;
    sets: Array<{ weight: number; reps: number; is_completed: boolean; is_warmup: boolean; set_number: number }>;
  }>,
  lastByExercise: Map<
    string,
    | {
        workout: { completed_at: string | null; started_at: string };
        sets: Array<{ weight: number; reps: number; is_warmup: boolean; set_number: number }>;
      }
    | undefined
  >,
  lookbackWeeks: number,
): BeatStats {
  let total = 0;
  let won = 0;

  for (const item of exercises) {
    const last = lastByExercise.get(item.exercise_id);
    if (!last) continue;

    const ageMs =
      Date.now() -
      new Date(last.workout.completed_at ?? last.workout.started_at).getTime();
    if (ageMs > lookbackWeeks * 7 * 24 * 60 * 60 * 1000) continue;

    const lastWorking = last.sets
      .filter((s) => !s.is_warmup)
      .sort((a, b) => a.set_number - b.set_number);

    const currWorking = item.sets
      .filter((s) => s.is_completed && !s.is_warmup)
      .sort((a, b) => a.set_number - b.set_number);

    for (let i = 0; i < currWorking.length; i++) {
      const prev = lastWorking[i];
      if (!prev) continue;
      const curr = currWorking[i]!;
      total++;
      if (epley(curr.weight, curr.reps) >= epley(prev.weight, prev.reps)) won++;
    }
  }

  return { total, won };
}

export function generateRecap(
  summary: WorkoutSummaryData,
  beatStats: BeatStats | null,
  unit: Settings['units'],
): string {
  const parts: string[] = [];

  const durationMin = summary.workout.duration_seconds
    ? Math.round(summary.workout.duration_seconds / 60)
    : null;

  const openers: Record<string, string> = {
    push: 'Strong push session',
    normal: 'Solid session',
    light: 'Light session',
    deload: 'Deload done',
  };
  const opener = openers[summary.workout.intent] ?? 'Solid session';

  let line1 = opener;
  if (durationMin) line1 += ` — ${durationMin} min`;
  if (summary.totalVolume > 0) line1 += `, ${formatNumber(summary.totalVolume)} ${unit} total`;
  line1 += '.';
  parts.push(line1);

  const achievements: string[] = [];
  if (summary.newPRs.length > 0) {
    achievements.push(`${summary.newPRs.length} new PR${summary.newPRs.length > 1 ? 's' : ''}`);
  }
  if (beatStats && beatStats.total > 0 && beatStats.won > 0) {
    achievements.push(`beat last session on ${beatStats.won} of ${beatStats.total} sets`);
  }
  if (achievements.length > 0) {
    const text = achievements.join(' and ');
    parts.push(text.charAt(0).toUpperCase() + text.slice(1) + '.');
  } else if (beatStats && beatStats.total > 0 && beatStats.won === 0) {
    parts.push('None of the sets beat last time — a harder day ahead.');
  }

  const { tone } = summary.vsLast;
  if (tone === 'up') parts.push('Volume is trending up — keep building.');
  else if (tone === 'flat') parts.push('Volume on par with your last session.');
  else if (tone === 'down') parts.push('A lighter day — recovery is part of the process.');
  else if (tone === 'deload') parts.push("Deload complete — you'll come back stronger.");
  else if (tone === 'light') parts.push('Light day done — rest up.');
  else if (tone === 'first') parts.push('First session logged — great start.');

  return parts.join(' ');
}
