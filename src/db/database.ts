import Dexie, { type Table } from 'dexie';
import type {
  BodyWeightEntry,
  Exercise,
  Food,
  FoodEntry,
  Meal,
  MealItem,
  MuscleGroup,
  NutritionLog,
  PersonalRecord,
  Routine,
  RoutineExercise,
  Settings,
  User,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types';

/**
 * The Dexie database. Stores are keyed and indexed to mirror the Postgres
 * schema. `sets` is the highest-volume table — indexed on
 * `workout_exercise_id` for fast history/PR/Beat queries.
 *
 * NOTE: Only Dexie owns these tables. Components never touch this directly —
 * all access goes through the Repository layer.
 */
export class FitnessDB extends Dexie {
  users!: Table<User, string>;
  settings!: Table<Settings, string>;
  muscle_groups!: Table<MuscleGroup, string>;
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  routine_exercises!: Table<RoutineExercise, string>;
  workouts!: Table<Workout, string>;
  workout_exercises!: Table<WorkoutExercise, string>;
  sets!: Table<WorkoutSet, string>;
  personal_records!: Table<PersonalRecord, string>;
  foods!: Table<Food, string>;
  meals!: Table<Meal, string>;
  meal_items!: Table<MealItem, string>;
  nutrition_logs!: Table<NutritionLog, string>;
  body_weight_entries!: Table<BodyWeightEntry, string>;
  food_entries!: Table<FoodEntry, string>;

  constructor(name = 'onemorerep') {
    super(name);

    // Version 1 — full v1 schema. Only indexed fields are listed; all other
    // properties are stored but not indexed.
    this.version(1).stores({
      users: 'id, name',
      settings: 'id, user_id',
      muscle_groups: 'id, name',
      exercises: 'id, user_id, name, primary_muscle_group_id, is_custom, is_archived',
      routines: 'id, user_id, sort_order, day_of_week',
      routine_exercises: 'id, routine_id, exercise_id, sort_order',
      workouts: 'id, user_id, routine_id, started_at, completed_at, intent',
      workout_exercises: 'id, workout_id, exercise_id, sort_order',
      sets: 'id, workout_exercise_id, [workout_exercise_id+set_number], logged_at',
      personal_records: 'id, user_id, exercise_id, pr_type, [exercise_id+pr_type], achieved_at',
      foods: 'id, user_id, name, is_custom',
      meals: 'id, user_id, name',
      meal_items: 'id, meal_id, food_id',
      nutrition_logs: 'id, user_id, date',
      food_entries: 'id, nutrition_log_id, food_id, meal_type',
      body_weight_entries: 'id, user_id, date',
    });
  }
}

/** All Dexie store names, useful for export/import and wiping. */
export const STORE_NAMES = [
  'users',
  'settings',
  'muscle_groups',
  'exercises',
  'routines',
  'routine_exercises',
  'workouts',
  'workout_exercises',
  'sets',
  'personal_records',
  'foods',
  'meals',
  'meal_items',
  'nutrition_logs',
  'food_entries',
  'body_weight_entries',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

/** Singleton instance used by the app at runtime. */
export const db = new FitnessDB();
