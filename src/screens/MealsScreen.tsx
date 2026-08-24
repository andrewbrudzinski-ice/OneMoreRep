import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { Panel } from '../components/primitives';
import { Button, EmptyState, Modal, Spinner, TextField } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { formatNumber } from '../lib/format';
import type { Food, Meal } from '../types';

export function MealsScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  const state = useAsync(async () => {
    const meals = await repository.getMeals();
    const details = await Promise.all(meals.map((m) => repository.getMealDetail(m.id)));
    return meals.map((meal, i) => ({ meal, detail: details[i] }));
  }, []);

  async function createAndEdit() {
    const meal = await repository.createMeal({ name: 'New Meal' });
    setEditingMealId(meal.id);
  }

  async function remove(meal: Meal) {
    if (!confirm(`Delete "${meal.name}"?`)) return;
    await repository.deleteMeal(meal.id);
    state.reload();
  }

  if (editingMealId) {
    return (
      <MealEditor
        mealId={editingMealId}
        onDone={() => {
          setEditingMealId(null);
          state.reload();
        }}
      />
    );
  }

  return (
    <>
      <ScreenHeader
        title="Meals"
        subtitle="Grouped foods for quick logging"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/nutrition')}>
              Done
            </Button>
            <Button variant="primary" onClick={createAndEdit}>
              + New
            </Button>
          </div>
        }
      />

      {state.loading ? (
        <Spinner />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No meals yet"
          note="Group foods you eat together — then quick-add the whole meal to any day."
        />
      ) : (
        <PageBody>
          {state.data?.map(({ meal, detail }) => (
            <Panel key={meal.id} className="p-4">
              <button className="w-full text-left" onClick={() => setEditingMealId(meal.id)}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{meal.name}</span>
                  <span className="text-xs tabular-nums text-ink2">
                    {detail ? `${formatNumber(Math.round(detail.totals.calories))} cal` : ''}
                  </span>
                </div>
                <div className="mt-1 text-sm text-ink2">
                  {detail?.items.length ?? 0} {detail?.items.length === 1 ? 'food' : 'foods'}
                </div>
              </button>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => setEditingMealId(meal.id)}>
                  Edit
                </Button>
                <Button variant="danger" className="ml-auto" onClick={() => remove(meal)}>
                  Delete
                </Button>
              </div>
            </Panel>
          ))}
        </PageBody>
      )}
    </>
  );
}

function MealEditor({ mealId, onDone }: { mealId: string; onDone: () => void }) {
  const repository = useRepository();
  const [picking, setPicking] = useState(false);

  const state = useAsync(() => repository.getMealDetail(mealId), [mealId]);

  async function saveName(name: string) {
    if (!name.trim()) return;
    await repository.updateMeal(mealId, { name: name.trim() });
    state.reload();
  }

  async function addFood(food: Food) {
    await repository.addMealItem(mealId, food.id, 1);
    setPicking(false);
    state.reload();
  }

  async function changeServings(itemId: string, servings: number) {
    if (servings <= 0) await repository.removeMealItem(itemId);
    else await repository.updateMealItem(itemId, servings);
    state.reload();
  }

  if (state.loading) return <Spinner />;
  const detail = state.data;
  if (!detail) {
    return (
      <div className="p-8 text-center">
        <p>Meal not found.</p>
        <Button className="mt-3" onClick={onDone}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <>
      <ScreenHeader
        title="Edit Meal"
        subtitle={`${formatNumber(Math.round(detail.totals.calories))} cal · ${Math.round(detail.totals.protein)}p ${Math.round(detail.totals.carbs)}c ${Math.round(detail.totals.fat)}f`}
        action={
          <Button variant="ghost" onClick={onDone}>
            Done
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <TextField
          label="Meal name"
          defaultValue={detail.meal.name}
          onBlur={(e) => saveName(e.target.value)}
        />

        <div className="space-y-2">
          {detail.items.length === 0 ? (
            <p className="text-sm text-ink3">No foods yet — add some below.</p>
          ) : (
            detail.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-tile border border-line bg-surface2 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{item.food?.name ?? 'Deleted food'}</div>
                  {item.food && (
                    <div className="text-xs tabular-nums text-ink3">
                      {formatNumber(Math.round(item.food.calories * item.servings))} cal
                    </div>
                  )}
                </div>
                <button
                  onClick={() => changeServings(item.id, Math.round((item.servings - 0.5) * 100) / 100)}
                  className="h-7 w-7 rounded-control border border-line text-ink2 hover:bg-surface3"
                  aria-label="Fewer servings"
                >
                  −
                </button>
                <span className="w-8 text-center text-xs tabular-nums text-ink">{item.servings}</span>
                <button
                  onClick={() => changeServings(item.id, Math.round((item.servings + 0.5) * 100) / 100)}
                  className="h-7 w-7 rounded-control border border-line text-ink2 hover:bg-surface3"
                  aria-label="More servings"
                >
                  +
                </button>
              </div>
            ))
          )}
        </div>

        <Button variant="secondary" className="w-full" onClick={() => setPicking(true)}>
          + Add food
        </Button>
      </PageBody>

      {picking && <FoodPicker onPick={addFood} onClose={() => setPicking(false)} />}
    </>
  );
}

function FoodPicker({ onPick, onClose }: { onPick: (food: Food) => void; onClose: () => void }) {
  const repository = useRepository();
  const [query, setQuery] = useState('');
  const state = useAsync(() => repository.getFoods(), []);
  const q = query.trim().toLowerCase();
  const foods = useMemo(
    () => (state.data ?? []).filter((f) => f.name.toLowerCase().includes(q)),
    [state.data, q],
  );

  return (
    <Modal title="Add food" onClose={onClose}>
      <div className="space-y-3">
        <TextField
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Search foods"
        />
        {state.loading ? (
          <Spinner />
        ) : foods.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink3">
            No foods yet. Create some in the Foods library first.
          </p>
        ) : (
          <ul className="max-h-[45vh] divide-y divide-hairline overflow-y-auto">
            {foods.map((food) => (
              <li key={food.id}>
                <button
                  onClick={() => onPick(food)}
                  className="w-full px-1 py-3 text-left text-sm text-ink hover:bg-white/[0.03]"
                >
                  {food.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
