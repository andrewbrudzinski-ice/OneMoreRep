import { FitnessDB, db as sharedDb, STORE_NAMES } from '../db/database';
import { buildBackup, type BackupFile } from '../lib/backup';
import { seedDatabase, SETTINGS_ID } from '../db/seed';
import { newId, nowISO } from '../lib/id';
import {
  LOCAL_USER_ID,
  type BodyWeightEntry,
  type DateString,
  type Exercise,
  type Food,
  type FoodEntry,
  type Meal,
  type MealItem,
  type MealType,
  type MuscleGroup,
  type NutritionLog,
  type PersonalRecord,
  type PRType,
  type Routine,
  type RoutineExercise,
  type Settings,
  type User,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '../types';
import type {
  BodyWeightStats,
  DashboardData,
  MuscleHeatmapCell,
  ProgressStats,
  ExerciseHistory,
  ExerciseHistorySession,
  FoodEntryInput,
  FoodEntryPatch,
  FoodEntryWithFood,
  LastSession,
  MealDetail,
  MealItemWithFood,
  NewBodyWeightInput,
  NewExerciseInput,
  NewFoodInput,
  NewMealInput,
  NewRoutineInput,
  NewSetInput,
  NewWorkoutInput,
  NutritionDay,
  PersonalRecordView,
  Repository,
  RoutineDetail,
  RoutineExerciseInput,
  RoutineExerciseWithExercise,
  SetPatch,
  WorkoutDetail,
  WorkoutExerciseWithSets,
  WorkoutPatch,
  WorkoutSummaryData,
} from './Repository';
import { bestE1RM, workingVolume } from '../lib/beatLastTime';
import { detectPRs, exercisePRCandidates } from '../lib/prDetection';
import { summarizeVsLast } from '../lib/workoutSummary';
import { sumEntries, type MacroTotals, ZERO_MACROS } from '../lib/nutrition';
import { averageWithinDays } from '../lib/rollingAverage';
import { countInLastDays, currentStreak, longestStreak } from '../lib/streak';
import { addDays, dayDiff } from '../lib/dates';
import { todayDateString } from '../lib/id';
import { computeReadiness, type ReadinessResult } from '../lib/readiness';
import { aggregateMuscleVolume, normalizeIntensities } from '../lib/muscleVolume';
import {
  suggestProgression,
  type AutoRegResult,
  type RpeSet,
} from '../lib/autoRegulation';

/**
 * IndexedDB-backed repository (via Dexie). This is the v1 implementation of
 * the {@link Repository} contract. It is the single place that reads and
 * writes Dexie — nothing else in the app imports the `db` directly.
 */
export class IndexedDBRepository implements Repository {
  private readonly db: FitnessDB;

  constructor(database: FitnessDB = sharedDb) {
    this.db = database;
  }

  async seed(): Promise<void> {
    await seedDatabase(this.db);
  }

  // --- Users -----------------------------------------------------------------

  async getCurrentUser(): Promise<User> {
    const user = await this.db.users.get(LOCAL_USER_ID);
    if (!user) {
      throw new Error('Local user not found — did seed() run?');
    }
    return user;
  }

  async updateUser(patch: { name?: string }): Promise<User> {
    const current = await this.getCurrentUser();
    const next: User = { ...current, name: patch.name ?? current.name, updated_at: nowISO() };
    await this.db.users.put(next);
    return next;
  }

  // --- Settings --------------------------------------------------------------

  async getSettings(): Promise<Settings> {
    const settings = await this.db.settings.get(SETTINGS_ID);
    if (!settings) {
      throw new Error('Settings not found — did seed() run?');
    }
    return settings;
  }

  async updateSettings(patch: Partial<Omit<Settings, keyof BaseFields>>): Promise<Settings> {
    const current = await this.getSettings();
    const next: Settings = {
      ...current,
      ...patch,
      id: current.id,
      user_id: current.user_id,
      created_at: current.created_at,
      updated_at: nowISO(),
    };
    await this.db.settings.put(next);
    return next;
  }

  // --- Muscle groups ---------------------------------------------------------

  async getMuscleGroups(): Promise<MuscleGroup[]> {
    const groups = await this.db.muscle_groups.toArray();
    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }

  // --- Exercises -------------------------------------------------------------

  async getExercises(options?: { includeArchived?: boolean }): Promise<Exercise[]> {
    const all = await this.db.exercises.toArray();
    const filtered = options?.includeArchived ? all : all.filter((e) => !e.is_archived);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getExercise(id: string): Promise<Exercise | undefined> {
    return this.db.exercises.get(id);
  }

  async createExercise(input: NewExerciseInput): Promise<Exercise> {
    const ts = nowISO();
    const exercise: Exercise = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      name: input.name,
      primary_muscle_group_id: input.primary_muscle_group_id,
      secondary_muscle_group_ids: input.secondary_muscle_group_ids ?? [],
      equipment: input.equipment,
      movement_type: input.movement_type,
      is_compound: input.is_compound ?? false,
      instructions: input.instructions ?? '',
      is_custom: true,
      is_archived: false,
      created_at: ts,
      updated_at: ts,
    };
    await this.db.exercises.add(exercise);
    return exercise;
  }

  async updateExercise(id: string, patch: Partial<NewExerciseInput>): Promise<Exercise> {
    const current = await this.db.exercises.get(id);
    if (!current) {
      throw new Error(`Exercise ${id} not found`);
    }
    const next: Exercise = {
      ...current,
      ...patch,
      secondary_muscle_group_ids:
        patch.secondary_muscle_group_ids ?? current.secondary_muscle_group_ids,
      id: current.id,
      user_id: current.user_id,
      created_at: current.created_at,
      updated_at: nowISO(),
    };
    await this.db.exercises.put(next);
    return next;
  }

  async setExerciseArchived(id: string, archived: boolean): Promise<Exercise> {
    const current = await this.db.exercises.get(id);
    if (!current) {
      throw new Error(`Exercise ${id} not found`);
    }
    const next: Exercise = { ...current, is_archived: archived, updated_at: nowISO() };
    await this.db.exercises.put(next);
    return next;
  }

  // --- Routines --------------------------------------------------------------

  async getRoutines(): Promise<Routine[]> {
    const routines = await this.db.routines.toArray();
    return routines.sort((a, b) => a.sort_order - b.sort_order);
  }

  async getRoutine(id: string): Promise<Routine | undefined> {
    return this.db.routines.get(id);
  }

  async getRoutineDetail(id: string): Promise<RoutineDetail | undefined> {
    const routine = await this.db.routines.get(id);
    if (!routine) return undefined;
    const rows = await this.db.routine_exercises.where('routine_id').equals(id).toArray();
    rows.sort((a, b) => a.sort_order - b.sort_order);
    const exerciseIds = [...new Set(rows.map((r) => r.exercise_id))];
    const exercises = await this.db.exercises.bulkGet(exerciseIds);
    const byId = new Map<string, Exercise>();
    for (const ex of exercises) {
      if (ex) byId.set(ex.id, ex);
    }
    const items: RoutineExerciseWithExercise[] = rows.map((row) => ({
      ...row,
      exercise: byId.get(row.exercise_id),
    }));
    return { routine, items };
  }

  async createRoutine(input: NewRoutineInput): Promise<Routine> {
    const ts = nowISO();
    const maxOrder = await this.nextRoutineSortOrder();
    const routine: Routine = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      name: input.name,
      notes: input.notes ?? '',
      day_of_week: input.day_of_week ?? null,
      sort_order: maxOrder,
      created_at: ts,
      updated_at: ts,
    };
    await this.db.routines.add(routine);
    return routine;
  }

  async updateRoutine(id: string, patch: Partial<NewRoutineInput>): Promise<Routine> {
    const current = await this.db.routines.get(id);
    if (!current) {
      throw new Error(`Routine ${id} not found`);
    }
    const next: Routine = {
      ...current,
      name: patch.name ?? current.name,
      notes: patch.notes ?? current.notes,
      day_of_week: patch.day_of_week === undefined ? current.day_of_week : patch.day_of_week,
      updated_at: nowISO(),
    };
    await this.db.routines.put(next);
    return next;
  }

  async deleteRoutine(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.routines, this.db.routine_exercises, async () => {
      await this.db.routine_exercises.where('routine_id').equals(id).delete();
      await this.db.routines.delete(id);
    });
  }

  async duplicateRoutine(id: string): Promise<Routine> {
    const detail = await this.getRoutineDetail(id);
    if (!detail) {
      throw new Error(`Routine ${id} not found`);
    }
    const ts = nowISO();
    const newRoutineId = newId();
    const copy: Routine = {
      ...detail.routine,
      id: newRoutineId,
      name: `${detail.routine.name} (copy)`,
      sort_order: await this.nextRoutineSortOrder(),
      created_at: ts,
      updated_at: ts,
    };
    const childRows: RoutineExercise[] = detail.items.map((item, index) => ({
      id: newId(),
      user_id: LOCAL_USER_ID,
      routine_id: newRoutineId,
      exercise_id: item.exercise_id,
      sort_order: index,
      target_sets: item.target_sets,
      target_reps_low: item.target_reps_low,
      target_reps_high: item.target_reps_high,
      notes: item.notes,
      created_at: ts,
      updated_at: ts,
    }));
    await this.db.transaction('rw', this.db.routines, this.db.routine_exercises, async () => {
      await this.db.routines.add(copy);
      if (childRows.length > 0) {
        await this.db.routine_exercises.bulkAdd(childRows);
      }
    });
    return copy;
  }

  async addRoutineExercise(
    routineId: string,
    exerciseId: string,
    input?: RoutineExerciseInput,
  ): Promise<RoutineExercise> {
    const ts = nowISO();
    const existing = await this.db.routine_exercises.where('routine_id').equals(routineId).toArray();
    const nextOrder = existing.reduce((max, r) => Math.max(max, r.sort_order + 1), 0);
    const row: RoutineExercise = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      routine_id: routineId,
      exercise_id: exerciseId,
      sort_order: nextOrder,
      target_sets: input?.target_sets ?? 3,
      target_reps_low: input?.target_reps_low ?? 8,
      target_reps_high: input?.target_reps_high ?? 12,
      notes: input?.notes ?? '',
      created_at: ts,
      updated_at: ts,
    };
    await this.db.routine_exercises.add(row);
    return row;
  }

  async updateRoutineExercise(id: string, patch: RoutineExerciseInput): Promise<RoutineExercise> {
    const current = await this.db.routine_exercises.get(id);
    if (!current) {
      throw new Error(`Routine exercise ${id} not found`);
    }
    const next: RoutineExercise = {
      ...current,
      target_sets: patch.target_sets ?? current.target_sets,
      target_reps_low: patch.target_reps_low ?? current.target_reps_low,
      target_reps_high: patch.target_reps_high ?? current.target_reps_high,
      notes: patch.notes ?? current.notes,
      updated_at: nowISO(),
    };
    await this.db.routine_exercises.put(next);
    return next;
  }

  async removeRoutineExercise(id: string): Promise<void> {
    await this.db.routine_exercises.delete(id);
  }

  async reorderRoutineExercises(routineId: string, orderedIds: string[]): Promise<void> {
    const ts = nowISO();
    await this.db.transaction('rw', this.db.routine_exercises, async () => {
      const rows = await this.db.routine_exercises.where('routine_id').equals(routineId).toArray();
      const byId = new Map(rows.map((r) => [r.id, r]));
      let order = 0;
      for (const id of orderedIds) {
        const row = byId.get(id);
        if (row) {
          await this.db.routine_exercises.put({ ...row, sort_order: order, updated_at: ts });
          order += 1;
        }
      }
    });
  }

  /** Next sort_order for a new routine (append to end). */
  private async nextRoutineSortOrder(): Promise<number> {
    const routines = await this.db.routines.toArray();
    return routines.reduce((max, r) => Math.max(max, r.sort_order + 1), 0);
  }

  // --- Workouts --------------------------------------------------------------

  async startWorkout(input: NewWorkoutInput): Promise<Workout> {
    const ts = nowISO();
    const workout: Workout = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      routine_id: input.routine_id ?? null,
      name: input.name,
      started_at: ts,
      completed_at: null,
      duration_seconds: null,
      notes: '',
      intent: input.intent ?? 'normal',
      created_at: ts,
      updated_at: ts,
    };

    await this.db.transaction(
      'rw',
      this.db.workouts,
      this.db.workout_exercises,
      this.db.routine_exercises,
      async () => {
        await this.db.workouts.add(workout);
        if (input.routine_id) {
          const routineExercises = await this.db.routine_exercises
            .where('routine_id')
            .equals(input.routine_id)
            .toArray();
          routineExercises.sort((a, b) => a.sort_order - b.sort_order);
          const rows: WorkoutExercise[] = routineExercises.map((re, index) => ({
            id: newId(),
            user_id: LOCAL_USER_ID,
            workout_id: workout.id,
            exercise_id: re.exercise_id,
            sort_order: index,
            notes: re.notes,
            created_at: ts,
            updated_at: ts,
          }));
          if (rows.length > 0) {
            await this.db.workout_exercises.bulkAdd(rows);
          }
        }
      },
    );
    return workout;
  }

  async getActiveWorkout(): Promise<Workout | undefined> {
    const open = await this.db.workouts.filter((w) => w.completed_at === null).toArray();
    open.sort((a, b) => b.started_at.localeCompare(a.started_at));
    return open[0];
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    return this.db.workouts.get(id);
  }

  async getWorkoutDetail(id: string): Promise<WorkoutDetail | undefined> {
    const workout = await this.db.workouts.get(id);
    if (!workout) return undefined;
    const wex = await this.db.workout_exercises.where('workout_id').equals(id).toArray();
    wex.sort((a, b) => a.sort_order - b.sort_order);

    const exerciseIds = [...new Set(wex.map((w) => w.exercise_id))];
    const exercises = await this.db.exercises.bulkGet(exerciseIds);
    const byId = new Map<string, Exercise>();
    for (const ex of exercises) {
      if (ex) byId.set(ex.id, ex);
    }

    const items: WorkoutExerciseWithSets[] = [];
    for (const row of wex) {
      const sets = await this.db.sets.where('workout_exercise_id').equals(row.id).toArray();
      sets.sort((a, b) => a.set_number - b.set_number);
      items.push({ ...row, exercise: byId.get(row.exercise_id), sets });
    }
    return { workout, exercises: items };
  }

  async updateWorkout(id: string, patch: WorkoutPatch): Promise<Workout> {
    const current = await this.db.workouts.get(id);
    if (!current) throw new Error(`Workout ${id} not found`);
    const next: Workout = {
      ...current,
      name: patch.name ?? current.name,
      notes: patch.notes ?? current.notes,
      intent: patch.intent ?? current.intent,
      updated_at: nowISO(),
    };
    await this.db.workouts.put(next);
    return next;
  }

  async updateWorkoutDate(id: string, date: DateString): Promise<Workout> {
    const current = await this.db.workouts.get(id);
    if (!current) throw new Error(`Workout ${id} not found`);
    // Keep each timestamp's time-of-day; only move the calendar date, which is
    // what day-bucketing (streaks, weekly volume, PR chronology) reads.
    const next: Workout = {
      ...current,
      started_at: `${date}${current.started_at.slice(10)}`,
      completed_at: current.completed_at ? `${date}${current.completed_at.slice(10)}` : null,
      updated_at: nowISO(),
    };
    await this.db.workouts.put(next);
    return next;
  }

  async completeWorkout(id: string): Promise<Workout> {
    const current = await this.db.workouts.get(id);
    if (!current) throw new Error(`Workout ${id} not found`);
    // Guard: don't re-close (and re-detect PRs for) an already-finished session.
    if (current.completed_at !== null) return current;

    const completedAt = nowISO();
    const duration = Math.max(
      0,
      Math.round((new Date(completedAt).getTime() - new Date(current.started_at).getTime()) / 1000),
    );
    const next: Workout = {
      ...current,
      completed_at: completedAt,
      duration_seconds: duration,
      updated_at: completedAt,
    };
    await this.db.workouts.put(next);
    await this.detectAndSaveWorkoutPRs(id, completedAt);
    return next;
  }

  /** Detect PRs from a completed workout and cache them to personal_records. */
  private async detectAndSaveWorkoutPRs(workoutId: string, achievedAt: string): Promise<void> {
    const wex = await this.db.workout_exercises.where('workout_id').equals(workoutId).toArray();

    // Group this session's sets by exercise (usually one row per exercise).
    const setsByExercise = new Map<string, WorkoutSet[]>();
    for (const row of wex) {
      const sets = await this.db.sets.where('workout_exercise_id').equals(row.id).toArray();
      const list = setsByExercise.get(row.exercise_id) ?? [];
      list.push(...sets);
      setsByExercise.set(row.exercise_id, list);
    }

    const newRecords: PersonalRecord[] = [];
    for (const [exerciseId, sets] of setsByExercise) {
      const candidates = exercisePRCandidates(sets);

      // Best value seen so far per type (all existing records predate this).
      const existingRows = await this.db.personal_records
        .where('exercise_id')
        .equals(exerciseId)
        .toArray();
      const existingBest: Partial<Record<PRType, number>> = {};
      for (const row of existingRows) {
        const prior = existingBest[row.pr_type];
        if (prior === undefined || row.value > prior) existingBest[row.pr_type] = row.value;
      }

      for (const pr of detectPRs(candidates, existingBest)) {
        // Best-effort: link the triggering set by matching weight+reps.
        const match = sets.find(
          (s) => !s.is_warmup && s.is_completed && s.weight === pr.weight && s.reps === pr.reps,
        );
        newRecords.push({
          id: newId(),
          user_id: LOCAL_USER_ID,
          exercise_id: exerciseId,
          pr_type: pr.pr_type,
          value: pr.value,
          weight: pr.weight,
          reps: pr.reps,
          achieved_at: achievedAt,
          set_id: match?.id ?? null,
          previous_value: pr.previous_value,
          created_at: achievedAt,
          updated_at: achievedAt,
        });
      }
    }

    if (newRecords.length > 0) {
      await this.db.personal_records.bulkAdd(newRecords);
    }
  }

  async recomputePersonalRecords(): Promise<void> {
    // PRs are historical ("best at the time achieved"), so editing one past
    // session can change what counted as a record and when. Rebuild the whole
    // cache by wiping it and replaying every completed workout in order.
    const completed = (await this.db.workouts.toArray())
      .filter((w): w is Workout & { completed_at: string } => w.completed_at !== null)
      .sort((a, b) => a.completed_at.localeCompare(b.completed_at));
    await this.db.personal_records.clear();
    for (const w of completed) {
      await this.detectAndSaveWorkoutPRs(w.id, w.completed_at);
    }
  }

  async cancelWorkout(id: string): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.workouts,
      this.db.workout_exercises,
      this.db.sets,
      async () => {
        const wex = await this.db.workout_exercises.where('workout_id').equals(id).toArray();
        for (const row of wex) {
          await this.db.sets.where('workout_exercise_id').equals(row.id).delete();
        }
        await this.db.workout_exercises.where('workout_id').equals(id).delete();
        await this.db.workouts.delete(id);
      },
    );
  }

  async addWorkoutExercise(workoutId: string, exerciseId: string): Promise<WorkoutExercise> {
    const ts = nowISO();
    const existing = await this.db.workout_exercises.where('workout_id').equals(workoutId).toArray();
    const nextOrder = existing.reduce((max, r) => Math.max(max, r.sort_order + 1), 0);
    const row: WorkoutExercise = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      workout_id: workoutId,
      exercise_id: exerciseId,
      sort_order: nextOrder,
      notes: '',
      created_at: ts,
      updated_at: ts,
    };
    await this.db.workout_exercises.add(row);
    return row;
  }

  async updateWorkoutExercise(id: string, patch: { notes?: string }): Promise<WorkoutExercise> {
    const current = await this.db.workout_exercises.get(id);
    if (!current) throw new Error(`Workout exercise ${id} not found`);
    const next: WorkoutExercise = {
      ...current,
      notes: patch.notes ?? current.notes,
      updated_at: nowISO(),
    };
    await this.db.workout_exercises.put(next);
    return next;
  }

  async swapWorkoutExercise(id: string, newExerciseId: string): Promise<WorkoutExercise> {
    const current = await this.db.workout_exercises.get(id);
    if (!current) throw new Error(`Workout exercise ${id} not found`);
    const next: WorkoutExercise = {
      ...current,
      exercise_id: newExerciseId,
      updated_at: nowISO(),
    };
    await this.db.transaction('rw', this.db.workout_exercises, this.db.sets, async () => {
      // Clear sets — they belonged to the previous exercise.
      await this.db.sets.where('workout_exercise_id').equals(id).delete();
      await this.db.workout_exercises.put(next);
    });
    return next;
  }

  async removeWorkoutExercise(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.workout_exercises, this.db.sets, async () => {
      await this.db.sets.where('workout_exercise_id').equals(id).delete();
      await this.db.workout_exercises.delete(id);
    });
  }

  async reorderWorkoutExercises(workoutId: string, orderedIds: string[]): Promise<void> {
    const ts = nowISO();
    await this.db.transaction('rw', this.db.workout_exercises, async () => {
      const rows = await this.db.workout_exercises.where('workout_id').equals(workoutId).toArray();
      const byId = new Map(rows.map((r) => [r.id, r]));
      let order = 0;
      for (const rowId of orderedIds) {
        const row = byId.get(rowId);
        if (row) {
          await this.db.workout_exercises.put({ ...row, sort_order: order, updated_at: ts });
          order += 1;
        }
      }
    });
  }

  async addSet(workoutExerciseId: string, input?: NewSetInput): Promise<WorkoutSet> {
    const ts = nowISO();
    const existing = await this.db.sets
      .where('workout_exercise_id')
      .equals(workoutExerciseId)
      .toArray();
    const nextNumber = existing.reduce((max, s) => Math.max(max, s.set_number + 1), 1);
    const set: WorkoutSet = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      workout_exercise_id: workoutExerciseId,
      set_number: nextNumber,
      weight: input?.weight ?? 0,
      reps: input?.reps ?? 0,
      rpe: null,
      is_warmup: input?.is_warmup ?? false,
      is_completed: false,
      rest_seconds: null,
      logged_at: ts,
      created_at: ts,
      updated_at: ts,
    };
    await this.db.sets.add(set);
    return set;
  }

  async updateSet(id: string, patch: SetPatch): Promise<WorkoutSet> {
    const current = await this.db.sets.get(id);
    if (!current) throw new Error(`Set ${id} not found`);
    const next: WorkoutSet = {
      ...current,
      weight: patch.weight ?? current.weight,
      reps: patch.reps ?? current.reps,
      rpe: patch.rpe === undefined ? current.rpe : patch.rpe,
      is_warmup: patch.is_warmup ?? current.is_warmup,
      is_completed: patch.is_completed ?? current.is_completed,
      rest_seconds: patch.rest_seconds === undefined ? current.rest_seconds : patch.rest_seconds,
      // Stamp logged_at when a set is marked complete.
      logged_at: patch.is_completed && !current.is_completed ? nowISO() : current.logged_at,
      updated_at: nowISO(),
    };
    await this.db.sets.put(next);
    return next;
  }

  async removeSet(id: string): Promise<void> {
    await this.db.sets.delete(id);
  }

  // --- History, PRs & summary ------------------------------------------------

  async getPersonalRecords(options?: { exerciseId?: string }): Promise<PersonalRecord[]> {
    const rows = options?.exerciseId
      ? await this.db.personal_records.where('exercise_id').equals(options.exerciseId).toArray()
      : await this.db.personal_records.toArray();
    return rows.sort((a, b) => b.achieved_at.localeCompare(a.achieved_at));
  }

  async getExerciseHistory(exerciseId: string): Promise<ExerciseHistory | undefined> {
    const exercise = await this.db.exercises.get(exerciseId);
    if (!exercise) return undefined;

    const rows = await this.db.workout_exercises.where('exercise_id').equals(exerciseId).toArray();
    const byWorkout = new Map<string, WorkoutExercise[]>();
    for (const row of rows) {
      const list = byWorkout.get(row.workout_id) ?? [];
      list.push(row);
      byWorkout.set(row.workout_id, list);
    }

    const workouts = await this.db.workouts.bulkGet([...byWorkout.keys()]);
    const sessions: ExerciseHistorySession[] = [];
    for (const workout of workouts) {
      if (!workout || workout.completed_at === null) continue;
      const rowIds = (byWorkout.get(workout.id) ?? []).map((r) => r.id);
      const sets: WorkoutSet[] = [];
      for (const rowId of rowIds) {
        sets.push(...(await this.db.sets.where('workout_exercise_id').equals(rowId).toArray()));
      }
      sets.sort((a, b) => a.set_number - b.set_number);
      const working = sets.filter((s) => !s.is_warmup && s.is_completed);
      sessions.push({
        workout,
        sets,
        volume: workingVolume(sets),
        bestE1rm: bestE1RM(sets),
        topWeight: working.reduce((max, s) => Math.max(max, s.weight), 0),
      });
    }

    sessions.sort((a, b) =>
      (b.workout.completed_at ?? '').localeCompare(a.workout.completed_at ?? ''),
    );

    let bestWeight = 0;
    let bestReps = 0;
    let bestE1rm = 0;
    let bestSetVolume = 0;
    let bestWorkoutVolume = 0;
    let lifetimeVolume = 0;
    for (const session of sessions) {
      lifetimeVolume += session.volume;
      bestWorkoutVolume = Math.max(bestWorkoutVolume, session.volume);
      bestE1rm = Math.max(bestE1rm, session.bestE1rm);
      for (const s of session.sets) {
        if (s.is_warmup || !s.is_completed) continue;
        bestWeight = Math.max(bestWeight, s.weight);
        bestReps = Math.max(bestReps, s.reps);
        bestSetVolume = Math.max(bestSetVolume, s.weight * s.reps);
      }
    }

    return {
      exercise,
      sessions,
      bestWeight,
      bestReps,
      bestE1rm,
      bestSetVolume,
      bestWorkoutVolume,
      lifetimeVolume,
    };
  }

  async getWorkoutSummary(workoutId: string): Promise<WorkoutSummaryData | undefined> {
    const detail = await this.getWorkoutDetail(workoutId);
    if (!detail) return undefined;
    const { workout, exercises } = detail;

    let workingSetCount = 0;
    let totalVolume = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        if (!s.is_warmup && s.is_completed) {
          workingSetCount += 1;
          totalVolume += s.weight * s.reps;
        }
      }
    }

    // Comparable prior sessions: same routine if set, else same name.
    const allCompleted = (await this.db.workouts.toArray())
      .filter((w) => w.completed_at !== null && w.id !== workoutId)
      .filter((w) =>
        workout.routine_id ? w.routine_id === workout.routine_id : w.name === workout.name,
      )
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

    const priorVolumes: number[] = [];
    for (const w of allCompleted.slice(0, 3)) {
      priorVolumes.push(await this.computeWorkoutVolume(w.id));
    }
    const lastVolume = priorVolumes.length > 0 ? priorVolumes[0]! : null;
    const recentAverage =
      priorVolumes.length > 0
        ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length
        : null;

    const vsLast = summarizeVsLast({
      intent: workout.intent,
      currentVolume: totalVolume,
      lastVolume,
      recentAverage,
    });

    const newPRs =
      workout.completed_at === null
        ? []
        : (await this.db.personal_records.toArray())
            .filter((pr) => pr.achieved_at === workout.completed_at)
            .sort((a, b) => a.pr_type.localeCompare(b.pr_type));

    return {
      workout,
      exerciseCount: exercises.length,
      workingSetCount,
      totalVolume,
      vsLast,
      newPRs,
    };
  }

  /** Total completed working-set volume for a workout. */
  private async computeWorkoutVolume(workoutId: string): Promise<number> {
    const wex = await this.db.workout_exercises.where('workout_id').equals(workoutId).toArray();
    let total = 0;
    for (const row of wex) {
      const sets = await this.db.sets.where('workout_exercise_id').equals(row.id).toArray();
      for (const s of sets) {
        if (!s.is_warmup && s.is_completed) total += s.weight * s.reps;
      }
    }
    return total;
  }

  async getLastSession(
    exerciseId: string,
    options?: { excludeWorkoutId?: string },
  ): Promise<LastSession | undefined> {
    // All workout_exercise rows for this exercise.
    const rows = await this.db.workout_exercises.where('exercise_id').equals(exerciseId).toArray();
    if (rows.length === 0) return undefined;

    const workoutIds = [...new Set(rows.map((r) => r.workout_id))];
    const workouts = await this.db.workouts.bulkGet(workoutIds);
    const completed = workouts
      .filter((w): w is Workout => !!w && w.completed_at !== null)
      .filter((w) => w.id !== options?.excludeWorkoutId)
      .sort((a, b) =>
        (b.completed_at ?? b.started_at).localeCompare(a.completed_at ?? a.started_at),
      );

    const lastWorkout = completed[0];
    if (!lastWorkout) return undefined;

    const rowsForWorkout = rows.filter((r) => r.workout_id === lastWorkout.id);
    const sets: WorkoutSet[] = [];
    for (const row of rowsForWorkout) {
      const rowSets = await this.db.sets.where('workout_exercise_id').equals(row.id).toArray();
      sets.push(...rowSets);
    }
    sets.sort((a, b) => a.set_number - b.set_number);
    return { workout: lastWorkout, sets };
  }

  // --- Nutrition: foods ------------------------------------------------------

  async getFoods(): Promise<Food[]> {
    const foods = await this.db.foods.toArray();
    return foods.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getFood(id: string): Promise<Food | undefined> {
    return this.db.foods.get(id);
  }

  async createFood(input: NewFoodInput): Promise<Food> {
    const ts = nowISO();
    const food: Food = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      name: input.name,
      serving_size: input.serving_size,
      serving_unit: input.serving_unit,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      fiber: input.fiber,
      is_custom: true,
      created_at: ts,
      updated_at: ts,
    };
    await this.db.foods.add(food);
    return food;
  }

  async updateFood(id: string, patch: Partial<NewFoodInput>): Promise<Food> {
    const current = await this.db.foods.get(id);
    if (!current) throw new Error(`Food ${id} not found`);
    const next: Food = { ...current, ...patch, id: current.id, updated_at: nowISO() };
    await this.db.foods.put(next);
    return next;
  }

  async deleteFood(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.foods, this.db.meal_items, async () => {
      await this.db.meal_items.where('food_id').equals(id).delete();
      await this.db.foods.delete(id);
    });
    // Note: food_entries keep their snapshot — deleting a food never rewrites
    // history (their food_id simply becomes a dangling reference).
  }

  // --- Nutrition: meals ------------------------------------------------------

  async getMeals(): Promise<Meal[]> {
    const meals = await this.db.meals.toArray();
    return meals.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getMealDetail(id: string): Promise<MealDetail | undefined> {
    const meal = await this.db.meals.get(id);
    if (!meal) return undefined;
    const items = await this.db.meal_items.where('meal_id').equals(id).toArray();
    const foods = await this.db.foods.bulkGet(items.map((i) => i.food_id));
    const byId = new Map<string, Food>();
    for (const f of foods) if (f) byId.set(f.id, f);

    const resolved: MealItemWithFood[] = items.map((item) => ({
      ...item,
      food: byId.get(item.food_id),
    }));
    const totals: MacroTotals = resolved.reduce((acc, item) => {
      const f = item.food;
      if (!f) return acc;
      return {
        calories: acc.calories + f.calories * item.servings,
        protein: acc.protein + f.protein * item.servings,
        carbs: acc.carbs + f.carbs * item.servings,
        fat: acc.fat + f.fat * item.servings,
        fiber: acc.fiber + f.fiber * item.servings,
      };
    }, { ...ZERO_MACROS });

    return { meal, items: resolved, totals };
  }

  async createMeal(input: NewMealInput): Promise<Meal> {
    const ts = nowISO();
    const meal: Meal = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      name: input.name,
      notes: input.notes ?? '',
      created_at: ts,
      updated_at: ts,
    };
    await this.db.meals.add(meal);
    return meal;
  }

  async updateMeal(id: string, patch: NewMealInput): Promise<Meal> {
    const current = await this.db.meals.get(id);
    if (!current) throw new Error(`Meal ${id} not found`);
    const next: Meal = {
      ...current,
      name: patch.name,
      notes: patch.notes ?? current.notes,
      updated_at: nowISO(),
    };
    await this.db.meals.put(next);
    return next;
  }

  async deleteMeal(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.meals, this.db.meal_items, async () => {
      await this.db.meal_items.where('meal_id').equals(id).delete();
      await this.db.meals.delete(id);
    });
  }

  async addMealItem(mealId: string, foodId: string, servings: number): Promise<MealItem> {
    const ts = nowISO();
    const item: MealItem = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      meal_id: mealId,
      food_id: foodId,
      servings,
      created_at: ts,
      updated_at: ts,
    };
    await this.db.meal_items.add(item);
    return item;
  }

  async updateMealItem(id: string, servings: number): Promise<MealItem> {
    const current = await this.db.meal_items.get(id);
    if (!current) throw new Error(`Meal item ${id} not found`);
    const next: MealItem = { ...current, servings, updated_at: nowISO() };
    await this.db.meal_items.put(next);
    return next;
  }

  async removeMealItem(id: string): Promise<void> {
    await this.db.meal_items.delete(id);
  }

  // --- Nutrition: daily log --------------------------------------------------

  async getNutritionDay(date: DateString): Promise<NutritionDay> {
    const log = (await this.db.nutrition_logs.where('date').equals(date).first()) ?? null;
    const emptyByMeal = (): Record<MealType, FoodEntryWithFood[]> => ({
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    });

    if (!log) {
      return { date, log: null, entries: [], byMeal: emptyByMeal(), totals: { ...ZERO_MACROS } };
    }

    const entries = await this.db.food_entries.where('nutrition_log_id').equals(log.id).toArray();
    const foodIds = entries.map((e) => e.food_id).filter((id): id is string => id !== null);
    const foods = await this.db.foods.bulkGet([...new Set(foodIds)]);
    const byId = new Map<string, Food>();
    for (const f of foods) if (f) byId.set(f.id, f);

    const resolved: FoodEntryWithFood[] = entries.map((e) => ({
      ...e,
      food: e.food_id ? byId.get(e.food_id) : undefined,
    }));
    resolved.sort((a, b) => a.created_at.localeCompare(b.created_at));

    const byMeal = emptyByMeal();
    for (const entry of resolved) byMeal[entry.meal_type].push(entry);

    return { date, log, entries: resolved, byMeal, totals: sumEntries(resolved) };
  }

  /** Get-or-create the single nutrition log for a date. */
  private async ensureNutritionLog(date: DateString): Promise<NutritionLog> {
    const existing = await this.db.nutrition_logs.where('date').equals(date).first();
    if (existing) return existing;
    const ts = nowISO();
    const log: NutritionLog = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      date,
      created_at: ts,
      updated_at: ts,
    };
    await this.db.nutrition_logs.add(log);
    return log;
  }

  private buildFoodEntry(
    logId: string,
    food: Food,
    mealType: MealType,
    servings: number,
  ): FoodEntry {
    const ts = nowISO();
    return {
      id: newId(),
      user_id: LOCAL_USER_ID,
      nutrition_log_id: logId,
      food_id: food.id,
      meal_type: mealType,
      servings,
      // Snapshot per-serving macros at log time — editing the food later
      // never rewrites this entry.
      name_snapshot: food.name,
      calories_snapshot: food.calories,
      protein_snapshot: food.protein,
      carbs_snapshot: food.carbs,
      fat_snapshot: food.fat,
      fiber_snapshot: food.fiber,
      created_at: ts,
      updated_at: ts,
    };
  }

  async addFoodEntry(date: DateString, input: FoodEntryInput): Promise<FoodEntry> {
    const food = await this.db.foods.get(input.food_id);
    if (!food) throw new Error(`Food ${input.food_id} not found`);
    const log = await this.ensureNutritionLog(date);
    const entry = this.buildFoodEntry(log.id, food, input.meal_type, input.servings);
    await this.db.food_entries.add(entry);
    return entry;
  }

  async addMealToDay(date: DateString, mealId: string, mealType: MealType): Promise<FoodEntry[]> {
    const items = await this.db.meal_items.where('meal_id').equals(mealId).toArray();
    const log = await this.ensureNutritionLog(date);
    const entries: FoodEntry[] = [];
    for (const item of items) {
      const food = await this.db.foods.get(item.food_id);
      if (!food) continue;
      entries.push(this.buildFoodEntry(log.id, food, mealType, item.servings));
    }
    if (entries.length > 0) {
      await this.db.food_entries.bulkAdd(entries);
    }
    return entries;
  }

  async updateFoodEntry(id: string, patch: FoodEntryPatch): Promise<FoodEntry> {
    const current = await this.db.food_entries.get(id);
    if (!current) throw new Error(`Food entry ${id} not found`);
    const next: FoodEntry = {
      ...current,
      servings: patch.servings ?? current.servings,
      meal_type: patch.meal_type ?? current.meal_type,
      updated_at: nowISO(),
    };
    await this.db.food_entries.put(next);
    return next;
  }

  async removeFoodEntry(id: string): Promise<void> {
    await this.db.food_entries.delete(id);
  }

  // --- Bodyweight ------------------------------------------------------------

  async getBodyWeightEntries(): Promise<BodyWeightEntry[]> {
    const entries = await this.db.body_weight_entries.toArray();
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  async addBodyWeightEntry(input: NewBodyWeightInput): Promise<BodyWeightEntry> {
    // One weigh-in per day — upsert on date.
    const existing = await this.db.body_weight_entries.where('date').equals(input.date).first();
    if (existing) {
      return this.updateBodyWeightEntry(existing.id, input);
    }
    const ts = nowISO();
    const entry: BodyWeightEntry = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      date: input.date,
      weight: input.weight,
      note: input.note ?? '',
      created_at: ts,
      updated_at: ts,
    };
    await this.db.body_weight_entries.add(entry);
    return entry;
  }

  async updateBodyWeightEntry(
    id: string,
    patch: Partial<NewBodyWeightInput>,
  ): Promise<BodyWeightEntry> {
    const current = await this.db.body_weight_entries.get(id);
    if (!current) throw new Error(`Body weight entry ${id} not found`);
    const next: BodyWeightEntry = {
      ...current,
      date: patch.date ?? current.date,
      weight: patch.weight ?? current.weight,
      note: patch.note ?? current.note,
      updated_at: nowISO(),
    };
    await this.db.body_weight_entries.put(next);
    return next;
  }

  async deleteBodyWeightEntry(id: string): Promise<void> {
    await this.db.body_weight_entries.delete(id);
  }

  async getBodyWeightStats(): Promise<BodyWeightStats> {
    const entries = await this.getBodyWeightEntries();
    if (entries.length === 0) {
      return {
        current: null,
        start: null,
        change: null,
        avg7: null,
        avg30: null,
        high: null,
        low: null,
        count: 0,
      };
    }
    const points = entries.map((e) => ({ date: e.date, value: e.weight }));
    const weights = entries.map((e) => e.weight);
    const current = entries[entries.length - 1]!.weight;
    const start = entries[0]!.weight;
    const asOf = entries[entries.length - 1]!.date;
    return {
      current,
      start,
      change: current - start,
      avg7: averageWithinDays(points, 7, asOf),
      avg30: averageWithinDays(points, 30, asOf),
      high: Math.max(...weights),
      low: Math.min(...weights),
      count: entries.length,
    };
  }

  // --- Dashboard -------------------------------------------------------------

  async getDashboardData(): Promise<DashboardData> {
    const today = todayDateString();
    const [user, settings, entries, allWorkouts, routines, prRows] = await Promise.all([
      this.getCurrentUser(),
      this.getSettings(),
      this.getBodyWeightEntries(),
      this.db.workouts.toArray(),
      this.getRoutines(),
      this.db.personal_records.toArray(),
    ]);

    const completed = allWorkouts.filter((w) => w.completed_at !== null);
    const activeWorkout = (await this.getActiveWorkout()) ?? null;

    // Suggested routine: today's day-of-week match, else the first routine.
    const dow = new Date(`${today}T00:00:00`).getDay();
    const suggestedRoutine =
      routines.find((r) => r.day_of_week === dow) ?? routines[0] ?? null;

    // Today's macros.
    const todayTotals = (await this.getNutritionDay(today)).totals;

    // Bodyweight card.
    const bwPoints = entries.map((e) => ({ date: e.date, value: e.weight }));
    const latest = entries[entries.length - 1] ?? null;
    const bodyweight = {
      latest,
      changeFromStart: latest && entries[0] ? latest.weight - entries[0].weight : null,
      avg7: latest ? averageWithinDays(bwPoints, 7, latest.date) : null,
      sparkline: entries.slice(-14).map((e) => e.weight),
    };

    // Week: streak + count from completed-workout days.
    const workoutDays = completed
      .map((w) => (w.completed_at ?? w.started_at).slice(0, 10))
      .filter((d): d is string => !!d);
    const week = {
      workoutsThisWeek: countInLastDays(workoutDays, 7, today),
      streak: currentStreak(workoutDays, today),
    };

    // Weekly volume + per-day sparkline (last 7 days).
    const volumeByDay = new Map<string, number>();
    for (const w of completed) {
      const day = (w.completed_at ?? '').slice(0, 10);
      if (!day || dayDiff(today, day) < 0 || dayDiff(today, day) >= 7) continue;
      volumeByDay.set(day, (volumeByDay.get(day) ?? 0) + (await this.computeWorkoutVolume(w.id)));
    }
    const volumeSparkline: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      volumeSparkline.push(volumeByDay.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    const weeklyVolume = volumeSparkline.reduce((a, b) => a + b, 0);

    // Recent PRs (top 5) with names.
    const exerciseNames = new Map<string, string>();
    const sortedPRs = prRows
      .sort((a, b) => b.achieved_at.localeCompare(a.achieved_at))
      .slice(0, 5);
    for (const pr of sortedPRs) {
      if (!exerciseNames.has(pr.exercise_id)) {
        const ex = await this.db.exercises.get(pr.exercise_id);
        exerciseNames.set(pr.exercise_id, ex?.name ?? 'Exercise');
      }
    }
    const recentPRs: PersonalRecordView[] = sortedPRs.map((record) => ({
      record,
      exerciseName: exerciseNames.get(record.exercise_id) ?? 'Exercise',
    }));

    const readiness = await this.getReadiness();

    return {
      userName: user.name,
      settings,
      activeWorkout,
      suggestedRoutine,
      todayTotals,
      bodyweight,
      week,
      recentPRs,
      weeklyVolume,
      volumeSparkline,
      readiness,
    };
  }

  async getProgressStats(): Promise<ProgressStats> {
    const today = todayDateString();
    const [settings, allWorkouts] = await Promise.all([
      this.getSettings(),
      this.db.workouts.toArray(),
    ]);
    const completed = allWorkouts.filter((w) => w.completed_at !== null);
    const workoutDays = completed
      .map((w) => (w.completed_at ?? w.started_at).slice(0, 10))
      .filter((d): d is string => !!d);
    const daySet = new Set(workoutDays);

    const activityLast14: number[] = [];
    for (let i = 13; i >= 0; i--) {
      activityLast14.push(daySet.has(addDays(today, -i)) ? 1 : 0);
    }

    // Macro consistency over the last 7 days.
    let daysLogged = 0;
    let proteinMet = 0;
    let calorieMet = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, -i);
      const totals = (await this.getNutritionDay(date)).totals;
      if (totals.calories <= 0) continue;
      daysLogged += 1;
      if (settings.protein_target && totals.protein >= settings.protein_target) proteinMet += 1;
      if (
        settings.calorie_target &&
        Math.abs(totals.calories - settings.calorie_target) <= settings.calorie_target * 0.1
      ) {
        calorieMet += 1;
      }
    }

    return {
      currentStreak: currentStreak(workoutDays, today),
      longestStreak: longestStreak(workoutDays),
      workoutsThisWeek: countInLastDays(workoutDays, 7, today),
      totalWorkouts: completed.length,
      activityLast14,
      macroConsistency: { daysLogged, proteinMet, calorieMet },
    };
  }

  // --- Backup (export / import) ----------------------------------------------

  async exportData(): Promise<BackupFile> {
    const data: Record<string, unknown[]> = {};
    for (const store of STORE_NAMES) {
      data[store] = await this.db.table(store).toArray();
    }
    return buildBackup(data, nowISO());
  }

  async importData(backup: BackupFile): Promise<void> {
    // Wipe + restore atomically so a failed import can't leave a half state.
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const store of STORE_NAMES) {
        const table = this.db.table(store);
        await table.clear();
        const rows = backup.data[store] ?? [];
        if (rows.length > 0) {
          await table.bulkAdd(rows);
        }
      }
    });
  }

  // --- Phase 7: should-haves -------------------------------------------------

  async getReadiness(): Promise<ReadinessResult> {
    const today = todayDateString();
    const completed = (await this.db.workouts.toArray())
      .filter((w) => w.completed_at !== null)
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

    const workoutDays = completed.map((w) => (w.completed_at ?? '').slice(0, 10));

    // Volume of the last 6 sessions → recent (0-2) vs prior (3-5) averages.
    const volumes: number[] = [];
    for (const w of completed.slice(0, 6)) volumes.push(await this.computeWorkoutVolume(w.id));
    const avg = (arr: number[]) =>
      arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
    const recentVolumeAvg = avg(volumes.slice(0, 3));
    const priorVolumeAvg = avg(volumes.slice(3, 6));

    // Muscles trained on each of the two most recent training days.
    const musclesByDay = new Map<string, Set<string>>();
    for (const w of completed) {
      const day = (w.completed_at ?? '').slice(0, 10);
      const set = musclesByDay.get(day) ?? new Set<string>();
      const wex = await this.db.workout_exercises.where('workout_id').equals(w.id).toArray();
      const exercises = await this.db.exercises.bulkGet(wex.map((r) => r.exercise_id));
      for (const ex of exercises) if (ex) set.add(ex.primary_muscle_group_id);
      musclesByDay.set(day, set);
    }
    const days = [...musclesByDay.keys()].sort((a, b) => b.localeCompare(a));
    let backToBackMuscles: string[] = [];
    if (days.length >= 2 && dayDiff(days[0]!, days[1]!) === 1) {
      const a = musclesByDay.get(days[0]!)!;
      const b = musclesByDay.get(days[1]!)!;
      const shared = [...a].filter((m) => b.has(m));
      if (shared.length > 0) {
        const groups = await this.db.muscle_groups.bulkGet(shared);
        backToBackMuscles = groups.filter((g): g is NonNullable<typeof g> => !!g).map((g) => g.name);
      }
    }

    return computeReadiness({
      consecutiveTrainingDays: currentStreak(workoutDays, today),
      backToBackMuscles,
      recentVolumeAvg,
      priorVolumeAvg,
    });
  }

  async getMuscleHeatmap(): Promise<MuscleHeatmapCell[]> {
    const today = todayDateString();
    const completed = (await this.db.workouts.toArray()).filter(
      (w) => w.completed_at !== null && dayDiff(today, (w.completed_at ?? '').slice(0, 10)) < 7,
    );

    interface Contribution {
      volume: number;
      primaryMuscleId: string;
      secondaryMuscleIds: string[];
    }
    const contributions: Contribution[] = [];
    // Per-muscle exercise breakdown (by primary attribution).
    const exerciseVol = new Map<string, Map<string, number>>();

    for (const w of completed) {
      const wex = await this.db.workout_exercises.where('workout_id').equals(w.id).toArray();
      for (const row of wex) {
        const exercise = await this.db.exercises.get(row.exercise_id);
        if (!exercise) continue;
        const sets = await this.db.sets.where('workout_exercise_id').equals(row.id).toArray();
        let vol = 0;
        for (const s of sets) if (!s.is_warmup && s.is_completed) vol += s.weight * s.reps;
        if (vol <= 0) continue;
        contributions.push({
          volume: vol,
          primaryMuscleId: exercise.primary_muscle_group_id,
          secondaryMuscleIds: exercise.secondary_muscle_group_ids,
        });
        const perMuscle = exerciseVol.get(exercise.primary_muscle_group_id) ?? new Map();
        perMuscle.set(exercise.name, (perMuscle.get(exercise.name) ?? 0) + vol);
        exerciseVol.set(exercise.primary_muscle_group_id, perMuscle);
      }
    }

    const totals = aggregateMuscleVolume(contributions);
    const intensities = normalizeIntensities(totals);
    const groups = await this.db.muscle_groups.toArray();

    return groups
      .map((g) => ({
        muscleGroupId: g.id,
        name: g.name,
        volume: Math.round(totals[g.id] ?? 0),
        intensity: intensities[g.id] ?? 0,
        exercises: [...(exerciseVol.get(g.id)?.entries() ?? [])]
          .map(([name, volume]) => ({ name, volume: Math.round(volume) }))
          .sort((a, b) => b.volume - a.volume),
      }))
      .sort((a, b) => b.volume - a.volume);
  }

  async getProgressionSuggestion(exerciseId: string, targetReps = 8): Promise<AutoRegResult> {
    const settings = await this.getSettings();
    const rows = await this.db.workout_exercises.where('exercise_id').equals(exerciseId).toArray();

    // Group by workout; keep only completed workouts, most recent first.
    const byWorkout = new Map<string, string[]>();
    for (const row of rows) {
      const list = byWorkout.get(row.workout_id) ?? [];
      list.push(row.id);
      byWorkout.set(row.workout_id, list);
    }
    const workouts = (await this.db.workouts.bulkGet([...byWorkout.keys()]))
      .filter((w): w is NonNullable<typeof w> => !!w && w.completed_at !== null)
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
      .slice(0, 2);

    const sessions: RpeSet[][] = [];
    for (const w of workouts) {
      const setLists = await Promise.all(
        (byWorkout.get(w.id) ?? []).map((rowId) =>
          this.db.sets.where('workout_exercise_id').equals(rowId).toArray(),
        ),
      );
      const sets = setLists.flat().map((s) => ({
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        is_warmup: s.is_warmup,
        is_completed: s.is_completed,
      }));
      sessions.push(sets);
    }

    return suggestProgression(sessions, targetReps, settings.units);
  }

  async getLastRestSeconds(exerciseId: string): Promise<number | null> {
    const rows = await this.db.workout_exercises.where('exercise_id').equals(exerciseId).toArray();
    let latest: { rest: number; loggedAt: string } | null = null;
    for (const row of rows) {
      const sets = await this.db.sets.where('workout_exercise_id').equals(row.id).toArray();
      for (const s of sets) {
        if (s.rest_seconds !== null && (!latest || s.logged_at > latest.loggedAt)) {
          latest = { rest: s.rest_seconds, loggedAt: s.logged_at };
        }
      }
    }
    return latest?.rest ?? null;
  }
}

/** Base fields the repository manages; callers never pass these in patches. */
type BaseFields = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};
