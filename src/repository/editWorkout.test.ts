import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId } from '../lib/id';

/**
 * Editing a past workout: PRs are historical, so lowering or adding a set on a
 * completed session must rebuild the personal-records cache, and moving a
 * workout's date must re-bucket it (and reorder PR chronology).
 */
describe('IndexedDBRepository — editing past workouts', () => {
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

  async function completedSet(weight: number, reps: number, name = 'Bench') {
    const w = await repo.startWorkout({ name });
    const wex = await repo.addWorkoutExercise(w.id, 'ex-barbell-bench-press');
    const s = await repo.addSet(wex.id, { weight, reps });
    await repo.updateSet(s.id, { is_completed: true });
    await repo.completeWorkout(w.id);
    return { workout: w, wex, setId: s.id };
  }

  it('recompute drops a PR when the set that earned it is lowered', async () => {
    const { setId } = await completedSet(225, 5); // heaviest_weight PR = 225

    expect(
      (await repo.getPersonalRecords({ exerciseId: 'ex-barbell-bench-press' })).some(
        (pr) => pr.pr_type === 'heaviest_weight' && pr.value === 225,
      ),
    ).toBe(true);

    // Correct a fat-fingered entry: it was really 185.
    await repo.updateSet(setId, { weight: 185 });
    await repo.recomputePersonalRecords();

    const prs = await repo.getPersonalRecords({ exerciseId: 'ex-barbell-bench-press' });
    const heaviest = prs.find((pr) => pr.pr_type === 'heaviest_weight');
    expect(heaviest?.value).toBe(185);
    expect(prs.some((pr) => pr.value === 225)).toBe(false);
  });

  it('recompute is deterministic and idempotent for unchanged data', async () => {
    await completedSet(135, 8);
    await completedSet(155, 6);

    const before = (await repo.getPersonalRecords()).map((pr) => `${pr.pr_type}:${pr.value}`).sort();
    await repo.recomputePersonalRecords();
    const after = (await repo.getPersonalRecords()).map((pr) => `${pr.pr_type}:${pr.value}`).sort();
    expect(after).toEqual(before);
  });

  it('adding a completed set on a past workout can earn a new PR after recompute', async () => {
    const { wex } = await completedSet(135, 8);
    const extra = await repo.addSet(wex.id, { weight: 205, reps: 3 });
    await repo.updateSet(extra.id, { is_completed: true });
    await repo.recomputePersonalRecords();

    const prs = await repo.getPersonalRecords({ exerciseId: 'ex-barbell-bench-press' });
    expect(prs.find((pr) => pr.pr_type === 'heaviest_weight')?.value).toBe(205);
  });

  it('updateWorkoutDate moves the workout to a new calendar day', async () => {
    const { workout } = await completedSet(135, 8);
    const moved = await repo.updateWorkoutDate(workout.id, '2020-01-15');
    expect(moved.completed_at?.slice(0, 10)).toBe('2020-01-15');
    expect(moved.started_at.slice(0, 10)).toBe('2020-01-15');

    const reread = await repo.getWorkout(workout.id);
    expect(reread?.completed_at?.slice(0, 10)).toBe('2020-01-15');
  });

  it('recompute re-dates PR achieved_at when a workout is moved earlier', async () => {
    // Two sessions, second is the heavier one and currently holds the PR "now".
    await completedSet(135, 5);
    const { workout: heavy } = await completedSet(185, 5);

    // Move the heavy session far into the past.
    await repo.updateWorkoutDate(heavy.id, '2019-06-01');
    await repo.recomputePersonalRecords();

    const heaviest = (await repo.getPersonalRecords({ exerciseId: 'ex-barbell-bench-press' })).find(
      (pr) => pr.pr_type === 'heaviest_weight' && pr.value === 185,
    );
    expect(heaviest?.achieved_at.slice(0, 10)).toBe('2019-06-01');
  });
});
