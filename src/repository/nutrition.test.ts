import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId } from '../lib/id';
import type { NewFoodInput } from './Repository';

const chicken: NewFoodInput = {
  name: 'Chicken Breast',
  serving_size: 100,
  serving_unit: 'g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
};

const rice: NewFoodInput = {
  name: 'White Rice',
  serving_size: 100,
  serving_unit: 'g',
  calories: 130,
  protein: 2.7,
  carbs: 28,
  fat: 0.3,
  fiber: 0.4,
};

describe('IndexedDBRepository — nutrition', () => {
  let db: FitnessDB;
  let repo: IndexedDBRepository;
  const today = '2026-08-10';

  beforeEach(async () => {
    db = new FitnessDB(`test-${newId()}`);
    await db.open();
    repo = new IndexedDBRepository(db);
    await repo.seed();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('snapshot integrity: editing a food does NOT change existing entries', async () => {
    const food = await repo.createFood(chicken);
    await repo.addFoodEntry(today, { food_id: food.id, meal_type: 'lunch', servings: 2 });

    const before = await repo.getNutritionDay(today);
    expect(before.totals.calories).toBe(330); // 165 × 2
    expect(before.totals.protein).toBe(62);

    // Drastically edit the food AFTER logging it.
    await repo.updateFood(food.id, { calories: 999, protein: 1 });

    const after = await repo.getNutritionDay(today);
    // The logged entry is frozen — totals are unchanged.
    expect(after.totals.calories).toBe(330);
    expect(after.totals.protein).toBe(62);
    expect(after.entries[0]?.calories_snapshot).toBe(165);
  });

  it('deleting a food leaves past entries intact (snapshot survives)', async () => {
    const food = await repo.createFood(rice);
    await repo.addFoodEntry(today, { food_id: food.id, meal_type: 'dinner', servings: 1.5 });
    await repo.deleteFood(food.id);

    const day = await repo.getNutritionDay(today);
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0]?.name_snapshot).toBe('White Rice');
    expect(day.totals.carbs).toBeCloseTo(28 * 1.5, 5);
    expect(day.entries[0]?.food).toBeUndefined(); // food gone, snapshot remains
  });

  it('daily totals sum across meals and reflect servings/edits', async () => {
    const c = await repo.createFood(chicken);
    const r = await repo.createFood(rice);
    await repo.addFoodEntry(today, { food_id: c.id, meal_type: 'lunch', servings: 2 });
    const riceEntry = await repo.addFoodEntry(today, {
      food_id: r.id,
      meal_type: 'lunch',
      servings: 2,
    });

    let day = await repo.getNutritionDay(today);
    expect(day.totals.calories).toBe(330 + 260);
    expect(day.byMeal.lunch).toHaveLength(2);
    expect(day.byMeal.breakfast).toHaveLength(0);

    // Change servings on the rice entry → totals update.
    await repo.updateFoodEntry(riceEntry.id, { servings: 1 });
    day = await repo.getNutritionDay(today);
    expect(day.totals.calories).toBe(330 + 130);

    // Remove it entirely.
    await repo.removeFoodEntry(riceEntry.id);
    day = await repo.getNutritionDay(today);
    expect(day.totals.calories).toBe(330);
  });

  it('quick-add a saved meal expands into snapshotted entries', async () => {
    const c = await repo.createFood(chicken);
    const r = await repo.createFood(rice);
    const meal = await repo.createMeal({ name: 'Chicken & Rice' });
    await repo.addMealItem(meal.id, c.id, 2);
    await repo.addMealItem(meal.id, r.id, 1.5);

    const detail = await repo.getMealDetail(meal.id);
    expect(detail?.totals.calories).toBe(165 * 2 + 130 * 1.5);

    const entries = await repo.addMealToDay(today, meal.id, 'dinner');
    expect(entries).toHaveLength(2);

    const day = await repo.getNutritionDay(today);
    expect(day.byMeal.dinner).toHaveLength(2);
    expect(day.totals.calories).toBe(165 * 2 + 130 * 1.5);

    // Editing the meal's food later must not change what we already logged.
    await repo.updateFood(c.id, { calories: 5 });
    const day2 = await repo.getNutritionDay(today);
    expect(day2.totals.calories).toBe(165 * 2 + 130 * 1.5);
  });

  it('does not create a log row just by viewing an empty day', async () => {
    const day = await repo.getNutritionDay('2026-01-01');
    expect(day.log).toBeNull();
    expect(await db.nutrition_logs.count()).toBe(0);
  });
});
