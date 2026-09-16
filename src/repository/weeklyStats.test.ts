import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId, todayDateString } from '../lib/id';
import { addDays, startOfWeek } from '../lib/dates';

/**
 * Phase 1 of the friends-leaderboard plan (docs/leaderboard-plan.md): the
 * backend-free weekly stats. Computed from local data only — no network.
 */
describe('IndexedDBRepository — getWeeklyStats', () => {
  let db: FitnessDB;
  let repo: IndexedDBRepository;

  const today = todayDateString();
  const weekStart = startOfWeek(today);
  const lastWeek = addDays(weekStart, -1); // Sunday of the previous week

  beforeEach(async () => {
    db = new FitnessDB(`test-${newId()}`);
    await db.open();
    repo = new IndexedDBRepository(db);
    await repo.seed();
  });

  afterEach(async () => {
    await db.delete();
  });

  /** Log a completed workout with one working set, dated to `date`. */
  async function logOn(date: string, weight: number, reps: number) {
    const w = await repo.startWorkout({ name: 'Session' });
    const wex = await repo.addWorkoutExercise(w.id, 'ex-barbell-bench-press');
    const s = await repo.addSet(wex.id, { weight, reps });
    await repo.updateSet(s.id, { is_completed: true });
    await repo.completeWorkout(w.id);
    await repo.updateWorkoutDate(w.id, date);
    return w;
  }

  it('is all zeros on an empty log, keyed to this week', async () => {
    const stats = await repo.getWeeklyStats();
    expect(stats).toEqual({
      weekStart,
      weekVolume: 0,
      daysTrained: 0,
      streak: 0,
      totalWorkouts: 0,
    });
  });

  it('sums this-week volume and excludes prior weeks', async () => {
    await logOn(weekStart, 100, 10); // this week: 1000
    await logOn(today, 60, 5); // this week: 300
    await logOn(lastWeek, 200, 2); // last week: excluded from weekly totals

    const stats = await repo.getWeeklyStats();
    expect(stats.weekVolume).toBe(1300); // 1000 + 300, not the 400 from last week
    expect(stats.totalWorkouts).toBe(3); // all-time counts every completed session
    // Distinct training days this week — robust to whether today is Monday.
    expect(stats.daysTrained).toBe(new Set([weekStart, today]).size);
    expect(stats.streak).toBeGreaterThanOrEqual(1); // trained today
  });

  it('counts two sessions on the same day as one training day', async () => {
    await logOn(today, 100, 5);
    await logOn(today, 100, 5);

    const stats = await repo.getWeeklyStats();
    expect(stats.daysTrained).toBe(1);
    expect(stats.weekVolume).toBe(1000); // both sessions still add to volume
    expect(stats.totalWorkouts).toBe(2);
  });
});
