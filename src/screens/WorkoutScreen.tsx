import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, EmptyState, Spinner } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { dayLabel } from '../lib/labels';
import type { Routine } from '../types';

interface RoutineRow {
  routine: Routine;
  count: number;
}

export function WorkoutScreen() {
  const repository = useRepository();
  const navigate = useNavigate();

  const state = useAsync<RoutineRow[]>(async () => {
    const routines = await repository.getRoutines();
    const details = await Promise.all(routines.map((r) => repository.getRoutineDetail(r.id)));
    return routines.map((routine, i) => ({
      routine,
      count: details[i]?.items.length ?? 0,
    }));
  }, []);

  async function createAndEdit() {
    const routine = await repository.createRoutine({ name: 'New Routine' });
    navigate(`/workout/routines/${routine.id}`);
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

  return (
    <>
      <ScreenHeader
        title="Routines"
        subtitle="Your training splits"
        action={
          <Button variant="primary" onClick={createAndEdit}>
            + New
          </Button>
        }
      />

      {state.loading ? (
        <Spinner />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon="📋"
          title="No routines yet"
          note="Create a routine to plan your sets, reps, and exercise order. Workout Mode arrives in the next phase."
        />
      ) : (
        <ul className="space-y-3 p-4">
          {state.data?.map(({ routine, count }) => (
            <li
              key={routine.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <button
                onClick={() => navigate(`/workout/routines/${routine.id}`)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{routine.name}</span>
                  <span className="text-xs text-slate-500">{dayLabel(routine.day_of_week)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {count} {count === 1 ? 'exercise' : 'exercises'}
                  {routine.notes ? ` · ${routine.notes}` : ''}
                </div>
              </button>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => navigate(`/workout/routines/${routine.id}`)}>
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
    </>
  );
}
