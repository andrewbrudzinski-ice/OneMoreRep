import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, EmptyState, Modal, Spinner, TextField } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { formatNumber } from '../lib/format';
import type { Food } from '../types';
import type { NewFoodInput } from '../repository/Repository';

export function FoodsScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);

  const state = useAsync(() => repository.getFoods(), []);
  const q = query.trim().toLowerCase();
  const foods = useMemo(
    () => (state.data ?? []).filter((f) => f.name.toLowerCase().includes(q)),
    [state.data, q],
  );

  async function save(input: NewFoodInput) {
    if (editing) await repository.updateFood(editing.id, input);
    else await repository.createFood(input);
    setEditing(null);
    setCreating(false);
    state.reload();
  }

  async function remove(food: Food) {
    if (!confirm(`Delete "${food.name}"? Past logs keep their snapshot.`)) return;
    await repository.deleteFood(food.id);
    state.reload();
  }

  return (
    <>
      <ScreenHeader
        title="Foods"
        subtitle="Your custom food library"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/nutrition')}>
              Done
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              + New
            </Button>
          </div>
        }
      />

      <div className="p-4">
        <TextField
          placeholder="Search foods…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search foods"
        />
      </div>

      {state.loading ? (
        <Spinner />
      ) : foods.length === 0 ? (
        <EmptyState
          icon="🥗"
          title="No foods yet"
          note="Add the foods you eat often — each entry snapshots its macros when you log it."
        />
      ) : (
        <ul className="divide-y divide-slate-800 border-t border-slate-800">
          {foods.map((food) => (
            <li key={food.id} className="flex items-center gap-3 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(food)}>
                <div className="truncate font-medium">{food.name}</div>
                <div className="text-xs text-slate-500 tabular-nums">
                  {formatNumber(food.calories)} cal · {food.protein}p {food.carbs}c {food.fat}f ·{' '}
                  {food.serving_size}
                  {food.serving_unit}
                </div>
              </button>
              <button
                onClick={() => remove(food)}
                className="h-8 w-8 shrink-0 text-slate-600 hover:text-fatigued"
                aria-label="Delete food"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <FoodForm
          initial={editing}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
    </>
  );
}

function FoodForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Food | null;
  onCancel: () => void;
  onSave: (input: NewFoodInput) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [servingSize, setServingSize] = useState(String(initial?.serving_size ?? 100));
  const [servingUnit, setServingUnit] = useState(initial?.serving_unit ?? 'g');
  const [calories, setCalories] = useState(String(initial?.calories ?? ''));
  const [protein, setProtein] = useState(String(initial?.protein ?? ''));
  const [carbs, setCarbs] = useState(String(initial?.carbs ?? ''));
  const [fat, setFat] = useState(String(initial?.fat ?? ''));
  const [fiber, setFiber] = useState(String(initial?.fiber ?? ''));
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;
  const num = (s: string) => (s.trim() === '' ? 0 : Number(s)) || 0;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        serving_size: num(servingSize) || 1,
        serving_unit: servingUnit.trim() || 'serving',
        calories: num(calories),
        protein: num(protein),
        carbs: num(carbs),
        fat: num(fat),
        fiber: num(fiber),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={initial ? 'Edit food' : 'New food'}
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
      <div className="space-y-3">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Serving size"
            type="number"
            inputMode="decimal"
            value={servingSize}
            onChange={(e) => setServingSize(e.target.value)}
          />
          <TextField
            label="Serving unit"
            value={servingUnit}
            onChange={(e) => setServingUnit(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">Macros are per serving.</p>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Calories" value={calories} onChange={setCalories} />
          <NumField label="Protein (g)" value={protein} onChange={setProtein} />
          <NumField label="Carbs (g)" value={carbs} onChange={setCarbs} />
          <NumField label="Fat (g)" value={fat} onChange={setFat} />
          <NumField label="Fiber (g)" value={fiber} onChange={setFiber} />
        </div>
      </div>
    </Modal>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextField
      label={label}
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
