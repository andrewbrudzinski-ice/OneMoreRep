/**
 * Data model — the single source of truth for the whole app.
 *
 * Every record is shaped like a Postgres row: a UUID `id`, a `user_id`
 * (defaulting to `"local-user"`), and `created_at` / `updated_at` ISO
 * timestamps. This keeps the schema RLS-ready and lets a future
 * `SupabaseRepository` transfer the shape almost verbatim.
 */

export const LOCAL_USER_ID = 'local-user';

/** ISO-8601 timestamp string, e.g. "2026-08-10T12:34:56.000Z". */
export type ISOTimestamp = string;

/** Calendar date string, e.g. "2026-08-10" (no time component). */
export type DateString = string;

/** Fields carried by every stored record. */
export interface BaseRecord {
  id: string;
  user_id: string;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Core / identity
// ---------------------------------------------------------------------------

export interface User extends BaseRecord {
  name: string;
}

export type Units = 'lbs' | 'kg';
export type Theme = 'light' | 'dark' | 'system';
export type Sex = 'male' | 'female' | 'other' | 'unspecified';
export type Goal = 'cut' | 'maintain' | 'bulk' | 'recomp' | 'general';

export interface Settings extends BaseRecord {
  units: Units;
  height: number | null;
  age: number | null;
  sex: Sex;
  calorie_target: number | null;
  protein_target: number | null;
  carb_target: number | null;
  fat_target: number | null;
  fiber_target: number | null;
  default_rest_seconds: number;
  theme: Theme;
  goal: Goal;
  /** When true, heavier weight (≥1 rep) always reads green. Default true. */
  load_always_green: boolean;
  /** Internal: set once the starter routine templates have been seeded. */
  starter_routines_seeded?: boolean;
}

// ---------------------------------------------------------------------------
// Exercises & muscle groups
// ---------------------------------------------------------------------------

/** Muscle groups are user-global system data (no user_id in the spec). */
export interface MuscleGroup {
  id: string;
  name: string;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';

export type MovementType = 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'core' | 'isolation';

export interface Exercise extends BaseRecord {
  name: string;
  primary_muscle_group_id: string;
  secondary_muscle_group_ids: string[];
  equipment: Equipment;
  movement_type: MovementType;
  is_compound: boolean;
  instructions: string;
  is_custom: boolean;
  is_archived: boolean;
}

// ---------------------------------------------------------------------------
// Routines (reusable templates)
// ---------------------------------------------------------------------------

/** 0 = Sunday … 6 = Saturday, or null for "any day". */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 | null;

export interface Routine extends BaseRecord {
  name: string;
  notes: string;
  day_of_week: DayOfWeek;
  sort_order: number;
}

export interface RoutineExercise extends BaseRecord {
  routine_id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number;
  target_reps_low: number;
  target_reps_high: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Workouts (actual logged sessions)
// ---------------------------------------------------------------------------

export type WorkoutIntent = 'push' | 'normal' | 'light' | 'deload';

export interface Workout extends BaseRecord {
  routine_id: string | null;
  name: string;
  started_at: ISOTimestamp;
  completed_at: ISOTimestamp | null;
  duration_seconds: number | null;
  notes: string;
  intent: WorkoutIntent;
}

export interface WorkoutExercise extends BaseRecord {
  workout_id: string;
  exercise_id: string;
  sort_order: number;
  notes: string;
}

export interface WorkoutSet extends BaseRecord {
  workout_exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  is_completed: boolean;
  rest_seconds: number | null;
  logged_at: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Personal records (derived + cached)
// ---------------------------------------------------------------------------

export type PRType =
  | 'heaviest_weight'
  | 'reps_at_weight'
  | 'estimated_1rm'
  | 'best_set_volume'
  | 'best_workout_volume';

export interface PersonalRecord extends BaseRecord {
  exercise_id: string;
  pr_type: PRType;
  value: number;
  weight: number | null;
  reps: number | null;
  achieved_at: ISOTimestamp;
  set_id: string | null;
  previous_value: number | null;
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Food extends BaseRecord {
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  is_custom: boolean;
}

export interface Meal extends BaseRecord {
  name: string;
  notes: string;
}

export interface MealItem extends BaseRecord {
  meal_id: string;
  food_id: string;
  servings: number;
}

export interface NutritionLog extends BaseRecord {
  date: DateString;
}

export interface FoodEntry extends BaseRecord {
  nutrition_log_id: string;
  food_id: string | null;
  meal_type: MealType;
  servings: number;
  // Snapshots — macros frozen at log time so editing a food later never
  // rewrites past logs.
  name_snapshot: string;
  calories_snapshot: number;
  protein_snapshot: number;
  carbs_snapshot: number;
  fat_snapshot: number;
  fiber_snapshot: number;
}

// ---------------------------------------------------------------------------
// Body weight
// ---------------------------------------------------------------------------

export interface BodyWeightEntry extends BaseRecord {
  date: DateString;
  weight: number;
  note: string;
}
