import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Modal, Spinner, TextField } from '../components/ui';
import { BeatBadge } from '../components/BeatBadge';
import { PlateCalculatorPanel } from '../components/PlateCalculatorPanel';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { useElapsedSeconds, formatDuration } from '../hooks/useElapsedSeconds';
import { useWakeLock } from '../hooks/useWakeLock';
import { useRestTimer } from '../hooks/useRestTimer';
import { evaluateSet, type BeatEvaluation, type ComparableSet } from '../lib/beatLastTime';
import type { AutoRegResult } from '../lib/autoRegulation';
import { filterExercises } from '../lib/exerciseSearch';
import { titleCase } from '../lib/labels';
import type {
  LastSession,
  WorkoutDetail,
  WorkoutExerciseWithSets,
} from '../repository/Repository';
import type { Exercise, Settings, WorkoutIntent, WorkoutSet } from '../types';

const INTENTS: { value: WorkoutIntent; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'normal', label: 'Normal' },
  { value: 'light', label: 'Light' },
  { value: 'deload', label: 'Deload' },
];

interface LoadedData {
  detail: WorkoutDetail;
  settings: Settings;
  lastByExercise: Map<string, LastSession | undefined>;
  suggestionByExercise: Map<string, AutoRegResult>;
  restByExercise: Map<string, number | null>;
}

export function WorkoutModeScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const { workoutId = '' } = useParams();
  const rest = useRestTimer();
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const seededRef = useRef<Set<string>>(new Set());

  useWakeLock(true);

  const state = useAsync<LoadedData | null>(async () => {
    const [detail, settings] = await Promise.all([
      repository.getWorkoutDetail(workoutId),
      repository.getSettings(),
    ]);
    if (!detail) return null;
    const exIds = [...new Set(detail.exercises.map((e) => e.exercise_id))];
    const [lastList, restList] = await Promise.all([
      Promise.all(exIds.map((id) => repository.getLastSession(id, { excludeWorkoutId: workoutId }))),
      Promise.all(exIds.map((id) => repository.getLastRestSeconds(id))),
    ]);
    const lastByExercise = new Map(exIds.map((id, i) => [id, lastList[i]]));
    // Auto-regulation suggestion, targeting the top rep count from last time.
    const suggestionList = await Promise.all(
      exIds.map((id) => {
        const working = (lastByExercise.get(id)?.sets ?? []).filter((s) => !s.is_warmup);
        const target = working.length > 0 ? Math.max(...working.map((s) => s.reps)) : 8;
        return repository.getProgressionSuggestion(id, target);
      }),
    );
    return {
      detail,
      settings,
      lastByExercise,
      suggestionByExercise: new Map(exIds.map((id, i) => [id, suggestionList[i]!])),
      restByExercise: new Map(exIds.map((id, i) => [id, restList[i]!])),
    };
  }, [workoutId]);

  // Pre-fill: seed set rows from last time for any exercise that has none yet.
  useEffect(() => {
    if (!state.data) return;
    const { detail, lastByExercise } = state.data;
    // Don't auto-fill rows when editing a finished session.
    if (detail.workout.completed_at !== null) return;
    const toSeed = detail.exercises.filter(
      (e) => e.sets.length === 0 && !seededRef.current.has(e.id),
    );
    if (toSeed.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const e of toSeed) {
        seededRef.current.add(e.id);
        const working = (lastByExercise.get(e.exercise_id)?.sets ?? []).filter((s) => !s.is_warmup);
        if (working.length > 0) {
          for (const s of working) {
            await repository.addSet(e.id, { weight: s.weight, reps: s.reps });
          }
        }
      }
      if (!cancelled) state.reload();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data]);

  // Only show the full-screen spinner on the FIRST load — during background
  // refreshes (after adding/editing a set) keep the current screen mounted so
  // it doesn't collapse and jump.
  if (state.loading && !state.data) return <Spinner />;
  if (!state.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-semibold">Workout not found</p>
        <Button onClick={() => navigate('/workout')}>Back to routines</Button>
      </div>
    );
  }

  const { detail, settings, lastByExercise, suggestionByExercise, restByExercise } = state.data;
  const { workout } = detail;
  // A completed workout opens in edit mode: no timer, no auto-seed, "Done"
  // recomputes PRs instead of "Finish" closing the session.
  const editing = workout.completed_at !== null;

  async function setIntent(intent: WorkoutIntent) {
    await repository.updateWorkout(workoutId, { intent });
    state.reload();
  }

  async function addExercise(exercise: Exercise) {
    await repository.addWorkoutExercise(workoutId, exercise.id);
    setPicking(false);
    state.reload();
  }

  async function onCompleteSet(setId: string, willComplete: boolean, exerciseRest: number | null) {
    const restDuration = exerciseRest ?? settings.default_rest_seconds;
    // Persist the rest used so it's remembered per-exercise next time.
    await repository.updateSet(
      setId,
      willComplete ? { is_completed: true, rest_seconds: restDuration } : { is_completed: false },
    );
    // Editing a past session shouldn't kick off a live rest timer.
    if (willComplete && !editing) {
      rest.start(restDuration);
    }
    state.reload();
  }

  async function finish() {
    await repository.completeWorkout(workoutId);
    navigate(`/summary/${workoutId}`);
  }

  async function discard() {
    await repository.cancelWorkout(workoutId);
    navigate('/workout');
  }

  // Edit mode: everything is persisted immediately, so "Done" just rebuilds the
  // PR cache (a lowered/added set can change the record history) and returns.
  async function doneEditing() {
    await repository.recomputePersonalRecords();
    navigate(`/summary/${workoutId}`);
  }

  async function changeDate(date: string) {
    if (!date) return;
    await repository.updateWorkoutDate(workoutId, date);
    state.reload();
  }

  async function changeNotes(notes: string) {
    await repository.updateWorkout(workoutId, { notes });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const isPastSession = !editing && workout.started_at.slice(0, 10) < todayStr;

  return (
    <div className="min-h-screen bg-slate-950 pb-32">
      <SessionHeader
        name={workout.name}
        startedAt={workout.started_at}
        editing={editing}
        isPast={isPastSession}
        onFinish={() => setFinishing(true)}
        onDone={doneEditing}
      />

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {editing && (
          <EditControls
            date={(workout.completed_at ?? workout.started_at).slice(0, 10)}
            notes={workout.notes}
            onChangeDate={changeDate}
            onChangeNotes={changeNotes}
          />
        )}

        <IntentSelector value={workout.intent} onChange={setIntent} />

        {detail.exercises.length === 0 ? (
          <div className="rounded-panel border border-dashed border-line p-8 text-center text-sm text-ink2">
            No exercises yet. Add one to start logging.
          </div>
        ) : (
          detail.exercises.map((item) => (
            <ExerciseBlock
              key={item.id}
              item={item}
              last={lastByExercise.get(item.exercise_id)}
              suggestion={suggestionByExercise.get(item.exercise_id)}
              rememberedRest={restByExercise.get(item.exercise_id) ?? null}
              settings={settings}
              intent={workout.intent}
              editing={editing}
              onChanged={() => state.reload()}
              onCompleteSet={onCompleteSet}
            />
          ))
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setPicking(true)}>
            + Add exercise
          </Button>
          {!editing && (
            <button
              onClick={() => setTimerOpen(true)}
              className="rounded-control border border-line bg-surface2 px-3 text-ink2 hover:bg-surface3"
              aria-label="Start timer"
            >
              ⏱
            </button>
          )}
        </div>

        {!editing && <SessionNotes notes={workout.notes} onChangeNotes={changeNotes} />}
      </div>

      {rest.active && <RestTimerBar rest={rest} />}

      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}

      {timerOpen && (
        <TimerModal
          onStart={(s) => { rest.start(s); setTimerOpen(false); }}
          onClose={() => setTimerOpen(false)}
        />
      )}

      {finishing && !editing && (
        <Modal
          title="Finish workout?"
          onClose={() => setFinishing(false)}
          footer={
            <div className="flex justify-between gap-2">
              <Button variant="danger" onClick={discard}>
                Discard
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setFinishing(false)}>
                  Keep going
                </Button>
                <Button variant="primary" onClick={finish}>
                  Finish
                </Button>
              </div>
            </div>
          }
        >
          <p className="text-sm text-slate-300">
            Finishing saves this session. Discard deletes it entirely — this can’t be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

function SessionHeader({
  name,
  startedAt,
  editing,
  isPast,
  onFinish,
  onDone,
}: {
  name: string;
  startedAt: string;
  editing: boolean;
  isPast?: boolean;
  onFinish: () => void;
  onDone: () => void;
}) {
  const elapsed = useElapsedSeconds(isPast ? null : startedAt);
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-ground/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <div className="min-w-0">
          {editing && (
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-accent">
              Editing workout
            </div>
          )}
          <div className="truncate text-base font-extrabold">{name}</div>
          {!editing && (
            <div className="flex items-center gap-1 text-sm tabular-nums text-slate-400">
              {isPast ? (
                <span className="text-amber-400">Logging past session</span>
              ) : (
                <>
                  <span aria-hidden>⏱</span> {formatDuration(elapsed)}
                </>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        ) : (
          <Button variant="primary" onClick={onFinish}>
            Finish
          </Button>
        )}
      </div>
    </header>
  );
}

function EditControls({
  date,
  notes,
  onChangeDate,
  onChangeNotes,
}: {
  date: string;
  notes: string;
  onChangeDate: (date: string) => void;
  onChangeNotes: (notes: string) => void;
}) {
  const [noteDraft, setNoteDraft] = useState(notes);
  return (
    <div className="space-y-3 rounded-panel border border-line bg-surface p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Date</span>
        <input
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChangeDate(e.target.value)}
          className="w-full rounded-control border border-line bg-surface2 px-3 py-2.5 text-ink outline-none focus:border-accent"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Notes</span>
        <textarea
          value={noteDraft}
          rows={2}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => onChangeNotes(noteDraft.trim())}
          placeholder="How did it go?"
          className="w-full rounded-control border border-line bg-surface2 px-3 py-2.5 text-ink outline-none focus:border-accent"
        />
      </label>
    </div>
  );
}

function SessionNotes({
  notes,
  onChangeNotes,
}: {
  notes: string;
  onChangeNotes: (notes: string) => void;
}) {
  const [draft, setDraft] = useState(notes);
  return (
    <div className="rounded-panel border border-line bg-surface p-4 shadow-panel">
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-ink3">
          Session notes
        </span>
        <textarea
          value={draft}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft.trim() !== notes.trim() && onChangeNotes(draft.trim())}
          placeholder="How did it go? Anything to remember for next time…"
          className="w-full rounded-control border border-line bg-surface2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink4 focus:border-accent"
        />
      </label>
    </div>
  );
}

function IntentSelector({
  value,
  onChange,
}: {
  value: WorkoutIntent;
  onChange: (intent: WorkoutIntent) => void;
}) {
  return (
    <div className="flex gap-2">
      {INTENTS.map((intent) => (
        <button
          key={intent.value}
          onClick={() => onChange(intent.value)}
          className={`flex-1 rounded-control border px-2 py-2 text-xs font-semibold transition-colors ${
            value === intent.value
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface2 text-ink2 hover:text-ink'
          }`}
        >
          {intent.label}
        </button>
      ))}
    </div>
  );
}

function ExerciseBlock({
  item,
  last,
  suggestion,
  rememberedRest,
  settings,
  intent,
  editing,
  onChanged,
  onCompleteSet,
}: {
  item: WorkoutExerciseWithSets;
  last: LastSession | undefined;
  suggestion: AutoRegResult | undefined;
  rememberedRest: number | null;
  settings: Settings;
  intent: WorkoutIntent;
  editing: boolean;
  onChanged: () => void;
  onCompleteSet: (setId: string, willComplete: boolean, exerciseRest: number | null) => void;
}) {
  const repository = useRepository();
  const [menuOpen, setMenuOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const isCardio = item.exercise?.movement_type === 'cardio';

  // Beat Last Time compares each set, in order, to the SAME set number from the
  // last time you did this exercise (set 1 vs set 1, set 2 vs set 2, …) — so the
  // ±weight is for that specific set's counterpart, not a session peak. Only the
  // most recent session counts, and only if it's within the staleness window.
  const priorWorking = useMemo(() => {
    if (!last) return [];
    const ageMs = Date.now() - new Date(last.workout.completed_at ?? last.workout.started_at).getTime();
    const withinWindow = ageMs <= settings.beat_lookback_weeks * 7 * 24 * 60 * 60 * 1000;
    if (!withinWindow) return [];
    return last.sets
      .filter((s) => !s.is_warmup)
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => ({ weight: s.weight, reps: s.reps }) as ComparableSet);
  }, [last, settings.beat_lookback_weeks]);

  // Map each working set's id to its position among the working sets, so a row
  // can look up its counterpart from last time by index.
  const workingIndexById = useMemo(() => {
    const map = new Map<string, number>();
    item.sets.filter((s) => !s.is_warmup).forEach((s, i) => map.set(s.id, i));
    return map;
  }, [item.sets]);

  const topWeight = useMemo(() => {
    const working = item.sets.filter((s) => !s.is_warmup);
    return working.length > 0 ? Math.max(...working.map((s) => s.weight)) : 0;
  }, [item.sets]);

  async function addSet() {
    const working = item.sets.filter((s) => !s.is_warmup);
    const templ = working[working.length - 1];
    const created = await repository.addSet(item.id, {
      weight: templ?.weight ?? 0,
      reps: templ?.reps ?? 0,
    });
    // In edit mode a new set is part of a finished session, so mark it done —
    // otherwise it wouldn't count toward volume or PRs.
    if (editing) await repository.updateSet(created.id, { is_completed: true });
    onChanged();
  }

  async function addWarmupSet() {
    const warmups = item.sets.filter((s) => s.is_warmup);
    const templ = warmups[warmups.length - 1];
    const working = item.sets.filter((s) => !s.is_warmup);
    const workTempl = working[0];
    const created = await repository.addSet(item.id, {
      weight: templ?.weight ?? (workTempl ? Math.round(workTempl.weight * 0.6) : 0),
      reps: templ?.reps ?? (workTempl?.reps ?? 0),
      is_warmup: true,
    });
    if (editing) await repository.updateSet(created.id, { is_completed: true });
    onChanged();
  }

  async function swap(exercise: Exercise) {
    await repository.swapWorkoutExercise(item.id, exercise.id);
    setSwapping(false);
    onChanged();
  }

  async function remove() {
    await repository.removeWorkoutExercise(item.id);
    onChanged();
  }

  return (
    <div className="rounded-panel border border-line bg-surface p-4 shadow-panel">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{item.exercise?.name ?? 'Exercise'}</div>
          <LastTimeRow last={last} />
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="h-8 w-8 rounded-control bg-surface2 text-ink2 hover:bg-surface3"
            aria-label="Exercise menu"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-tile border border-line bg-surface text-sm shadow-raised">
              <button
                onClick={() => {
                  setSwapping(true);
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-surface2"
              >
                Swap exercise
              </button>
              <button
                onClick={() => {
                  remove();
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-fatigued hover:bg-surface2"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {suggestion?.suggest && suggestion.reason && (
        <div className="mt-3  border border-beat/30 bg-beat/5 px-3 py-2 text-xs text-beat">
          💡 {suggestion.reason}
        </div>
      )}

      {isCardio ? (
        <>
          <div className="mt-3 space-y-3">
            {item.sets.map((set) => (
              <CardioEntryRow
                key={set.id}
                set={set}
                unit={settings.units}
                onChanged={onChanged}
                onComplete={(willComplete) => onCompleteSet(set.id, willComplete, null)}
              />
            ))}
          </div>
          <button
            onClick={addSet}
            className="mt-3 w-full rounded-control border border-dashed border-line py-2 text-sm text-ink2 hover:border-line-strong hover:text-ink"
          >
            + Add interval
          </button>
        </>
      ) : (
        <>
          <div className="mt-3 space-y-1.5">
            {item.sets.map((set) => {
              const workingIndex = workingIndexById.get(set.id);
              const comparison = workingIndex === undefined ? null : (priorWorking[workingIndex] ?? null);
              return (
                <SetRow
                  key={set.id}
                  set={set}
                  unit={settings.units}
                  comparison={comparison}
                  beatEnabled={settings.beat_comparison_enabled}
                  loadAlwaysGreen={settings.load_always_green}
                  intent={intent}
                  onChanged={onChanged}
                  onComplete={(willComplete) => onCompleteSet(set.id, willComplete, rememberedRest)}
                />
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={addWarmupSet}
              className="flex-1 rounded-control border border-dashed border-amber-500/40 py-2 text-sm text-amber-400/70 hover:border-amber-500/70 hover:text-amber-400"
            >
              + Warm-up
            </button>
            <button
              onClick={addSet}
              className="flex-1 rounded-control border border-dashed border-line py-2 text-sm text-ink2 hover:border-line-strong hover:text-ink"
            >
              + Add set
            </button>
          </div>
        </>
      )}

      {/* Plate breakdown only makes sense for a plate-loaded barbell. */}
      {topWeight > 0 && item.exercise?.equipment === 'barbell' && (
        <div className="mt-3">
          <PlateCalculatorPanel weight={topWeight} unit={settings.units} />
        </div>
      )}

      {swapping && <ExercisePicker onPick={swap} onClose={() => setSwapping(false)} />}
    </div>
  );
}

function LastTimeRow({ last }: { last: LastSession | undefined }) {
  const working = (last?.sets ?? []).filter((s) => !s.is_warmup);
  if (working.length === 0) {
    return <div className="mt-0.5 text-xs text-slate-500">LAST TIME — first time</div>;
  }
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
      <span className="font-medium text-slate-600">LAST TIME</span>
      {working.map((s) => (
        <span key={s.id} className="tabular-nums">
          {s.weight}×{s.reps}
        </span>
      ))}
    </div>
  );
}

function SetRow({
  set,
  unit,
  comparison,
  beatEnabled,
  loadAlwaysGreen,
  intent,
  onChanged,
  onComplete,
}: {
  set: WorkoutSet;
  unit: Settings['units'];
  comparison: ComparableSet | null;
  beatEnabled: boolean;
  loadAlwaysGreen: boolean;
  intent: WorkoutIntent;
  onChanged: () => void;
  onComplete: (willComplete: boolean) => void;
}) {
  const repository = useRepository();
  const [weight, setWeight] = useState(set.weight);
  const [reps, setReps] = useState(set.reps);

  // Re-sync when the underlying set changes (e.g. after a reload).
  useEffect(() => {
    setWeight(set.weight);
    setReps(set.reps);
  }, [set.weight, set.reps]);

  const weightStep = unit === 'kg' ? 2.5 : 5;

  const evaluation: BeatEvaluation | null = useMemo(() => {
    if (set.is_warmup || !beatEnabled || !comparison) return null;
    return evaluateSet({ weight, reps }, [comparison], { loadAlwaysGreen, intent, unit });
  }, [weight, reps, set.is_warmup, beatEnabled, comparison, loadAlwaysGreen, intent, unit]);

  function persist(next: { weight?: number; reps?: number }) {
    void repository.updateSet(set.id, next);
  }

  function changeWeight(v: number) {
    const value = Math.max(0, v);
    setWeight(value);
    persist({ weight: value });
  }

  function changeReps(v: number) {
    const value = Math.max(0, v);
    setReps(value);
    persist({ reps: value });
  }

  async function toggleWarmup() {
    await repository.updateSet(set.id, { is_warmup: !set.is_warmup });
    onChanged();
  }

  async function remove() {
    await repository.removeSet(set.id);
    onChanged();
  }

  return (
    <div className={`rounded-tile px-1 py-1.5 ${set.is_completed ? 'bg-surface2/50' : ''}`}>
      {/* Line 1 — the core logging controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleWarmup}
          className={`h-10 w-9 shrink-0 rounded-control text-xs font-bold ${
            set.is_warmup ? 'bg-amber-500/20 text-amber-400' : 'bg-surface2 text-ink3'
          }`}
          title="Toggle warm-up"
          aria-label="Toggle warm-up"
        >
          {set.is_warmup ? 'W' : set.set_number}
        </button>

        <NumberField value={weight} step={weightStep} onChange={changeWeight} suffix={unit} />
        <span className="text-slate-600">×</span>
        <NumberField value={reps} step={1} onChange={changeReps} />

        <button
          onClick={() => onComplete(!set.is_completed)}
          className={`ml-auto h-10 w-10 shrink-0 rounded-control text-lg font-bold transition-colors ${
            set.is_completed
              ? 'bg-accent text-on-accent'
              : 'bg-surface2 text-ink3 hover:bg-surface3'
          }`}
          aria-label={set.is_completed ? 'Mark incomplete' : 'Complete set'}
        >
          ✓
        </button>
      </div>

      {/* Line 2 — status on the left, an always-visible Delete on the right */}
      <div className="mt-1 flex items-center justify-between pl-10">
        {set.is_warmup ? (
          <span className="text-[11px] font-medium text-amber-400">Warm-up (not counted)</span>
        ) : beatEnabled ? (
          <BeatBadge evaluation={evaluation} />
        ) : (
          <span />
        )}
        <button
          onClick={remove}
          className="flex items-center gap-1  px-2 py-1 text-xs text-slate-500 hover:bg-fatigued/10 hover:text-fatigued"
          aria-label="Delete set"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}

function CardioEntryRow({
  set,
  unit,
  onChanged,
  onComplete,
}: {
  set: WorkoutSet;
  unit: Settings['units'];
  onChanged: () => void;
  onComplete: (willComplete: boolean) => void;
}) {
  const repository = useRepository();
  const [duration, setDuration] = useState(set.weight);
  const [distance, setDistance] = useState(set.reps);
  const [speed, setSpeed] = useState(set.rpe ?? 0);
  const [incline, setIncline] = useState(set.rest_seconds ?? 0);

  useEffect(() => {
    setDuration(set.weight);
    setDistance(set.reps);
    setSpeed(set.rpe ?? 0);
    setIncline(set.rest_seconds ?? 0);
  }, [set.weight, set.reps, set.rpe, set.rest_seconds]);

  function persist(patch: { weight?: number; reps?: number; rpe?: number | null; rest_seconds?: number | null }) {
    void repository.updateSet(set.id, patch);
  }

  function changeDuration(v: number) {
    const value = Math.max(0, v);
    setDuration(value);
    persist({ weight: value });
  }
  function changeDistance(v: number) {
    const value = Math.max(0, v);
    setDistance(value);
    persist({ reps: value });
  }
  function changeSpeed(v: number) {
    const value = Math.max(0, parseFloat(v.toFixed(1)));
    setSpeed(value);
    persist({ rpe: value });
  }
  function changeIncline(v: number) {
    const value = Math.max(0, Math.min(45, v));
    setIncline(value);
    persist({ rest_seconds: value });
  }

  async function remove() {
    await repository.removeSet(set.id);
    onChanged();
  }

  const distUnit = unit === 'kg' ? 'km' : 'mi';
  const speedUnit = unit === 'kg' ? 'km/h' : 'mph';

  return (
    <div className={`rounded-tile p-3 ${set.is_completed ? 'bg-surface2/50' : 'border border-line/50'}`}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <CardioField label="Duration" suffix="min" value={duration} step={5} onChange={changeDuration} />
        <CardioField label="Distance" suffix={distUnit} value={distance} step={1} onChange={changeDistance} />
        <CardioField label="Speed" suffix={speedUnit} value={speed} step={0.5} onChange={changeSpeed} />
        <CardioField label="Incline" suffix="%" value={incline} step={1} onChange={changeIncline} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={remove}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:bg-fatigued/10 hover:text-fatigued"
          aria-label="Delete entry"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          Delete
        </button>
        <button
          onClick={() => onComplete(!set.is_completed)}
          className={`rounded-control px-4 py-1.5 text-sm font-semibold transition-colors ${
            set.is_completed ? 'bg-accent text-on-accent' : 'bg-surface2 text-ink2 hover:bg-surface3'
          }`}
        >
          {set.is_completed ? '✓ Done' : 'Mark done'}
        </button>
      </div>
    </div>
  );
}

function CardioField({
  label,
  suffix,
  value,
  step,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink3">{label}</div>
      <NumberField value={value} step={step} onChange={onChange} suffix={suffix} />
    </div>
  );
}

function NumberField({
  value,
  step,
  onChange,
  suffix,
}: {
  value: number;
  step: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center rounded-control border border-line bg-surface2">
      <button
        onClick={() => onChange(Math.max(0, value - step))}
        className="h-10 w-9 rounded-l-control text-lg text-ink2 hover:bg-surface3"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(Number(e.target.value))}
        onFocus={(e) => e.target.select()}
        className="w-9 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
        aria-label={suffix ? `Value in ${suffix}` : 'Reps'}
      />
      {suffix && (
        <span className="pr-1 text-[10px] font-medium text-ink3">{suffix}</span>
      )}
      <button
        onClick={() => onChange(value + step)}
        className={`h-10 w-9 text-lg text-ink2 hover:bg-surface3 ${suffix ? 'rounded-r-control' : 'rounded-r-control'}`}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

function RestTimerBar({ rest }: { rest: ReturnType<typeof useRestTimer> }) {
  const pct = rest.total > 0 ? (rest.remaining / rest.total) * 100 : 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
      <div className="h-1 bg-surface2">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div
        className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="text-sm">
          <span className="text-slate-400">Rest</span>{' '}
          <span className="text-lg font-bold tabular-nums">{formatDuration(rest.remaining)}</span>
        </div>
        <div className="flex gap-2">
          <TimerButton onClick={() => rest.addTime(30)}>+30s</TimerButton>
          {rest.running ? (
            <TimerButton onClick={rest.pause}>Pause</TimerButton>
          ) : (
            <TimerButton onClick={rest.resume}>Resume</TimerButton>
          )}
          <TimerButton onClick={rest.skip}>Skip</TimerButton>
        </div>
      </div>
    </div>
  );
}

function TimerButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-control border border-line bg-surface2 px-3 py-1.5 text-sm text-ink2 hover:bg-surface3"
    >
      {children}
    </button>
  );
}

function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const repository = useRepository();
  const [query, setQuery] = useState('');
  const state = useAsync(() => repository.getExercises(), []);
  const results = useMemo(() => filterExercises(state.data ?? [], { query }), [state.data, query]);

  return (
    <Modal title="Add exercise" onClose={onClose}>
      <div className="space-y-3">
        <TextField
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Search exercises"
        />
        {state.loading ? (
          <Spinner />
        ) : (
          <ul className="max-h-[50vh] divide-y divide-hairline overflow-y-auto">
            {results.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => onPick(ex)}
                  className="flex w-full items-center justify-between px-1 py-3 text-left hover:bg-white/[0.03]"
                >
                  <span className="text-ink">{ex.name}</span>
                  <span className="text-xs text-ink3">{titleCase(ex.equipment)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function TimerModal({ onStart, onClose }: { onStart: (seconds: number) => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState(2);
  const [seconds, setSeconds] = useState(0);

  const total = minutes * 60 + seconds;

  const presets = [30, 60, 90, 120, 180, 300];

  return (
    <Modal
      title="Set timer"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => total > 0 && onStart(total)} disabled={total === 0}>
            Start
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Preset quick-pick */}
        <div className="flex flex-wrap gap-2">
          {presets.map((s) => (
            <button
              key={s}
              onClick={() => { setMinutes(Math.floor(s / 60)); setSeconds(s % 60); }}
              className={`rounded-control border px-3 py-1.5 text-xs font-semibold transition-colors ${
                total === s ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface2 text-ink2 hover:text-ink'
              }`}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
        {/* Manual steppers */}
        <div className="flex items-center justify-center gap-4">
          <NumberField
            value={minutes}
            step={1}
            onChange={(v) => setMinutes(Math.max(0, Math.min(99, Math.round(v))))}
            suffix="min"
          />
          <NumberField
            value={seconds}
            step={15}
            onChange={(v) => setSeconds(Math.max(0, Math.min(59, Math.round(v))))}
            suffix="sec"
          />
        </div>
      </div>
    </Modal>
  );
}
