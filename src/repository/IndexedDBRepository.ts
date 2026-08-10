import { FitnessDB, db as sharedDb } from '../db/database';
import { seedDatabase, SETTINGS_ID } from '../db/seed';
import { newId, nowISO } from '../lib/id';
import { LOCAL_USER_ID, type Exercise, type MuscleGroup, type Settings, type User } from '../types';
import type { NewExerciseInput, Repository } from './Repository';

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
}

/** Base fields the repository manages; callers never pass these in patches. */
type BaseFields = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};
