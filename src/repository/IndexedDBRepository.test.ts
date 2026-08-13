import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { EXERCISE_SEED, MUSCLE_GROUP_SEED, ROUTINE_SEED } from '../db/seedData';
import { newId } from '../lib/id';

/**
 * Phase 0 smoke test: seed idempotency + a full write→read round-trip
 * through the Repository (never touching Dexie directly from the test's
 * assertions beyond setup/teardown).
 */
describe('IndexedDBRepository (Phase 0 foundation)', () => {
  let db: FitnessDB;
  let repo: IndexedDBRepository;

  beforeEach(async () => {
    db = new FitnessDB(`test-${newId()}`);
    await db.open();
    repo = new IndexedDBRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('seeds the local user, settings, muscle groups, and exercises', async () => {
    await repo.seed();

    const user = await repo.getCurrentUser();
    expect(user.name).toBe('Me');

    const settings = await repo.getSettings();
    expect(settings.load_always_green).toBe(true);
    expect(settings.units).toBe('lbs');

    const groups = await repo.getMuscleGroups();
    expect(groups).toHaveLength(MUSCLE_GROUP_SEED.length);

    const exercises = await repo.getExercises();
    expect(exercises).toHaveLength(EXERCISE_SEED.length);
    expect(exercises.length).toBeGreaterThanOrEqual(40);
  });

  it('seeds exactly once — repeated seed() adds no duplicates', async () => {
    await repo.seed();
    await repo.seed();
    await repo.seed();

    const groups = await repo.getMuscleGroups();
    const exercises = await repo.getExercises();
    expect(groups).toHaveLength(MUSCLE_GROUP_SEED.length);
    expect(exercises).toHaveLength(EXERCISE_SEED.length);
  });

  it('seeds starter routine templates once, and never re-adds them', async () => {
    await repo.seed();
    let routines = await repo.getRoutines();
    expect(routines).toHaveLength(ROUTINE_SEED.length);

    // Each template has its exercises wired up.
    const push = routines.find((r) => r.name === 'Push Day');
    const detail = await repo.getRoutineDetail(push!.id);
    expect(detail?.items.length).toBeGreaterThan(0);
    expect(detail?.items[0]?.exercise?.name).toBeTruthy();

    // Re-seeding does not duplicate.
    await repo.seed();
    expect(await repo.getRoutines()).toHaveLength(ROUTINE_SEED.length);

    // Deleting a template and re-seeding does NOT bring it back (guarded).
    await repo.deleteRoutine(push!.id);
    await repo.seed();
    routines = await repo.getRoutines();
    expect(routines).toHaveLength(ROUTINE_SEED.length - 1);
    expect(routines.find((r) => r.name === 'Push Day')).toBeUndefined();
  });

  it('writes and reads a record back through the repository', async () => {
    await repo.seed();

    const created = await repo.createExercise({
      name: 'Test Cable Thruster',
      primary_muscle_group_id: 'mg-shoulders',
      equipment: 'cable',
      movement_type: 'push',
      is_compound: true,
      instructions: 'A made-up movement for the smoke test.',
    });

    expect(created.id).toBeTruthy();
    expect(created.is_custom).toBe(true);
    expect(created.user_id).toBe('local-user');

    const fetched = await repo.getExercise(created.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Test Cable Thruster');
    expect(fetched?.created_at).toBe(created.created_at);
  });

  it('updates settings through the repository', async () => {
    await repo.seed();
    const updated = await repo.updateSettings({ protein_target: 190, units: 'kg' });
    expect(updated.protein_target).toBe(190);
    expect(updated.units).toBe('kg');

    const reread = await repo.getSettings();
    expect(reread.protein_target).toBe(190);
  });

  it('archives an exercise and hides it from the default list', async () => {
    await repo.seed();
    const all = await repo.getExercises();
    const target = all[0]!;

    await repo.setExerciseArchived(target.id, true);

    const visible = await repo.getExercises();
    expect(visible.find((e) => e.id === target.id)).toBeUndefined();

    const withArchived = await repo.getExercises({ includeArchived: true });
    expect(withArchived.find((e) => e.id === target.id)).toBeDefined();
  });
});
