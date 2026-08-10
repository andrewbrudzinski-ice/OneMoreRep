import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Button,
  EmptyState,
  Modal,
  SelectField,
  Spinner,
  Stepper,
  TextAreaField,
  TextField,
} from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { filterExercises } from '../lib/exerciseSearch';
import { moveDown, moveUp } from '../lib/order';
import { DAY_NAMES } from '../lib/labels';
import type { DayOfWeek, Exercise } from '../types';
import type { RoutineExerciseWithExercise } from '../repository/Repository';

export function RoutineEditorScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const { routineId = '' } = useParams();
  const [picking, setPicking] = useState(false);

  const state = useAsync(() => repository.getRoutineDetail(routineId), [routineId]);

  if (state.loading) return <Spinner />;
  if (!state.data) {
    return (
      <>
        <ScreenHeader title="Routine" />
        <EmptyState icon="🤔" title="Routine not found" note="It may have been deleted." />
        <div className="p-4">
          <Button onClick={() => navigate('/workout')}>← Back to routines</Button>
        </div>
      </>
    );
  }

  const { routine, items } = state.data;

  async function saveDetails(patch: { name?: string; notes?: string; day_of_week?: DayOfWeek }) {
    await repository.updateRoutine(routineId, patch);
    state.reload();
  }

  async function addExercise(exercise: Exercise) {
    await repository.addRoutineExercise(routineId, exercise.id);
    setPicking(false);
    state.reload();
  }

  async function reorder(newOrderIds: string[]) {
    await repository.reorderRoutineExercises(routineId, newOrderIds);
    state.reload();
  }

  async function updateTargets(
    id: string,
    patch: { target_sets?: number; target_reps_low?: number; target_reps_high?: number; notes?: string },
  ) {
    await repository.updateRoutineExercise(id, patch);
    state.reload();
  }

  async function removeItem(id: string) {
    await repository.removeRoutineExercise(id);
    state.reload();
  }

  return (
    <>
      <ScreenHeader
        title="Edit Routine"
        subtitle={`${items.length} ${items.length === 1 ? 'exercise' : 'exercises'}`}
        action={
          <Button variant="ghost" onClick={() => navigate('/workout')}>
            Done
          </Button>
        }
      />

      <div className="space-y-4 p-4">
        <RoutineDetailsForm
          name={routine.name}
          notes={routine.notes}
          day={routine.day_of_week}
          onSave={saveDetails}
        />

        <div className="space-y-3">
          {items.length === 0 ? (
            <EmptyState icon="➕" title="No exercises yet" note="Add your first exercise below." />
          ) : (
            items.map((item, index) => (
              <RoutineExerciseCard
                key={item.id}
                item={item}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                onMoveUp={() => reorder(moveUp(items, index).map((i) => i.id))}
                onMoveDown={() => reorder(moveDown(items, index).map((i) => i.id))}
                onChange={(patch) => updateTargets(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))
          )}
        </div>

        <Button variant="secondary" className="w-full" onClick={() => setPicking(true)}>
          + Add exercise
        </Button>
      </div>

      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}
    </>
  );
}

function RoutineDetailsForm({
  name,
  notes,
  day,
  onSave,
}: {
  name: string;
  notes: string;
  day: DayOfWeek;
  onSave: (patch: { name?: string; notes?: string; day_of_week?: DayOfWeek }) => void;
}) {
  const [localName, setLocalName] = useState(name);
  const [localNotes, setLocalNotes] = useState(notes);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <TextField
        label="Routine name"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={() => localName.trim() && localName !== name && onSave({ name: localName.trim() })}
      />
      <SelectField
        label="Day"
        value={day === null ? '' : String(day)}
        onChange={(v) => onSave({ day_of_week: v === '' ? null : (Number(v) as DayOfWeek) })}
      >
        <option value="">Any day</option>
        {DAY_NAMES.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label="Notes"
        value={localNotes}
        onChange={(e) => setLocalNotes(e.target.value)}
        onBlur={() => localNotes !== notes && onSave({ notes: localNotes })}
        rows={2}
      />
    </div>
  );
}

function RoutineExerciseCard({
  item,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onChange,
  onRemove,
}: {
  item: RoutineExerciseWithExercise;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChange: (patch: {
    target_sets?: number;
    target_reps_low?: number;
    target_reps_high?: number;
    notes?: string;
  }) => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(item.notes);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{item.exercise?.name ?? 'Unknown exercise'}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="h-8 w-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="h-8 w-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            className="h-8 w-8 rounded-lg text-red-400 hover:bg-red-500/10"
            aria-label="Remove exercise"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Sets</span>
          <Stepper
            value={item.target_sets}
            min={1}
            onChange={(v) => onChange({ target_sets: v })}
            ariaLabel="Target sets"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Reps</span>
          <div className="flex items-center gap-1">
            <Stepper
              value={item.target_reps_low}
              min={1}
              onChange={(v) =>
                onChange({
                  target_reps_low: v,
                  target_reps_high: Math.max(v, item.target_reps_high),
                })
              }
              ariaLabel="Target reps low"
            />
            <span className="text-slate-500">–</span>
            <Stepper
              value={item.target_reps_high}
              min={1}
              onChange={(v) =>
                onChange({
                  target_reps_high: v,
                  target_reps_low: Math.min(v, item.target_reps_low),
                })
              }
              ariaLabel="Target reps high"
            />
          </div>
        </div>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== item.notes && onChange({ notes })}
        placeholder="Notes (optional)"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-beat"
      />
    </div>
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

  const results = useMemo(
    () => filterExercises(state.data ?? [], { query }),
    [state.data, query],
  );

  return (
    <Modal title="Add exercise" onClose={onClose}>
      <div className="space-y-3">
        <TextField
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Search exercises to add"
        />
        {state.loading ? (
          <Spinner />
        ) : (
          <ul className="max-h-[50vh] divide-y divide-slate-800 overflow-y-auto">
            {results.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => onPick(ex)}
                  className="w-full px-1 py-3 text-left hover:bg-slate-900"
                >
                  {ex.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
