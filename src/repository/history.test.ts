import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitnessDB } from '../db/database';
import { IndexedDBRepository } from './IndexedDBRepository';
import { newId } from '../lib/id';
import type { WorkoutIntent } from '../types';

/** Phase 3: PR detection on completion, history aggregates, and summary. */
describe('IndexedDBRepository — history, PRs & summary', () => {
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

  async function logSession(
    exerciseId: string,
    sets: { weight: number; reps: number; warmup?: boolean }[],
    intent: WorkoutIntent = 'normal',
  ) {
    const workout = await repo.startWorkout({ name: 'Session', intent });
    const wex = await repo.addWorkoutExercise(workout.id, exerciseId);
    for (const s of sets) {
      const set = await repo.addSet(wex.id, { weight: s.weight, reps: s.reps, is_warmup: s.warmup });
      await repo.updateSet(set.id, { is_completed: true });
    }
    await repo.completeWorkout(workout.id);
    return workout;
  }

  it('detects PRs on first completion and records previous_value on the next', async () => {
    await logSession('ex-barbell-bench-press', [{ weight: 185, reps: 8 }]);
    let prs = await repo.getPersonalRecords({ exerciseId: 'ex-barbell-bench-press' });
    // All five PR types set on the first session.
    expect(new Set(prs.map((p) => p.pr_type)).size).toBe(5);
    expect(prs.every((p) => p.previous_value === null)).toBe(true);

    // Heavier session → new heaviest_weight PR carrying the previous value.
    await logSession('ex-barbell-bench-press', [{ weight: 195, reps: 8 }]);
    prs = await repo.getPersonalRecords({ exerciseId: 'ex-barbell-bench-press' });
    const heaviest = prs
      .filter((p) => p.pr_type === 'heaviest_weight')
      .sort((a, b) => b.achieved_at.localeCompare(a.achieved_at))[0];
    expect(heaviest?.value).toBe(195);
    expect(heaviest?.previous_value).toBe(185);
  });

  it('excludes warm-ups from PRs', async () => {
    await logSession('ex-back-squat', [
      { weight: 500, reps: 1, warmup: true }, // absurd warm-up, must be ignored
      { weight: 225, reps: 5 },
    ]);
    const prs = await repo.getPersonalRecords({ exerciseId: 'ex-back-squat' });
    const heaviest = prs.find((p) => p.pr_type === 'heaviest_weight');
    expect(heaviest?.value).toBe(225);
  });

  it('builds exercise history with lifetime bests', async () => {
    await logSession('ex-deadlift', [{ weight: 315, reps: 5 }]);
    await logSession('ex-deadlift', [{ weight: 335, reps: 3 }]);

    const history = await repo.getExerciseHistory('ex-deadlift');
    expect(history?.sessions).toHaveLength(2);
    expect(history?.bestWeight).toBe(335);
    expect(history?.lifetimeVolume).toBe(315 * 5 + 335 * 3);
    // Most recent session first.
    expect(history?.sessions[0]?.topWeight).toBe(335);
  });

  it('summary computes vs-last volume and lists new PRs', async () => {
    const routine = await repo.createRoutine({ name: 'Pull' });
    await repo.addRoutineExercise(routine.id, 'ex-barbell-row');

    // Session 1: baseline volume 100×10 = 1000.
    const w1 = await repo.startWorkout({ name: 'Pull', routine_id: routine.id });
    const r1 = await repo.getWorkoutDetail(w1.id);
    const s1 = await repo.addSet(r1!.exercises[0]!.id, { weight: 100, reps: 10 });
    await repo.updateSet(s1.id, { is_completed: true });
    await repo.completeWorkout(w1.id);

    // Session 2: volume 110×10 = 1100 → +10%.
    const w2 = await repo.startWorkout({ name: 'Pull', routine_id: routine.id });
    const r2 = await repo.getWorkoutDetail(w2.id);
    const s2 = await repo.addSet(r2!.exercises[0]!.id, { weight: 110, reps: 10 });
    await repo.updateSet(s2.id, { is_completed: true });
    await repo.completeWorkout(w2.id);

    const summary = await repo.getWorkoutSummary(w2.id);
    expect(summary?.totalVolume).toBe(1100);
    expect(summary?.workingSetCount).toBe(1);
    expect(summary?.vsLast.tone).toBe('up');
    expect(summary?.vsLast.percent).toBeCloseTo(10, 5);
    // Heavier + more volume than session 1 → new PRs recorded this session.
    expect(summary?.newPRs.length).toBeGreaterThan(0);
  });

  it('deload session summary reads as intentional, not a shortfall', async () => {
    const routine = await repo.createRoutine({ name: 'Legs' });
    await repo.addRoutineExercise(routine.id, 'ex-leg-press');

    const w1 = await repo.startWorkout({ name: 'Legs', routine_id: routine.id });
    const d1 = await repo.getWorkoutDetail(w1.id);
    const a = await repo.addSet(d1!.exercises[0]!.id, { weight: 300, reps: 10 });
    await repo.updateSet(a.id, { is_completed: true });
    await repo.completeWorkout(w1.id);

    const w2 = await repo.startWorkout({ name: 'Legs', routine_id: routine.id, intent: 'deload' });
    const d2 = await repo.getWorkoutDetail(w2.id);
    const b = await repo.addSet(d2!.exercises[0]!.id, { weight: 150, reps: 10 });
    await repo.updateSet(b.id, { is_completed: true });
    await repo.completeWorkout(w2.id);

    const summary = await repo.getWorkoutSummary(w2.id);
    expect(summary?.vsLast.tone).toBe('deload');
    expect(summary?.vsLast.label).toBe('Deload — volume intentionally reduced');
  });
});
