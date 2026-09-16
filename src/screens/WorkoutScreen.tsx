import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { EmptyState, ErrorState, Spinner, Modal, Button } from '../components/ui';
import { ArrowRight, Panel, PrimaryAction, SectionHeader, SectionLabel } from '../components/primitives';
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
  const [logPastOpen, setLogPastOpen] = useState(false);
  const [pastDate, setPastDate] = useState('');
  const [pastName, setPastName] = useState('');

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

  function openLogPast() {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    setPastDate(yesterday);
    setPastName('');
    setLogPastOpen(true);
  }

  async function startPastWorkout() {
    const name = pastName.trim() || 'Past Workout';
    const workout = await repository.startWorkout({ name });
    await repository.updateWorkoutDate(workout.id, pastDate);
    await repository.updateWorkout(workout.id, { name });
    setLogPastOpen(false);
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
            className="flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-line-strong"
          >
            <Plus className="h-[13px] w-[13px]" />
            Routine
          </button>
        }
      />

      <PageBody>
        {/* Resume banner */}
        {active && (
          <Panel
            interactive
            onClick={() => navigate(`/session/${active.id}`)}
            ariaLabel="Resume workout"
            className="flex items-center justify-between gap-3 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="h-8 w-[3px] rounded-full bg-accent" aria-hidden />
              <div>
                <SectionLabel>Resume workout</SectionLabel>
                <div className="mt-1 text-[14px] font-extrabold text-ink">{active.name} · in progress</div>
              </div>
            </div>
            <ArrowRight className="h-[18px] w-[18px] text-accent" />
          </Panel>
        )}

        {/* Start empty workout — primary CTA */}
        <PrimaryAction onClick={startEmpty} label="Start empty workout" />

        {/* Log a past workout */}
        <button
          onClick={openLogPast}
          className="w-full rounded-control border border-line bg-transparent py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink3 transition-colors hover:border-line-strong hover:text-ink2"
        >
          Log past workout
        </button>

        {/* Routines */}
        <section className="pt-1">
          <SectionHeader label="Routines" />

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
            <ul className="mt-1">
              {routines.map(({ routine, count }) => (
                <li
                  key={routine.id}
                  className="grid grid-cols-[1fr_auto] gap-3 border-t border-hairline py-4 first:border-t-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[16px] font-extrabold tracking-[-0.015em] text-ink">
                        {routine.name}
                      </span>
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.13em] text-ink4">
                        {dayLabel(routine.day_of_week)}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-ink2">
                      {count} {count === 1 ? 'exercise' : 'exercises'}
                      {routine.notes ? ` · ${routine.notes}` : ''}
                    </div>
                    <div className="mt-2 flex gap-4">
                      <TextButton onClick={() => navigate(`/workout/routines/${routine.id}`)}>Edit</TextButton>
                      <TextButton onClick={() => duplicate(routine.id)}>Duplicate</TextButton>
                      <TextButton onClick={() => remove(routine.id)} danger>
                        Delete
                      </TextButton>
                    </div>
                  </div>
                  <button
                    onClick={() => startFromRoutine(routine)}
                    disabled={count === 0}
                    className="self-start rounded-control border border-accent px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent"
                  >
                    Start
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>

      {logPastOpen && (
        <Modal
          title="Log past workout"
          onClose={() => setLogPastOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setLogPastOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={startPastWorkout} disabled={!pastDate}>
                Start logging
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink3">Date</span>
              <input
                type="date"
                value={pastDate}
                max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}
                onChange={(e) => setPastDate(e.target.value)}
                className="w-full rounded-control border border-line bg-surface2 px-3 py-2.5 text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink3">Name (optional)</span>
              <input
                type="text"
                value={pastName}
                onChange={(e) => setPastName(e.target.value)}
                placeholder="Past Workout"
                className="w-full rounded-control border border-line bg-surface2 px-3 py-2.5 text-ink outline-none placeholder:text-ink4 focus:border-accent"
              />
            </label>
          </div>
        </Modal>
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
      className={`text-[9.5px] font-bold uppercase tracking-[0.13em] transition-colors ${
        danger ? 'text-ink4 hover:text-fatigued' : 'text-ink2 hover:text-ink'
      }`}
    >
      {children}
    </button>
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
