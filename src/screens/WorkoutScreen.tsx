import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, EmptyState, ErrorState, Spinner } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { dayLabel } from '../lib/labels';
import type { Routine, Workout } from '../types';

interface RoutineRow {
  routine: Routine;
  count: number;
}

interface WorkoutTabData {
  routines: RoutineRow[];
  active: Workout | undefined;
}

export function WorkoutScreen() {
  const repository = useRepository();
  const navigate = useNavigate();

  const state = useAsync<WorkoutTabData>(async () => {
    const [routines, active] = await Promise.all([
      repository.getRoutines(),
      repository.getActiveWorkout(),
    ]);
    const details = await Promise.all(routines.map((r) => repository.getRoutineDetail(r.id)));
    return {
      routines: routines.map((routine, i) => ({ routine, count: details[i]?.items.length ?? 0 })),
      active,
    };
  }, []);

  async function createAndEdit() {
    const routine = await repository.createRoutine({ name: 'New Routine' });
    navigate(`/workout/routines/${routine.id}`);
  }

  async function startFromRoutine(routine: Routine) {
    const workout = await repository.startWorkout({
      name: routine.name,
      routine_id: routine.id,
    });
    navigate(`/session/${workout.id}`);
  }

  async function startEmpty() {
    const workout = await repository.startWorkout({ name: 'Empty Workout' });
    navigate(`/session/${workout.id}`);
  }

  async function duplicate(id: string) {
    await repository.duplicateRoutine(id);
    state.reload();
  }

  async function remove(id: string) {
    if (!confirm('Delete this routine? This cannot be undone.')) return;
    await repository.deleteRoutine(id);
    state.reload();
  }

  const active = state.data?.active;

  return (
    <>
      <ScreenHeader
        title="Workout"
        subtitle="Your training splits"
        action={
          <Button variant="secondary" onClick={createAndEdit}>
            + Routine
          </Button>
        }
      />

      <div className="space-y-4 p-4">
        {active && (
          <button
            onClick={() => navigate(`/session/${active.id}`)}
            className="flex w-full items-center justify-between rounded-2xl border border-beat/40 bg-beat/10 p-4 text-left"
          >
            <div>
              <div className="font-semibold text-beat">Resume workout</div>
              <div className="text-sm text-slate-300">{active.name} · in progress</div>
            </div>
            <span className="text-beat">→</span>
          </button>
        )}

        <Button variant="primary" className="w-full" onClick={startEmpty}>
          Start empty workout
        </Button>

        {state.error ? (
          <ErrorState error={state.error} onRetry={state.reload} />
        ) : state.loading ? (
          <Spinner />
        ) : (state.data?.routines.length ?? 0) === 0 ? (
          <EmptyState
            icon="📋"
            title="No routines yet"
            note="Create a routine to plan your sets, reps, and exercise order — then start it in one tap."
          />
        ) : (
          <ul className="space-y-3">
            {state.data?.routines.map(({ routine, count }) => (
              <li key={routine.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{routine.name}</span>
                  <span className="text-xs text-slate-500">{dayLabel(routine.day_of_week)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {count} {count === 1 ? 'exercise' : 'exercises'}
                  {routine.notes ? ` · ${routine.notes}` : ''}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={() => startFromRoutine(routine)}
                    disabled={count === 0}
                  >
                    Start
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/workout/routines/${routine.id}`)}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => duplicate(routine.id)}>
                    Duplicate
                  </Button>
                  <Button variant="danger" className="ml-auto" onClick={() => remove(routine.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
