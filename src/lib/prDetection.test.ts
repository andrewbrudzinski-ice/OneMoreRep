import { describe, expect, it } from 'vitest';
import { detectPRs, exercisePRCandidates, PR_TYPES } from './prDetection';
import { epley1RM } from './beatLastTime';
import type { PRType } from '../types';

function set(weight: number, reps: number, is_warmup = false, is_completed = true) {
  return { weight, reps, is_warmup, is_completed };
}

describe('exercisePRCandidates', () => {
  it('computes every PR type from working sets', () => {
    const sets = [
      set(135, 5, true), // warm-up — ignored
      set(185, 10),
      set(205, 3),
      set(185, 8),
    ];
    const c = exercisePRCandidates(sets);

    expect(c.heaviest_weight).toMatchObject({ value: 205, weight: 205, reps: 3 });
    // most reps in a single set
    expect(c.reps_at_weight).toMatchObject({ value: 10, weight: 185, reps: 10 });
    // best e1rm: 185×10 = 246.7 beats 205×3 = 225.5
    expect(c.estimated_1rm?.value).toBeCloseTo(epley1RM(185, 10), 6);
    // best single-set volume: 185×10 = 1850
    expect(c.best_set_volume).toMatchObject({ value: 1850 });
    // total working volume: 1850 + 615 + 1480
    expect(c.best_workout_volume?.value).toBe(1850 + 205 * 3 + 185 * 8);
  });

  it('returns all null when there are no completed working sets', () => {
    const c = exercisePRCandidates([set(45, 10, true), set(135, 5, false, false)]);
    for (const t of PR_TYPES) expect(c[t]).toBeNull();
  });
});

describe('detectPRs', () => {
  const sets = [set(200, 5)];
  const candidates = exercisePRCandidates(sets);

  it('flags every type as a PR when there is no prior best', () => {
    const detected = detectPRs(candidates, {});
    expect(detected.map((d) => d.pr_type).sort()).toEqual([...PR_TYPES].sort());
    for (const d of detected) expect(d.previous_value).toBeNull();
  });

  it('records previous_value and only fires on a strict beat', () => {
    const existing: Partial<Record<PRType, number>> = {
      heaviest_weight: 200, // tied, not beaten
      estimated_1rm: epley1RM(200, 5), // tied
      best_set_volume: 900, // 200×5 = 1000 > 900 → PR
      reps_at_weight: 10, // 5 < 10 → not beaten
      best_workout_volume: 1000, // tied
    };
    const detected = detectPRs(candidates, existing);
    const types = detected.map((d) => d.pr_type);
    expect(types).toContain('best_set_volume');
    expect(types).not.toContain('heaviest_weight');
    expect(types).not.toContain('reps_at_weight');
    const vol = detected.find((d) => d.pr_type === 'best_set_volume');
    expect(vol?.previous_value).toBe(900);
    expect(vol?.value).toBe(1000);
  });

  it('does not fire when nothing is beaten', () => {
    const existing: Partial<Record<PRType, number>> = {
      heaviest_weight: 999,
      reps_at_weight: 999,
      estimated_1rm: 9999,
      best_set_volume: 99999,
      best_workout_volume: 99999,
    };
    expect(detectPRs(candidates, existing)).toEqual([]);
  });
});
