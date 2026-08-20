import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId } from '../lib/id';

/**
 * Phase 2: workout lifecycle through the repository — start from a routine,
 * log sets (instant persistence), complete, and read last-session history
 * that feeds Beat Last Time.
 */
describe('IndexedDBRepository — workouts', () => {
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

  it('starts a workout from a routine, copying its exercises in order', async () => {
    const routine = await repo.createRoutine({ name: 'Push' });
    await repo.addRoutineExercise(routine.id, 'ex-barbell-bench-press');
    await repo.addRoutineExercise(routine.id, 'ex-overhead-press');

    const workout = await repo.startWorkout({
      name: 'Push',
      routine_id: routine.id,
      intent: 'normal',
    });
    const detail = await repo.getWorkoutDetail(workout.id);
    expect(detail?.exercises.map((e) => e.exercise_id)).toEqual([
      'ex-barbell-bench-press',
      'ex-overhead-press',
    ]);
    expect(detail?.exercises[0]?.exercise?.name).toBe('Barbell Bench Press');
  });

  it('is the active workout until completed', async () => {
    const workout = await repo.startWorkout({ name: 'Empty' });
    expect((await repo.getActiveWorkout())?.id).toBe(workout.id);
    await repo.completeWorkout(workout.id);
    expect(await repo.getActiveWorkout()).toBeUndefined();
  });

  it('logs sets that persist immediately and complete the workout', async () => {
    const workout = await repo.startWorkout({ name: 'Empty' });
    const wex = await repo.addWorkoutExercise(workout.id, 'ex-barbell-bench-press');

    const s1 = await repo.addSet(wex.id, { weight: 185, reps: 10 });
    await repo.updateSet(s1.id, { is_completed: true });
    const s2 = await repo.addSet(wex.id, { weight: 185, reps: 8 });
    await repo.updateSet(s2.id, { is_completed: true });

    const detail = await repo.getWorkoutDetail(workout.id);
    const sets = detail?.exercises[0]?.sets ?? [];
    expect(sets).toHaveLength(2);
    expect(sets[0]?.set_number).toBe(1);
    expect(sets[0]?.is_completed).toBe(true);
    expect(sets[0]?.logged_at).toBeTruthy();

    const done = await repo.completeWorkout(workout.id);
    expect(done.completed_at).toBeTruthy();
    expect(done.duration_seconds).toBeGreaterThanOrEqual(0);
  });

  it('returns the last completed session for an exercise (excluding current)', async () => {
    // Session 1 (completed)
    const w1 = await repo.startWorkout({ name: 'Day 1' });
    const wex1 = await repo.addWorkoutExercise(w1.id, 'ex-barbell-bench-press');
    const a = await repo.addSet(wex1.id, { weight: 185, reps: 10 });
    await repo.updateSet(a.id, { is_completed: true });
    await repo.completeWorkout(w1.id);

    // Session 2 (current, in progress)
    const w2 = await repo.startWorkout({ name: 'Day 2' });
    const wex2 = await repo.addWorkoutExercise(w2.id, 'ex-barbell-bench-press');
    await repo.addSet(wex2.id, { weight: 190, reps: 8 });

    const last = await repo.getLastSession('ex-barbell-bench-press', {
      excludeWorkoutId: w2.id,
    });
    expect(last?.workout.id).toBe(w1.id);
    expect(last?.sets.map((s) => s.weight)).toEqual([185]);
  });

  it('getRecentBest returns the strongest working set within the week window', async () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

    // A big set 40 days ago — outside a 3-week window.
    const old = await repo.startWorkout({ name: 'Old' });
    const oldWex = await repo.addWorkoutExercise(old.id, 'ex-barbell-bench-press');
    const oldSet = await repo.addSet(oldWex.id, { weight: 225, reps: 5 });
    await repo.updateSet(oldSet.id, { is_completed: true });
    await repo.completeWorkout(old.id);
    await db.workouts.update(old.id, { completed_at: daysAgo(40) });

    // Two sessions inside the window; best e1RM is 200×5 (not the heavier-looking
    // 195×8 warm-up, which is excluded).
    const w1 = await repo.startWorkout({ name: 'W1' });
    const wex1 = await repo.addWorkoutExercise(w1.id, 'ex-barbell-bench-press');
    const s1 = await repo.addSet(wex1.id, { weight: 185, reps: 8 });
    await repo.updateSet(s1.id, { is_completed: true });
    await repo.completeWorkout(w1.id);
    await db.workouts.update(w1.id, { completed_at: daysAgo(10) });

    const w2 = await repo.startWorkout({ name: 'W2' });
    const wex2 = await repo.addWorkoutExercise(w2.id, 'ex-barbell-bench-press');
    const warm = await repo.addSet(wex2.id, { weight: 300, reps: 1 });
    await repo.updateSet(warm.id, { is_completed: true, is_warmup: true });
    const top = await repo.addSet(wex2.id, { weight: 205, reps: 5 });
    await repo.updateSet(top.id, { is_completed: true });
    await repo.completeWorkout(w2.id);
    await db.workouts.update(w2.id, { completed_at: daysAgo(3) });

    const best = await repo.getRecentBest('ex-barbell-bench-press', { withinWeeks: 3 });
    expect(best).toEqual({ weight: 205, reps: 5, date: expect.any(String) });

    // A wider window pulls in the heavier 225×5.
    const wide = await repo.getRecentBest('ex-barbell-bench-press', { withinWeeks: 8 });
    expect(wide?.weight).toBe(225);

    // No sessions at all → undefined.
    expect(await repo.getRecentBest('ex-deadlift', { withinWeeks: 3 })).toBeUndefined();
  });

  it('swap clears the sets from the previous exercise', async () => {
    const workout = await repo.startWorkout({ name: 'Empty' });
    const wex = await repo.addWorkoutExercise(workout.id, 'ex-barbell-bench-press');
    await repo.addSet(wex.id, { weight: 185, reps: 10 });
    await repo.swapWorkoutExercise(wex.id, 'ex-incline-barbell-bench-press');

    const detail = await repo.getWorkoutDetail(workout.id);
    expect(detail?.exercises[0]?.exercise_id).toBe('ex-incline-barbell-bench-press');
    expect(detail?.exercises[0]?.sets).toHaveLength(0);
  });

  it('cancel deletes the workout and its sets', async () => {
    const workout = await repo.startWorkout({ name: 'Empty' });
    const wex = await repo.addWorkoutExercise(workout.id, 'ex-plank');
    await repo.addSet(wex.id, { weight: 0, reps: 60 });
    await repo.cancelWorkout(workout.id);

    expect(await repo.getWorkout(workout.id)).toBeUndefined();
    const orphanSets = await db.sets.where('workout_exercise_id').equals(wex.id).count();
    expect(orphanSets).toBe(0);
  });
});
