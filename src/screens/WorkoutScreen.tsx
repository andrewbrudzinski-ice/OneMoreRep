import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
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
    const workout = await repository.startWorkout({ name: routine.name, routine_id: routine.id });
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
  const routines = state.data?.routines ?? [];

  return (
    <>
      <ScreenHeader
        kicker="Your training splits"
        title="Workout"
        action={
          <button
            onClick={createAndEdit}
            className="flex items-center gap-1.5 border border-white/[0.18] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink transition-colors hover:border-white/[0.34] hover:bg-surface"
          >
            <Plus className="h-[13px] w-[13px]" />
            Routine
          </button>
        }
      />

      {/* Resume banner — flat, accent left border. */}
      {active && (
        <button
          onClick={() => navigate(`/session/${active.id}`)}
          className="flex w-full items-center justify-between border-b border-white/[0.08] border-l-2 border-l-accent bg-surface px-5 py-[15px] text-left"
        >
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
              Resume workout
            </div>
            <div className="mt-0.5 text-[14px] font-extrabold text-ink">
              {active.name} · in progress
            </div>
          </div>
          <ArrowRight className="h-[18px] w-[18px] text-accent" />
        </button>
      )}

      {/* Start empty workout — the promoted primary CTA. */}
      <button
        onClick={startEmpty}
        className="flex w-full items-center justify-between border-b-2 border-white/[0.15] bg-accent px-5 py-[19px] text-left text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-press"
      >
        <span className="text-[12px] font-extrabold uppercase tracking-[0.1em]">
          Start empty workout
        </span>
        <ArrowRight className="h-[19px] w-[19px]" />
      </button>

      <div className="px-5 pb-1 pt-[18px]">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
          Routines
        </span>
      </div>

      {state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : state.loading ? (
        <Spinner />
      ) : routines.length === 0 ? (
        <EmptyState
          title="No routines yet"
          note="Create a routine to plan your sets, reps, and exercise order — then start it in one tap."
        />
      ) : (
        <ul>
          {routines.map(({ routine, count }) => (
            <li
              key={routine.id}
              className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/[0.08] px-5 py-[15px]"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[16px] font-extrabold tracking-[-0.015em] text-ink">
                    {routine.name}
                  </span>
                  <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.13em] text-ink4">
                    {dayLabel(routine.day_of_week)}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-ink2">
                  {count} {count === 1 ? 'exercise' : 'exercises'}
                  {routine.notes ? ` · ${routine.notes}` : ''}
                </div>
                <div className="mt-2 flex gap-4">
                  <TextButton onClick={() => navigate(`/workout/routines/${routine.id}`)}>
                    Edit
                  </TextButton>
                  <TextButton onClick={() => duplicate(routine.id)}>Duplicate</TextButton>
                  <TextButton onClick={() => remove(routine.id)} danger>
                    Delete
                  </TextButton>
                </div>
              </div>
              <button
                onClick={() => startFromRoutine(routine)}
                disabled={count === 0}
                className="self-start border border-accent px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent"
              >
                Start
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TextButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[9.5px] font-extrabold uppercase tracking-[0.13em] transition-colors ${
        danger ? 'text-ink4 hover:text-fatigued' : 'text-ink2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
