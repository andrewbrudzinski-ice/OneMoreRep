import { useMemo, useState } from 'react';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { filterExercises } from '../lib/exerciseSearch';
import { EQUIPMENT_OPTIONS, MOVEMENT_OPTIONS, titleCase } from '../lib/labels';
import {
  Button,
  Modal,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
} from './ui';
import type { Equipment, Exercise, MovementType } from '../types';
import type { NewExerciseInput } from '../repository/Repository';

/**
 * Shared exercise picker modal used by the workout screen and routine editor.
 * Shows a searchable list plus a "Create custom exercise" shortcut at the
 * bottom. When the user taps Create, the modal switches to an inline form
 * that pre-fills the name from the current search query; on save the new
 * exercise is created and immediately passed to onPick.
 */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const repository = useRepository();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const exercisesState = useAsync(() => repository.getExercises(), []);
  const results = useMemo(
    () => filterExercises(exercisesState.data ?? [], { query }),
    [exercisesState.data, query],
  );

  async function handleCreate(input: NewExerciseInput) {
    const exercise = await repository.createExercise(input);
    onPick(exercise);
  }

  const trimmedQuery = query.trim();

  if (creating) {
    return (
      <QuickCreateModal
        initialName={trimmedQuery}
        onCancel={() => setCreating(false)}
        onSave={handleCreate}
      />
    );
  }

  return (
    <Modal title="Add exercise" onClose={onClose}>
      <div className="space-y-3">
        <TextField
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Search exercises"
        />

        {exercisesState.loading ? (
          <Spinner />
        ) : results.length === 0 ? (
          <div className="space-y-3 pt-1">
            <p className="text-center text-sm text-ink3">
              {trimmedQuery ? `No results for "${trimmedQuery}"` : 'No exercises found.'}
            </p>
            <CreateButton query={trimmedQuery} onClick={() => setCreating(true)} prominent />
          </div>
        ) : (
          <>
            <ul className="max-h-[45vh] divide-y divide-hairline overflow-y-auto">
              {results.map((ex) => (
                <li key={ex.id}>
                  <button
                    onClick={() => onPick(ex)}
                    className="flex w-full items-center justify-between px-1 py-3 text-left hover:bg-white/[0.03]"
                  >
                    <span className="text-ink">{ex.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {ex.is_custom && (
                        <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] text-ink3">
                          custom
                        </span>
                      )}
                      <span className="text-xs text-ink3">{titleCase(ex.equipment)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <CreateButton query={trimmedQuery} onClick={() => setCreating(true)} />
          </>
        )}
      </div>
    </Modal>
  );
}

function CreateButton({
  query,
  onClick,
  prominent = false,
}: {
  query: string;
  onClick: () => void;
  prominent?: boolean;
}) {
  const label = query ? `Create "${query}"` : 'Create custom exercise';
  if (prominent) {
    return (
      <button
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-accent/50 px-3 py-3 text-sm font-semibold text-accent hover:border-accent hover:bg-accent/5"
      >
        <span className="text-base leading-none">+</span>
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-control border border-dashed border-line px-3 py-2 text-sm text-ink3 hover:border-accent/50 hover:text-accent"
    >
      <span className="font-bold leading-none">+</span>
      {label}
    </button>
  );
}

function QuickCreateModal({
  initialName,
  onCancel,
  onSave,
}: {
  initialName: string;
  onCancel: () => void;
  onSave: (input: NewExerciseInput) => void | Promise<void>;
}) {
  const repository = useRepository();
  const groupsState = useAsync(() => repository.getMuscleGroups(), []);
  const groups = groupsState.data ?? [];

  const [name, setName] = useState(initialName);
  const [primary, setPrimary] = useState('');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [movement, setMovement] = useState<MovementType>('push');
  const [isCompound, setIsCompound] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  // Once groups load, default to the first one.
  const resolvedPrimary = primary || groups[0]?.id || '';

  const canSave = name.trim().length > 0 && resolvedPrimary.length > 0 && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        primary_muscle_group_id: resolvedPrimary,
        equipment,
        movement_type: movement,
        is_compound: isCompound,
        instructions: instructions.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New custom exercise"
      onClose={onCancel}
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={onCancel}>
            ← Back
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={submit}>
            {saving ? 'Saving…' : 'Save & add'}
          </Button>
        </div>
      }
    >
      {groupsState.loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <SelectField
            label="Primary muscle group"
            value={resolvedPrimary}
            onChange={setPrimary}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Equipment"
              value={equipment}
              onChange={(v) => setEquipment(v as Equipment)}
            >
              {EQUIPMENT_OPTIONS.map((eq) => (
                <option key={eq} value={eq}>
                  {titleCase(eq)}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Movement"
              value={movement}
              onChange={(v) => setMovement(v as MovementType)}
            >
              {MOVEMENT_OPTIONS.map((mv) => (
                <option key={mv} value={mv}>
                  {titleCase(mv)}
                </option>
              ))}
            </SelectField>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink2">
            <input
              type="checkbox"
              checked={isCompound}
              onChange={(e) => setIsCompound(e.target.checked)}
              className="accent-accent"
            />
            Compound movement
          </label>
          <TextAreaField
            label="Instructions (optional)"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
