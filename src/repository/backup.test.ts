import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId, todayDateString } from '../lib/id';
import { parseBackup } from '../lib/backup';
import { STORE_NAMES } from '../db/database';

/** Phase 6 check: export → wipe → import restores the DB identically. */
describe('IndexedDBRepository — backup round-trip', () => {
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

  async function seedRealisticData() {
    const routine = await repo.createRoutine({ name: 'Push', notes: 'chest day' });
    await repo.addRoutineExercise(routine.id, 'ex-barbell-bench-press', { target_sets: 4 });

    const workout = await repo.startWorkout({ name: 'Push', routine_id: routine.id });
    const detail = await repo.getWorkoutDetail(workout.id);
    const set = await repo.addSet(detail!.exercises[0]!.id, { weight: 185, reps: 8 });
    await repo.updateSet(set.id, { is_completed: true });
    await repo.completeWorkout(workout.id);

    const food = await repo.createFood({
      name: 'Chicken',
      serving_size: 100,
      serving_unit: 'g',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 4,
      fiber: 0,
    });
    await repo.addFoodEntry(todayDateString(), { food_id: food.id, meal_type: 'lunch', servings: 2 });
    await repo.addBodyWeightEntry({ date: todayDateString(), weight: 185 });
  }

  it('export → wipe → import restores every store deep-equal', async () => {
    await seedRealisticData();

    const before = await repo.exportData();
    // Round-trip through JSON like a real file save/load.
    const roundTripped = parseBackup(JSON.stringify(before), STORE_NAMES);

    // Wipe everything.
    await repo.importData({ ...roundTripped, data: {} });
    const emptied = await repo.exportData();
    for (const store of STORE_NAMES) {
      expect(emptied.data[store]).toEqual([]);
    }

    // Restore from the backup.
    await repo.importData(roundTripped);
    const after = await repo.exportData();

    for (const store of STORE_NAMES) {
      const sortById = (rows: unknown[]) =>
        [...rows].sort((a, b) =>
          String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)),
        );
      expect(sortById(after.data[store]!)).toEqual(sortById(before.data[store]!));
    }
  });

  it('a restored database answers domain queries identically', async () => {
    await seedRealisticData();
    const before = await repo.exportData();

    await repo.importData(parseBackup(JSON.stringify(before), STORE_NAMES));

    // Data-level checks post-restore.
    const foods = await repo.getFoods();
    expect(foods.map((f) => f.name)).toContain('Chicken');
    const day = await repo.getNutritionDay(todayDateString());
    expect(day.totals.calories).toBe(330);
    const stats = await repo.getBodyWeightStats();
    expect(stats.current).toBe(185);
    const prs = await repo.getPersonalRecords({ exerciseId: 'ex-barbell-bench-press' });
    expect(prs.length).toBeGreaterThan(0);
  });
});
