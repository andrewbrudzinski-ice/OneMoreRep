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
  RecentBest,
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
  recentBestByExercise: Map<string, RecentBest | undefined>;
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
  const seededRef = useRef<Set<string>>(new Set());

  useWakeLock(true);

  const state = useAsync<LoadedData | null>(async () => {
    const [detail, settings] = await Promise.all([
      repository.getWorkoutDetail(workoutId),
      repository.getSettings(),
    ]);
    if (!detail) return null;
    const exIds = [...new Set(detail.exercises.map((e) => e.exercise_id))];
    const [lastList, restList, recentBestList] = await Promise.all([
      Promise.all(exIds.map((id) => repository.getLastSession(id, { excludeWorkoutId: workoutId }))),
      Promise.all(exIds.map((id) => repository.getLastRestSeconds(id))),
      Promise.all(
        exIds.map((id) =>
          repository.getRecentBest(id, {
            withinWeeks: settings.beat_lookback_weeks,
            excludeWorkoutId: workoutId,
          }),
        ),
      ),
    ]);
    const lastByExercise = new Map(exIds.map((id, i) => [id, lastList[i]]));
    const recentBestByExercise = new Map(exIds.map((id, i) => [id, recentBestList[i]]));
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
      recentBestByExercise,
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

  const { detail, settings, lastByExercise, recentBestByExercise, suggestionByExercise, restByExercise } =
    state.data;
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

  return (
    <div className="min-h-screen bg-slate-950 pb-32">
      <SessionHeader
        name={workout.name}
        startedAt={workout.started_at}
        editing={editing}
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
          <div className=" border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            No exercises yet. Add one to start logging.
          </div>
        ) : (
          detail.exercises.map((item) => (
            <ExerciseBlock
              key={item.id}
              item={item}
              last={lastByExercise.get(item.exercise_id)}
              recentBest={recentBestByExercise.get(item.exercise_id)}
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

        <Button variant="secondary" className="w-full" onClick={() => setPicking(true)}>
          + Add exercise
        </Button>
      </div>

      {rest.active && <RestTimerBar rest={rest} />}

      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}

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
  onFinish,
  onDone,
}: {
  name: string;
  startedAt: string;
  editing: boolean;
  onFinish: () => void;
  onDone: () => void;
}) {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
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
              <span aria-hidden>⏱</span> {formatDuration(elapsed)}
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
    <div className="space-y-3 border border-slate-800 bg-slate-900/50 p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Date</span>
        <input
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChangeDate(e.target.value)}
          className="w-full border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none focus:border-accent"
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
          className="w-full border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none focus:border-accent"
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
          className={`flex-1  border px-2 py-2 text-xs font-medium transition-colors ${
            value === intent.value
              ? 'border-beat bg-beat/15 text-beat'
              : 'border-slate-700 bg-slate-900 text-slate-300'
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
  recentBest,
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
  recentBest: RecentBest | undefined;
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

  // Beat Last Time compares each set to the single strongest set from the last
  // few weeks (see settings.beat_lookback_weeks) — one stable baseline, so the
  // verdict no longer flips as you scrub the weight.
  const comparison: ComparableSet | null = recentBest
    ? { weight: recentBest.weight, reps: recentBest.reps }
    : null;

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
    <div className=" border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{item.exercise?.name ?? 'Exercise'}</div>
          <LastTimeRow last={last} />
          {settings.beat_comparison_enabled && recentBest && (
            <div className="mt-0.5 text-xs text-accent/80">
              <span className="font-medium">BEST ({settings.beat_lookback_weeks} WK)</span>{' '}
              <span className="tabular-nums">
                {recentBest.weight}×{recentBest.reps}
              </span>
            </div>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="h-8 w-8  bg-slate-800 text-slate-300 hover:bg-slate-700"
            aria-label="Exercise menu"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden  border border-slate-700 bg-slate-900 text-sm shadow-xl">
              <button
                onClick={() => {
                  setSwapping(true);
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-slate-800"
              >
                Swap exercise
              </button>
              <button
                onClick={() => {
                  remove();
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-fatigued hover:bg-slate-800"
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

      <div className="mt-3 space-y-1.5">
        {item.sets.map((set) => (
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
        ))}
      </div>

      <button
        onClick={addSet}
        className="mt-2 w-full  border border-dashed border-slate-700 py-2 text-sm text-slate-400 hover:border-slate-500"
      >
        + Add set
      </button>

      {topWeight > 0 && (
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
    <div className={`-lg px-1 py-1.5 ${set.is_completed ? 'bg-slate-800/40' : ''}`}>
      {/* Line 1 — the core logging controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleWarmup}
          className={`h-8 w-8 shrink-0  text-xs font-bold ${
            set.is_warmup ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
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
          className={`ml-auto h-9 w-9 shrink-0  text-lg font-bold ${
            set.is_completed
              ? 'bg-beat text-on-accent'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
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
    <div className="flex items-center  bg-slate-800">
      <button
        onClick={() => onChange(value - step)}
        className="h-9 w-7  text-slate-300 hover:bg-slate-700"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-12 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
        aria-label={suffix ? `Weight in ${suffix}` : 'Reps'}
      />
      <button
        onClick={() => onChange(value + step)}
        className="h-9 w-7  text-slate-300 hover:bg-slate-700"
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-900/95 backdrop-blur">
      <div className="h-1 bg-slate-800">
        <div className="h-full bg-beat transition-all" style={{ width: `${pct}%` }} />
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
      className=" bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
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
          <ul className="max-h-[50vh] divide-y divide-slate-800 overflow-y-auto">
            {results.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => onPick(ex)}
                  className="flex w-full items-center justify-between px-1 py-3 text-left hover:bg-slate-900"
                >
                  <span>{ex.name}</span>
                  <span className="text-xs text-slate-500">{titleCase(ex.equipment)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
