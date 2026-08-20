import { FitnessDB } from './database';
import { EXERCISE_SEED, MUSCLE_GROUP_SEED, ROUTINE_SEED } from './seedData';
import {
  LOCAL_USER_ID,
  type Exercise,
  type MuscleGroup,
  type Routine,
  type RoutineExercise,
  type Settings,
  type User,
} from '../types';
import { nowISO } from '../lib/id';

/** Stable id for the settings singleton row. */
export const SETTINGS_ID = 'settings-local-user';

const DEFAULT_SETTINGS: Omit<Settings, 'created_at' | 'updated_at'> = {
  id: SETTINGS_ID,
  user_id: LOCAL_USER_ID,
  units: 'lbs',
  height: null,
  age: null,
  sex: 'unspecified',
  calorie_target: 2200,
  protein_target: 160,
  carb_target: 220,
  fat_target: 70,
  fiber_target: 30,
  default_rest_seconds: 120,
  theme: 'dark',
  goal: 'general',
  load_always_green: true,
  beat_comparison_enabled: true,
  beat_lookback_weeks: 3,
  starter_routines_seeded: false,
};

/**
 * Idempotently seed the database: `local-user`, default settings, the 11
 * muscle groups, and the system exercise library. Safe to call on every
 * launch — existing rows are left untouched, only missing ones are added.
 */
export async function seedDatabase(database: FitnessDB): Promise<void> {
  const ts = nowISO();

  await database.transaction(
    'rw',
    [
      database.users,
      database.settings,
      database.muscle_groups,
      database.exercises,
      database.routines,
      database.routine_exercises,
    ],
    async () => {
      // User
      const existingUser = await database.users.get(LOCAL_USER_ID);
      if (!existingUser) {
        const user: User = {
          id: LOCAL_USER_ID,
          user_id: LOCAL_USER_ID,
          name: 'Me',
          created_at: ts,
          updated_at: ts,
        };
        await database.users.add(user);
      }

      // Settings
      const existingSettings = await database.settings.get(SETTINGS_ID);
      if (!existingSettings) {
        const settings: Settings = {
          ...DEFAULT_SETTINGS,
          created_at: ts,
          updated_at: ts,
        };
        await database.settings.add(settings);
      }

      // Muscle groups
      const existingGroupIds = new Set((await database.muscle_groups.toArray()).map((g) => g.id));
      const groupsToAdd: MuscleGroup[] = MUSCLE_GROUP_SEED.filter(
        (g) => !existingGroupIds.has(g.id),
      ).map((g) => ({
        id: g.id,
        name: g.name,
        created_at: ts,
        updated_at: ts,
      }));
      if (groupsToAdd.length > 0) {
        await database.muscle_groups.bulkAdd(groupsToAdd);
      }

      // System exercises
      const existingExerciseIds = new Set((await database.exercises.toArray()).map((e) => e.id));
      const exercisesToAdd: Exercise[] = EXERCISE_SEED.filter(
        (e) => !existingExerciseIds.has(e.id),
      ).map((e) => ({
        id: e.id,
        user_id: LOCAL_USER_ID,
        name: e.name,
        primary_muscle_group_id: e.primary,
        secondary_muscle_group_ids: e.secondary ?? [],
        equipment: e.equipment,
        movement_type: e.movement_type,
        is_compound: e.is_compound,
        instructions: '',
        is_custom: false,
        is_archived: false,
        created_at: ts,
        updated_at: ts,
      }));
      if (exercisesToAdd.length > 0) {
        await database.exercises.bulkAdd(exercisesToAdd);
      }

      // Starter routine templates — seeded exactly once (guarded by a flag on
      // settings), so deleting them later doesn't cause them to reappear.
      const settingsRow = await database.settings.get(SETTINGS_ID);
      if (settingsRow && !settingsRow.starter_routines_seeded) {
        const existingRoutineIds = new Set((await database.routines.toArray()).map((r) => r.id));
        let sortOrder = (await database.routines.toArray()).reduce(
          (max, r) => Math.max(max, r.sort_order + 1),
          0,
        );
        const routinesToAdd: Routine[] = [];
        const routineExercisesToAdd: RoutineExercise[] = [];
        for (const seed of ROUTINE_SEED) {
          if (existingRoutineIds.has(seed.id)) continue;
          routinesToAdd.push({
            id: seed.id,
            user_id: LOCAL_USER_ID,
            name: seed.name,
            notes: seed.notes ?? '',
            day_of_week: seed.day_of_week ?? null,
            sort_order: sortOrder++,
            created_at: ts,
            updated_at: ts,
          });
          seed.exercises.forEach((ex, index) => {
            routineExercisesToAdd.push({
              id: `${seed.id}-re-${index}`,
              user_id: LOCAL_USER_ID,
              routine_id: seed.id,
              exercise_id: ex.exercise_id,
              sort_order: index,
              target_sets: ex.sets,
              target_reps_low: ex.low,
              target_reps_high: ex.high,
              notes: '',
              created_at: ts,
              updated_at: ts,
            });
          });
        }
        if (routinesToAdd.length > 0) {
          await database.routines.bulkAdd(routinesToAdd);
          await database.routine_exercises.bulkAdd(routineExercisesToAdd);
        }
        await database.settings.put({
          ...settingsRow,
          starter_routines_seeded: true,
          updated_at: ts,
        });
      }
    },
  );
}
