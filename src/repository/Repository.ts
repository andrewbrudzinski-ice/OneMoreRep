import type {
  BodyWeightEntry,
  DateString,
  DayOfWeek,
  Exercise,
  Food,
  FoodEntry,
  Meal,
  MealItem,
  MealType,
  MuscleGroup,
  NutritionLog,
  PersonalRecord,
  Routine,
  RoutineExercise,
  Settings,
  User,
  Workout,
  WorkoutExercise,
  WorkoutIntent,
  WorkoutSet,
} from '../types';
import type { VsLastResult } from '../lib/workoutSummary';
import type { MacroTotals } from '../lib/nutrition';
import type { BackupFile } from '../lib/backup';
import type { ReadinessResult } from '../lib/readiness';
import type { AutoRegResult } from '../lib/autoRegulation';

/**
 * The Repository contract — the ONLY surface the UI is allowed to touch for
 * data. v1 ships {@link IndexedDBRepository}; a future `SupabaseRepository`
 * implements this same interface and the UI does not change.
 *
 * This interface grows one phase at a time. Phase 0 covers app bootstrap:
 * seeding, the current user, settings, muscle groups, and exercises (the
 * data the shell + smoke test need). Later phases extend it with routines,
 * workouts, the Beat Last Time engine wiring, nutrition, etc.
 */
export interface Repository {
  /** Idempotent first-launch setup: seed reference data if missing. */
  seed(): Promise<void>;

  // --- Users ---------------------------------------------------------------
  getCurrentUser(): Promise<User>;
  updateUser(patch: { name?: string }): Promise<User>;

  // --- Settings ------------------------------------------------------------
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Omit<Settings, keyof BaseKeys>>): Promise<Settings>;

  // --- Muscle groups -------------------------------------------------------
  getMuscleGroups(): Promise<MuscleGroup[]>;

  // --- Exercises -----------------------------------------------------------
  getExercises(options?: { includeArchived?: boolean }): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | undefined>;
  createExercise(input: NewExerciseInput): Promise<Exercise>;
  updateExercise(id: string, patch: Partial<NewExerciseInput>): Promise<Exercise>;
  setExerciseArchived(id: string, archived: boolean): Promise<Exercise>;

  // --- Routines ------------------------------------------------------------
  getRoutines(): Promise<Routine[]>;
  getRoutine(id: string): Promise<Routine | undefined>;
  getRoutineDetail(id: string): Promise<RoutineDetail | undefined>;
  createRoutine(input: NewRoutineInput): Promise<Routine>;
  updateRoutine(id: string, patch: Partial<NewRoutineInput>): Promise<Routine>;
  deleteRoutine(id: string): Promise<void>;
  duplicateRoutine(id: string): Promise<Routine>;

  // Routine exercises (children of a routine)
  addRoutineExercise(
    routineId: string,
    exerciseId: string,
    input?: RoutineExerciseInput,
  ): Promise<RoutineExercise>;
  updateRoutineExercise(id: string, patch: RoutineExerciseInput): Promise<RoutineExercise>;
  removeRoutineExercise(id: string): Promise<void>;
  /** Persist a new order for a routine's exercises (ids in desired order). */
  reorderRoutineExercises(routineId: string, orderedIds: string[]): Promise<void>;

  // --- Workouts ------------------------------------------------------------
  /** Start a session; if `routine_id` is set, its exercises are copied in. */
  startWorkout(input: NewWorkoutInput): Promise<Workout>;
  /** The most recent in-progress workout (completed_at null), if any. */
  getActiveWorkout(): Promise<Workout | undefined>;
  getWorkout(id: string): Promise<Workout | undefined>;
  getWorkoutDetail(id: string): Promise<WorkoutDetail | undefined>;
  updateWorkout(id: string, patch: WorkoutPatch): Promise<Workout>;
  /** Close the session: stamp completed_at + duration_seconds. */
  completeWorkout(id: string): Promise<Workout>;
  /** Abandon and delete an in-progress session (and its children). */
  cancelWorkout(id: string): Promise<void>;

  // Workout exercises
  addWorkoutExercise(workoutId: string, exerciseId: string): Promise<WorkoutExercise>;
  updateWorkoutExercise(id: string, patch: { notes?: string }): Promise<WorkoutExercise>;
  /** Replace the exercise (swap); existing sets for the row are cleared. */
  swapWorkoutExercise(id: string, newExerciseId: string): Promise<WorkoutExercise>;
  removeWorkoutExercise(id: string): Promise<void>;
  reorderWorkoutExercises(workoutId: string, orderedIds: string[]): Promise<void>;

  // Sets (written immediately — crash-safe)
  addSet(workoutExerciseId: string, input?: NewSetInput): Promise<WorkoutSet>;
  updateSet(id: string, patch: SetPatch): Promise<WorkoutSet>;
  removeSet(id: string): Promise<void>;

  /** The working + warm-up sets from the last COMPLETED session of an
   * exercise (for LAST TIME display and Beat Last Time comparison). */
  getLastSession(
    exerciseId: string,
    options?: { excludeWorkoutId?: string },
  ): Promise<LastSession | undefined>;

  // --- History, PRs & summary ----------------------------------------------
  /** Cached personal records, newest first. Optionally filtered by exercise. */
  getPersonalRecords(options?: { exerciseId?: string }): Promise<PersonalRecord[]>;
  /** Per-exercise history: sessions + lifetime bests, for the history view. */
  getExerciseHistory(exerciseId: string): Promise<ExerciseHistory | undefined>;
  /** Post-completion summary: counts, volume, vs-last, and new PRs. */
  getWorkoutSummary(workoutId: string): Promise<WorkoutSummaryData | undefined>;

  // --- Nutrition: foods ----------------------------------------------------
  getFoods(): Promise<Food[]>;
  getFood(id: string): Promise<Food | undefined>;
  createFood(input: NewFoodInput): Promise<Food>;
  updateFood(id: string, patch: Partial<NewFoodInput>): Promise<Food>;
  deleteFood(id: string): Promise<void>;

  // --- Nutrition: meals ----------------------------------------------------
  getMeals(): Promise<Meal[]>;
  getMealDetail(id: string): Promise<MealDetail | undefined>;
  createMeal(input: NewMealInput): Promise<Meal>;
  updateMeal(id: string, patch: NewMealInput): Promise<Meal>;
  deleteMeal(id: string): Promise<void>;
  addMealItem(mealId: string, foodId: string, servings: number): Promise<MealItem>;
  updateMealItem(id: string, servings: number): Promise<MealItem>;
  removeMealItem(id: string): Promise<void>;

  // --- Nutrition: daily log ------------------------------------------------
  getNutritionDay(date: DateString): Promise<NutritionDay>;
  /** Log a single food into a day/meal, snapshotting its macros. */
  addFoodEntry(date: DateString, input: FoodEntryInput): Promise<FoodEntry>;
  /** Quick-add every item of a saved meal into a day/meal, each snapshotted. */
  addMealToDay(date: DateString, mealId: string, mealType: MealType): Promise<FoodEntry[]>;
  updateFoodEntry(id: string, patch: FoodEntryPatch): Promise<FoodEntry>;
  removeFoodEntry(id: string): Promise<void>;

  // --- Bodyweight ----------------------------------------------------------
  /** Entries ascending by date. */
  getBodyWeightEntries(): Promise<BodyWeightEntry[]>;
  /** Upsert the entry for a date (one weigh-in per day). */
  addBodyWeightEntry(input: NewBodyWeightInput): Promise<BodyWeightEntry>;
  updateBodyWeightEntry(id: string, patch: Partial<NewBodyWeightInput>): Promise<BodyWeightEntry>;
  deleteBodyWeightEntry(id: string): Promise<void>;
  getBodyWeightStats(): Promise<BodyWeightStats>;

  // --- Dashboard -----------------------------------------------------------
  getDashboardData(): Promise<DashboardData>;
  /** Analytics for the Progress page: frequency, streaks, macro consistency. */
  getProgressStats(): Promise<ProgressStats>;

  // --- Backup (export / import) --------------------------------------------
  /** Full-database snapshot as a validated backup envelope. */
  exportData(): Promise<BackupFile>;
  /** Replace ALL data with a validated backup (wipe + restore). */
  importData(backup: BackupFile): Promise<void>;

  // --- Phase 7: should-haves -----------------------------------------------
  /** Qualitative training-readiness signal from the user's own log. */
  getReadiness(): Promise<ReadinessResult>;
  /** Weekly per-muscle working volume for the heatmap. */
  getMuscleHeatmap(): Promise<MuscleHeatmapCell[]>;
  /** RPE auto-regulation suggestion for an exercise (transparent rule). */
  getProgressionSuggestion(exerciseId: string, targetReps?: number): Promise<AutoRegResult>;
  /** The rest duration last used for an exercise (per-exercise memory). */
  getLastRestSeconds(exerciseId: string): Promise<number | null>;
}

/** Record fields the caller never sets directly (managed by the repository). */
export type BaseKeys = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/** Shape for creating a custom exercise (repository fills the base fields). */
export interface NewExerciseInput {
  name: string;
  primary_muscle_group_id: string;
  secondary_muscle_group_ids?: string[];
  equipment: Exercise['equipment'];
  movement_type: Exercise['movement_type'];
  is_compound?: boolean;
  instructions?: string;
}

/** Shape for creating/editing a routine (repository fills the base fields). */
export interface NewRoutineInput {
  name: string;
  notes?: string;
  day_of_week?: DayOfWeek;
}

/** Editable fields on a routine exercise (targets + notes). */
export interface RoutineExerciseInput {
  target_sets?: number;
  target_reps_low?: number;
  target_reps_high?: number;
  notes?: string;
}

/** A routine exercise joined with its resolved Exercise (may be missing). */
export interface RoutineExerciseWithExercise extends RoutineExercise {
  exercise: Exercise | undefined;
}

/** A routine plus its ordered, exercise-resolved children. */
export interface RoutineDetail {
  routine: Routine;
  items: RoutineExerciseWithExercise[];
}

/** Shape for starting a workout. */
export interface NewWorkoutInput {
  name: string;
  routine_id?: string | null;
  intent?: WorkoutIntent;
}

/** Editable workout fields (during or after a session). */
export interface WorkoutPatch {
  name?: string;
  notes?: string;
  intent?: WorkoutIntent;
}

/** Fields settable when adding a new set. */
export interface NewSetInput {
  weight?: number;
  reps?: number;
  is_warmup?: boolean;
}

/** Editable set fields. */
export interface SetPatch {
  weight?: number;
  reps?: number;
  rpe?: number | null;
  is_warmup?: boolean;
  is_completed?: boolean;
  rest_seconds?: number | null;
}

/** A workout exercise joined with its Exercise and ordered sets. */
export interface WorkoutExerciseWithSets extends WorkoutExercise {
  exercise: Exercise | undefined;
  sets: WorkoutSet[];
}

/** A workout plus its ordered, resolved exercises and their sets. */
export interface WorkoutDetail {
  workout: Workout;
  exercises: WorkoutExerciseWithSets[];
}

/** The sets logged for an exercise in its most recent completed session. */
export interface LastSession {
  workout: Workout;
  sets: WorkoutSet[];
}

/** One completed session in an exercise's history. */
export interface ExerciseHistorySession {
  workout: Workout;
  sets: WorkoutSet[];
  /** Working-set volume (warm-ups excluded). */
  volume: number;
  /** Best Epley e1RM among working sets. */
  bestE1rm: number;
  /** Heaviest working-set weight in the session. */
  topWeight: number;
}

/** Per-exercise history with lifetime bests. */
export interface ExerciseHistory {
  exercise: Exercise;
  /** Sessions, most-recent first. */
  sessions: ExerciseHistorySession[];
  bestWeight: number;
  bestReps: number;
  bestE1rm: number;
  bestSetVolume: number;
  bestWorkoutVolume: number;
  lifetimeVolume: number;
}

/** Everything the post-workout summary screen needs. */
export interface WorkoutSummaryData {
  workout: Workout;
  exerciseCount: number;
  workingSetCount: number;
  totalVolume: number;
  vsLast: VsLastResult;
  newPRs: PersonalRecord[];
}

// --- Nutrition inputs & views ---------------------------------------------

/** Shape for creating/editing a custom food (per-serving macros). */
export interface NewFoodInput {
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface NewMealInput {
  name: string;
  notes?: string;
}

export interface FoodEntryInput {
  food_id: string;
  meal_type: MealType;
  servings: number;
}

export interface FoodEntryPatch {
  servings?: number;
  meal_type?: MealType;
}

/** A meal item joined with its food (food may have been deleted). */
export interface MealItemWithFood extends MealItem {
  food: Food | undefined;
}

/** A meal with its resolved items and computed per-serving totals. */
export interface MealDetail {
  meal: Meal;
  items: MealItemWithFood[];
  totals: MacroTotals;
}

/** A food entry joined with its food (food may have been deleted). */
export interface FoodEntryWithFood extends FoodEntry {
  food: Food | undefined;
}

/** A day's nutrition: the log, entries grouped by meal, and totals. */
export interface NutritionDay {
  date: DateString;
  log: NutritionLog | null;
  entries: FoodEntryWithFood[];
  byMeal: Record<MealType, FoodEntryWithFood[]>;
  totals: MacroTotals;
}

// --- Bodyweight & dashboard ------------------------------------------------

export interface NewBodyWeightInput {
  date: DateString;
  weight: number;
  note?: string;
}

export interface BodyWeightStats {
  current: number | null;
  start: number | null;
  change: number | null;
  avg7: number | null;
  avg30: number | null;
  high: number | null;
  low: number | null;
  count: number;
}

/** A PR joined with its exercise name for the dashboard/feed. */
export interface PersonalRecordView {
  record: PersonalRecord;
  exerciseName: string;
}

/** Fixed dashboard payload — assembled server-side (repository-side) so the
 * Home screen just renders. */
export interface DashboardData {
  userName: string;
  settings: Settings;
  activeWorkout: Workout | null;
  suggestedRoutine: Routine | null;
  todayTotals: MacroTotals;
  bodyweight: {
    latest: BodyWeightEntry | null;
    changeFromStart: number | null;
    avg7: number | null;
    /** Recent weights (oldest→newest) for a sparkline. */
    sparkline: number[];
  };
  week: {
    workoutsThisWeek: number;
    streak: number;
  };
  recentPRs: PersonalRecordView[];
  /** Working volume over the last 7 days. */
  weeklyVolume: number;
  /** Per-day working volume for the last 7 days (oldest→newest). */
  volumeSparkline: number[];
  /** Training readiness signal (Phase 7). */
  readiness: ReadinessResult;
}

/** One muscle group's weekly heatmap cell. */
export interface MuscleHeatmapCell {
  muscleGroupId: string;
  name: string;
  volume: number;
  /** 0..1 relative to the busiest muscle this week. */
  intensity: number;
  /** Exercises that hit this muscle (as primary) this week, by volume. */
  exercises: { name: string; volume: number }[];
}

/** Analytics for the Progress page. */
export interface ProgressStats {
  currentStreak: number;
  longestStreak: number;
  workoutsThisWeek: number;
  totalWorkouts: number;
  /** 0/1 per day for the last 14 days (oldest→newest). */
  activityLast14: number[];
  macroConsistency: {
    /** Days in the last 7 with any food logged. */
    daysLogged: number;
    /** Of those, days that met the protein target. */
    proteinMet: number;
    /** Of those, days within ±10% of the calorie target. */
    calorieMet: number;
  };
}
