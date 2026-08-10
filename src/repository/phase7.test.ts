import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId } from '../lib/id';

describe('IndexedDBRepository — Phase 7 (readiness, heatmap, auto-reg)', () => {
  let db: FitnessDB;
  let repo: IndexedDBRepository;

  beforeEach(async () => {
    db = new FitnessDB(`test-${newId()}`);
    await db.open();
    repo = new IndexedDBRepository(db);
    await repo.seed();
  });

  afterEach(async () => {
    await db.delete();
  });

  async function logSession(
    exerciseId: string,
    sets: { weight: number; reps: number; rpe?: number }[],
  ) {
    const workout = await repo.startWorkout({ name: 'S' });
    const wex = await repo.addWorkoutExercise(workout.id, exerciseId);
    for (const s of sets) {
      const set = await repo.addSet(wex.id, { weight: s.weight, reps: s.reps });
      await repo.updateSet(set.id, { is_completed: true, rpe: s.rpe ?? null });
    }
    await repo.completeWorkout(workout.id);
  }

  it('readiness is well-formed on an empty log (fresh, with a reason)', async () => {
    const r = await repo.getReadiness();
    expect(r.level).toBe('fresh');
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.suggestion).toBeTruthy();
  });

  it('heatmap aggregates weekly per-muscle volume with exercise breakdown', async () => {
    await logSession('ex-barbell-bench-press', [{ weight: 185, reps: 10 }]); // chest primary
    const cells = await repo.getMuscleHeatmap();
    const chest = cells.find((c) => c.muscleGroupId === 'mg-chest');
    expect(chest?.volume).toBe(1850);
    expect(chest?.intensity).toBe(1); // busiest muscle
    expect(chest?.exercises[0]?.name).toBe('Barbell Bench Press');
    // Triceps gets secondary credit (0.5).
    const triceps = cells.find((c) => c.muscleGroupId === 'mg-triceps');
    expect(triceps?.volume).toBe(925);
  });

  it('auto-regulation suggests a bump after two easy sessions', async () => {
    await logSession('ex-back-squat', [{ weight: 225, reps: 8, rpe: 6.5 }]);
    await logSession('ex-back-squat', [{ weight: 225, reps: 8, rpe: 7 }]);
    const s = await repo.getProgressionSuggestion('ex-back-squat', 8);
    expect(s.suggest).toBe(true);
    expect(s.suggestedWeight).toBe(230);
  });

  it('auto-regulation stays quiet when the last session was hard', async () => {
    await logSession('ex-back-squat', [{ weight: 225, reps: 8, rpe: 6 }]);
    await logSession('ex-back-squat', [{ weight: 225, reps: 8, rpe: 9 }]);
    const s = await repo.getProgressionSuggestion('ex-back-squat', 8);
    expect(s.suggest).toBe(false);
  });

  it('remembers the last rest used for an exercise', async () => {
    const workout = await repo.startWorkout({ name: 'S' });
    const wex = await repo.addWorkoutExercise(workout.id, 'ex-deadlift');
    const set = await repo.addSet(wex.id, { weight: 315, reps: 5 });
    await repo.updateSet(set.id, { is_completed: true, rest_seconds: 180 });
    await repo.completeWorkout(workout.id);
    expect(await repo.getLastRestSeconds('ex-deadlift')).toBe(180);
    expect(await repo.getLastRestSeconds('ex-barbell-bench-press')).toBeNull();
  });
});
