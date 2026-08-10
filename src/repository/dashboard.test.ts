import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId, todayDateString } from '../lib/id';
import { addDays } from '../lib/dates';

describe('IndexedDBRepository — bodyweight & dashboard', () => {
  let db: FitnessDB;
  let repo: IndexedDBRepository;

  beforeEach(async () => {
    db = new FitnessDB(`test-${newId()}`);
    await db.open();
    repo = new IndexedDBRepository(db);
    await repo.seed();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('upserts one bodyweight entry per day and computes stats', async () => {
    await repo.addBodyWeightEntry({ date: '2026-08-01', weight: 200 });
    await repo.addBodyWeightEntry({ date: '2026-08-05', weight: 198 });
    // Same date again → upsert, not a duplicate.
    await repo.addBodyWeightEntry({ date: '2026-08-05', weight: 197 });

    const entries = await repo.getBodyWeightEntries();
    expect(entries).toHaveLength(2);

    const stats = await repo.getBodyWeightStats();
    expect(stats.start).toBe(200);
    expect(stats.current).toBe(197);
    expect(stats.change).toBe(-3);
    expect(stats.high).toBe(200);
    expect(stats.low).toBe(197);
    expect(stats.count).toBe(2);
  });

  it('assembles dashboard data from seeded + logged data', async () => {
    const today = todayDateString();
    await repo.addBodyWeightEntry({ date: addDays(today, -1), weight: 180 });
    await repo.addBodyWeightEntry({ date: today, weight: 179 });

    // A completed workout today → counts toward the week + streak + volume.
    const workout = await repo.startWorkout({ name: 'Push' });
    const wex = await repo.addWorkoutExercise(workout.id, 'ex-barbell-bench-press');
    const set = await repo.addSet(wex.id, { weight: 185, reps: 10 });
    await repo.updateSet(set.id, { is_completed: true });
    await repo.completeWorkout(workout.id);

    const dash = await repo.getDashboardData();
    expect(dash.userName).toBe('Me');
    expect(dash.bodyweight.latest?.weight).toBe(179);
    expect(dash.bodyweight.changeFromStart).toBe(-1);
    expect(dash.week.workoutsThisWeek).toBe(1);
    expect(dash.week.streak).toBe(1);
    expect(dash.weeklyVolume).toBe(1850);
    expect(dash.volumeSparkline).toHaveLength(7);
    expect(dash.volumeSparkline[6]).toBe(1850); // today is the last bucket
    expect(dash.recentPRs.length).toBeGreaterThan(0);
    expect(dash.recentPRs[0]?.exerciseName).toBe('Barbell Bench Press');
  });

  it('dashboard is well-formed on a brand-new (empty) database', async () => {
    const dash = await repo.getDashboardData();
    expect(dash.bodyweight.latest).toBeNull();
    expect(dash.week.streak).toBe(0);
    expect(dash.weeklyVolume).toBe(0);
    expect(dash.recentPRs).toEqual([]);
    expect(dash.todayTotals.calories).toBe(0);
  });
});
