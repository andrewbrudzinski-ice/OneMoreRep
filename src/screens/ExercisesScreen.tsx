import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Button,
  Chip,
  EmptyState,
  Modal,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
} from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { filterExercises } from '../lib/exerciseSearch';
import { EQUIPMENT_OPTIONS, MOVEMENT_OPTIONS, titleCase } from '../lib/labels';
import type { Exercise, Equipment, MovementType, MuscleGroup } from '../types';
import type { NewExerciseInput } from '../repository/Repository';

export function ExercisesScreen() {
  const repository = useRepository();
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);

  const groupsState = useAsync(() => repository.getMuscleGroups(), []);
  const exercisesState = useAsync(
    () => repository.getExercises({ includeArchived: true }),
    [],
  );

  const groups = useMemo(() => groupsState.data ?? [], [groupsState.data]);
  const groupName = useMemo(() => {
    const map = new Map(groups.map((g) => [g.id, g.name]));
    return (id: string) => map.get(id) ?? 'Unknown';
  }, [groups]);

  const visible = useMemo(() => {
    return filterExercises(exercisesState.data ?? [], {
      query,
      muscleGroupId: muscleFilter ?? undefined,
      includeArchived: showArchived,
    });
  }, [exercisesState.data, query, muscleFilter, showArchived]);

  async function handleSave(input: NewExerciseInput) {
    if (editing) {
      await repository.updateExercise(editing.id, input);
    } else {
      await repository.createExercise(input);
    }
    setCreating(false);
    setEditing(null);
    exercisesState.reload();
  }

  async function handleArchiveToggle(exercise: Exercise) {
    const updated = await repository.setExerciseArchived(exercise.id, !exercise.is_archived);
    setSelected(updated);
    exercisesState.reload();
  }

  return (
    <>
      <ScreenHeader
        title="Exercises"
        subtitle={`${exercisesState.data?.filter((e) => !e.is_archived).length ?? 0} in your library`}
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Custom
          </Button>
        }
      />

      <div className="space-y-3 p-4">
        <TextField
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          aria-label="Search exercises"
        />

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={muscleFilter === null} onClick={() => setMuscleFilter(null)}>
            All
          </Chip>
          {groups.map((g) => (
            <Chip key={g.id} active={muscleFilter === g.id} onClick={() => setMuscleFilter(g.id)}>
              {g.name}
            </Chip>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="accent-beat"
          />
          Show archived
        </label>
      </div>

      {exercisesState.loading || groupsState.loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No exercises found"
          note="Try a different search, or add a custom exercise."
        />
      ) : (
        <ul className="divide-y divide-slate-800 border-t border-slate-800">
          {visible.map((ex) => (
            <li key={ex.id}>
              <button
                onClick={() => setSelected(ex)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-900"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{ex.name}</span>
                    {ex.is_custom && (
                      <span className=" bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        custom
                      </span>
                    )}
                    {ex.is_archived && (
                      <span className=" bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                        archived
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">
                    {groupName(ex.primary_muscle_group_id)} · {titleCase(ex.equipment)}
                  </div>
                </div>
                <span className="text-slate-600">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <ExerciseDetail
          exercise={selected}
          groupName={groupName}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onArchiveToggle={() => handleArchiveToggle(selected)}
        />
      )}

      {(creating || editing) && (
        <ExerciseForm
          groups={groups}
          initial={editing}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function ExerciseDetail({
  exercise,
  groupName,
  onClose,
  onEdit,
  onArchiveToggle,
}: {
  exercise: Exercise;
  groupName: (id: string) => string;
  onClose: () => void;
  onEdit: () => void;
  onArchiveToggle: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Modal
      title={exercise.name}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="danger" onClick={onArchiveToggle}>
            {exercise.is_archived ? 'Unarchive' : 'Archive'}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(`/history/${exercise.id}`)}>
              History
            </Button>
            {exercise.is_custom && (
              <Button variant="secondary" onClick={onEdit}>
                Edit
              </Button>
            )}
          </div>
        </div>
      }
    >
      <dl className="space-y-3 text-sm">
        <Row label="Primary muscle" value={groupName(exercise.primary_muscle_group_id)} />
        {exercise.secondary_muscle_group_ids.length > 0 && (
          <Row
            label="Secondary"
            value={exercise.secondary_muscle_group_ids.map(groupName).join(', ')}
          />
        )}
        <Row label="Equipment" value={titleCase(exercise.equipment)} />
        <Row label="Movement" value={titleCase(exercise.movement_type)} />
        <Row label="Type" value={exercise.is_compound ? 'Compound' : 'Isolation'} />
        {exercise.instructions && (
          <div>
            <dt className="text-xs font-medium text-slate-400">Instructions</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-200">{exercise.instructions}</dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="text-right text-slate-200">{value}</dd>
    </div>
  );
}

function ExerciseForm({
  groups,
  initial,
  onCancel,
  onSave,
}: {
  groups: MuscleGroup[];
  initial: Exercise | null;
  onCancel: () => void;
  onSave: (input: NewExerciseInput) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [primary, setPrimary] = useState(initial?.primary_muscle_group_id ?? groups[0]?.id ?? '');
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'barbell');
  const [movement, setMovement] = useState<MovementType>(initial?.movement_type ?? 'push');
  const [isCompound, setIsCompound] = useState(initial?.is_compound ?? false);
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && primary.length > 0 && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        primary_muscle_group_id: primary,
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
      title={initial ? 'Edit exercise' : 'New custom exercise'}
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={submit}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <SelectField label="Primary muscle group" value={primary} onChange={setPrimary}>
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
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={isCompound}
            onChange={(e) => setIsCompound(e.target.checked)}
            className="accent-beat"
          />
          Compound movement
        </label>
        <TextAreaField
          label="Instructions (optional)"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>
    </Modal>
  );
}
