import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId } from '../lib/id';

/** Phase 1: routine CRUD, reorder, and duplicate round-trips through the repo. */
describe('IndexedDBRepository — routines', () => {
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

  it('creates routines with incrementing sort_order', async () => {
    const a = await repo.createRoutine({ name: 'Push' });
    const b = await repo.createRoutine({ name: 'Pull' });
    expect(b.sort_order).toBeGreaterThan(a.sort_order);
    const all = await repo.getRoutines();
    expect(all.map((r) => r.name)).toEqual(['Push', 'Pull']);
  });

  it('adds, updates, and reorders routine exercises', async () => {
    const routine = await repo.createRoutine({ name: 'Legs' });
    const squat = await repo.addRoutineExercise(routine.id, 'ex-back-squat');
    const rdl = await repo.addRoutineExercise(routine.id, 'ex-romanian-deadlift');
    const curl = await repo.addRoutineExercise(routine.id, 'ex-lying-leg-curl');

    // targets update
    await repo.updateRoutineExercise(squat.id, { target_sets: 5, target_reps_low: 3, target_reps_high: 5 });

    let detail = await repo.getRoutineDetail(routine.id);
    expect(detail?.items.map((i) => i.exercise_id)).toEqual([
      'ex-back-squat',
      'ex-romanian-deadlift',
      'ex-lying-leg-curl',
    ]);
    expect(detail?.items[0]?.target_sets).toBe(5);
    expect(detail?.items[0]?.exercise?.name).toBe('Barbell Back Squat');

    // reorder: move curl to front
    await repo.reorderRoutineExercises(routine.id, [curl.id, squat.id, rdl.id]);
    detail = await repo.getRoutineDetail(routine.id);
    expect(detail?.items.map((i) => i.exercise_id)).toEqual([
      'ex-lying-leg-curl',
      'ex-back-squat',
      'ex-romanian-deadlift',
    ]);
    expect(detail?.items.map((i) => i.sort_order)).toEqual([0, 1, 2]);
  });

  it('removes a routine exercise', async () => {
    const routine = await repo.createRoutine({ name: 'Chest' });
    const bench = await repo.addRoutineExercise(routine.id, 'ex-barbell-bench-press');
    await repo.addRoutineExercise(routine.id, 'ex-cable-fly');
    await repo.removeRoutineExercise(bench.id);
    const detail = await repo.getRoutineDetail(routine.id);
    expect(detail?.items.map((i) => i.exercise_id)).toEqual(['ex-cable-fly']);
  });

  it('duplicates a routine with all its exercises', async () => {
    const routine = await repo.createRoutine({ name: 'Upper', notes: 'heavy' });
    await repo.addRoutineExercise(routine.id, 'ex-barbell-bench-press', { target_sets: 4 });
    await repo.addRoutineExercise(routine.id, 'ex-barbell-row');

    const copy = await repo.duplicateRoutine(routine.id);
    expect(copy.id).not.toBe(routine.id);
    expect(copy.name).toBe('Upper (copy)');

    const original = await repo.getRoutineDetail(routine.id);
    const duplicate = await repo.getRoutineDetail(copy.id);
    expect(duplicate?.items.map((i) => i.exercise_id)).toEqual(
      original?.items.map((i) => i.exercise_id),
    );
    // deep copy — child ids differ
    expect(duplicate?.items[0]?.id).not.toBe(original?.items[0]?.id);
    expect(duplicate?.items[0]?.target_sets).toBe(4);
  });

  it('deletes a routine and cascades its exercises', async () => {
    const routine = await repo.createRoutine({ name: 'Temp' });
    await repo.addRoutineExercise(routine.id, 'ex-plank');
    await repo.deleteRoutine(routine.id);
    expect(await repo.getRoutine(routine.id)).toBeUndefined();
    expect(await repo.getRoutineDetail(routine.id)).toBeUndefined();
    const orphans = await db.routine_exercises.where('routine_id').equals(routine.id).count();
    expect(orphans).toBe(0);
  });
});
