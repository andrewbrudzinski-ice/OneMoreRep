import type {
  DayOfWeek,
  Exercise,
  MuscleGroup,
  Routine,
  RoutineExercise,
  Settings,
  User,
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
