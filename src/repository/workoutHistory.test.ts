import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId } from '../lib/id';

describe('IndexedDBRepository — getWorkoutHistory', () => {
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

  it('returns only completed sessions, newest first, with stats', async () => {
    // Completed workout with one working set (135 × 10 = 1350 volume).
    const w1 = await repo.startWorkout({ name: 'Day 1' });
    const wex1 = await repo.addWorkoutExercise(w1.id, 'ex-barbell-bench-press');
    const s1 = await repo.addSet(wex1.id, { weight: 135, reps: 10 });
    await repo.updateSet(s1.id, { is_completed: true });
    await repo.completeWorkout(w1.id);
    await repo.updateWorkoutDate(w1.id, '2020-01-01');

    // A second, later completed workout.
    const w2 = await repo.startWorkout({ name: 'Day 2' });
    const wex2 = await repo.addWorkoutExercise(w2.id, 'ex-overhead-press');
    const s2 = await repo.addSet(wex2.id, { weight: 95, reps: 5 });
    await repo.updateSet(s2.id, { is_completed: true });
    await repo.completeWorkout(w2.id);
    await repo.updateWorkoutDate(w2.id, '2020-02-01');

    // An in-progress workout should be excluded.
    await repo.startWorkout({ name: 'In progress' });

    const history = await repo.getWorkoutHistory();
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.workout.name)).toEqual(['Day 2', 'Day 1']); // newest first
    const day1 = history.find((h) => h.workout.name === 'Day 1')!;
    expect(day1.volume).toBe(1350);
    expect(day1.workingSetCount).toBe(1);
    expect(day1.exerciseCount).toBe(1);
  });

  it('excludes warm-up and uncompleted sets from volume', async () => {
    const w = await repo.startWorkout({ name: 'Mixed' });
    const wex = await repo.addWorkoutExercise(w.id, 'ex-barbell-bench-press');
    const warm = await repo.addSet(wex.id, { weight: 45, reps: 10, is_warmup: true });
    await repo.updateSet(warm.id, { is_completed: true });
    const working = await repo.addSet(wex.id, { weight: 185, reps: 5 });
    await repo.updateSet(working.id, { is_completed: true });
    await repo.addSet(wex.id, { weight: 185, reps: 5 }); // left uncompleted
    await repo.completeWorkout(w.id);

    const [entry] = await repo.getWorkoutHistory();
    expect(entry?.volume).toBe(925); // only the one completed working set
    expect(entry?.workingSetCount).toBe(1);
  });
});
