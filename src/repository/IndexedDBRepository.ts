import { FitnessDB, db as sharedDb } from '../db/database';
import { seedDatabase, SETTINGS_ID } from '../db/seed';
import { newId, nowISO } from '../lib/id';
import {
  LOCAL_USER_ID,
  type Exercise,
  type MuscleGroup,
  type Routine,
  type RoutineExercise,
  type Settings,
  type User,
} from '../types';
import type {
  NewExerciseInput,
  NewRoutineInput,
  Repository,
  RoutineDetail,
  RoutineExerciseInput,
  RoutineExerciseWithExercise,
} from './Repository';

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
}

/** Base fields the repository manages; callers never pass these in patches. */
type BaseFields = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};
