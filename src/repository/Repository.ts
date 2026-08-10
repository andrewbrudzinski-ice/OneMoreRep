import type {
  DayOfWeek,
  Exercise,
  MuscleGroup,
  Routine,
  RoutineExercise,
  Settings,
  User,
  Workout,
  WorkoutExercise,
  WorkoutIntent,
  WorkoutSet,
} from '../types';

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
