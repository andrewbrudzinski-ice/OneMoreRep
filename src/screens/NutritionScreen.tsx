import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, ErrorState, Modal, Spinner, TextField } from '../components/ui';
import { MacroRings } from '../components/MacroRings';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { todayDateString } from '../lib/id';
import { entryTotals } from '../lib/nutrition';
import { formatNumber } from '../lib/format';
import type { Food, Meal, MealType } from '../types';
import type { FoodEntryWithFood } from '../repository/Repository';

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snacks' },
];

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return todayDateString(d);
}

function prettyDate(date: string): string {
  if (date === todayDateString()) return 'Today';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function NutritionScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const [date, setDate] = useState(() => todayDateString());
  const [addTo, setAddTo] = useState<MealType | null>(null);

  const state = useAsync(async () => {
    const [day, settings] = await Promise.all([
      repository.getNutritionDay(date),
      repository.getSettings(),
    ]);
    return { day, settings };
  }, [date]);

  async function addFood(food: Food, mealType: MealType) {
    await repository.addFoodEntry(date, { food_id: food.id, meal_type: mealType, servings: 1 });
    setAddTo(null);
    state.reload();
  }

  async function addMeal(meal: Meal, mealType: MealType) {
    await repository.addMealToDay(date, meal.id, mealType);
    setAddTo(null);
    state.reload();
  }

  async function changeServings(entry: FoodEntryWithFood, servings: number) {
    if (servings <= 0) {
      await repository.removeFoodEntry(entry.id);
    } else {
      await repository.updateFoodEntry(entry.id, { servings });
    }
    state.reload();
  }

  async function removeEntry(entry: FoodEntryWithFood) {
    await repository.removeFoodEntry(entry.id);
    state.reload();
  }

  const day = state.data?.day;
  const settings = state.data?.settings;

  return (
    <>
      <ScreenHeader
        title="Nutrition"
        subtitle={prettyDate(date)}
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate((d) => shiftDate(d, -1))}
              className="h-8 w-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              aria-label="Previous day"
            >
              ‹
            </button>
            <button
              onClick={() => setDate((d) => shiftDate(d, 1))}
              disabled={date >= todayDateString()}
              className="h-8 w-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              aria-label="Next day"
            >
              ›
            </button>
          </div>
        }
      />

      {state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : !day || !settings ? (
        <Spinner />
      ) : (
        <div className="space-y-4 p-4">
          <MacroRings totals={day.totals} settings={settings} />

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/nutrition/foods')}>
              Foods
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/nutrition/meals')}>
              Meals
            </Button>
          </div>

          {MEALS.map(({ type, label }) => (
            <MealSection
              key={type}
              label={label}
              entries={day.byMeal[type]}
              onAdd={() => setAddTo(type)}
              onServings={changeServings}
              onRemove={removeEntry}
            />
          ))}
        </div>
      )}

      {addTo && (
        <AddEntrySheet
          mealLabel={MEALS.find((m) => m.type === addTo)?.label ?? ''}
          onClose={() => setAddTo(null)}
          onAddFood={(food) => addFood(food, addTo)}
          onAddMeal={(meal) => addMeal(meal, addTo)}
        />
      )}
    </>
  );
}

function MealSection({
  label,
  entries,
  onAdd,
  onServings,
  onRemove,
}: {
  label: string;
  entries: FoodEntryWithFood[];
  onAdd: () => void;
  onServings: (entry: FoodEntryWithFood, servings: number) => void;
  onRemove: (entry: FoodEntryWithFood) => void;
}) {
  const sectionCalories = entries.reduce((sum, e) => sum + entryTotals(e).calories, 0);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-xs text-slate-500">{formatNumber(Math.round(sectionCalories))} cal</span>
      </div>
      {entries.length === 0 ? (
        <p className="py-1 text-xs text-slate-500">Nothing logged yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => {
            const totals = entryTotals(entry);
            return (
              <li key={entry.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{entry.name_snapshot}</div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {formatNumber(Math.round(totals.calories))} cal · {Math.round(totals.protein)}p{' '}
                    {Math.round(totals.carbs)}c {Math.round(totals.fat)}f
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onServings(entry, Math.round((entry.servings - 0.5) * 100) / 100)}
                    className="h-7 w-7 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700"
                    aria-label="Fewer servings"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-xs tabular-nums">{entry.servings}</span>
                  <button
                    onClick={() => onServings(entry, Math.round((entry.servings + 0.5) * 100) / 100)}
                    className="h-7 w-7 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700"
                    aria-label="More servings"
                  >
                    +
                  </button>
                  <button
                    onClick={() => onRemove(entry)}
                    className="h-7 w-6 text-slate-600 hover:text-red-400"
                    aria-label="Remove entry"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <button
        onClick={onAdd}
        className="mt-2 w-full rounded-lg border border-dashed border-slate-700 py-2 text-sm text-slate-400 hover:border-slate-500"
      >
        + Add to {label.toLowerCase()}
      </button>
    </section>
  );
}

function AddEntrySheet({
  mealLabel,
  onClose,
  onAddFood,
  onAddMeal,
}: {
  mealLabel: string;
  onClose: () => void;
  onAddFood: (food: Food) => void;
  onAddMeal: (meal: Meal) => void;
}) {
  const repository = useRepository();
  const [tab, setTab] = useState<'food' | 'meal'>('food');
  const [query, setQuery] = useState('');
  const foods = useAsync(() => repository.getFoods(), []);
  const meals = useAsync(() => repository.getMeals(), []);

  const q = query.trim().toLowerCase();
  const filteredFoods = useMemo(
    () => (foods.data ?? []).filter((f) => f.name.toLowerCase().includes(q)),
    [foods.data, q],
  );
  const filteredMeals = useMemo(
    () => (meals.data ?? []).filter((m) => m.name.toLowerCase().includes(q)),
    [meals.data, q],
  );

  return (
    <Modal title={`Add to ${mealLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['food', 'meal'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                tab === t ? 'bg-beat text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {t === 'food' ? 'Foods' : 'Saved meals'}
            </button>
          ))}
        </div>

        <TextField
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Search"
        />

        {tab === 'food' ? (
          foods.loading ? (
            <Spinner />
          ) : filteredFoods.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No foods yet. Create some in the Foods library.
            </p>
          ) : (
            <ul className="max-h-[45vh] divide-y divide-slate-800 overflow-y-auto">
              {filteredFoods.map((food) => (
                <li key={food.id}>
                  <button
                    onClick={() => onAddFood(food)}
                    className="flex w-full items-center justify-between px-1 py-3 text-left hover:bg-slate-900"
                  >
                    <span className="text-sm">{food.name}</span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {formatNumber(food.calories)} cal
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : meals.loading ? (
          <Spinner />
        ) : filteredMeals.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No saved meals yet. Create some in the Meals library.
          </p>
        ) : (
          <ul className="max-h-[45vh] divide-y divide-slate-800 overflow-y-auto">
            {filteredMeals.map((meal) => (
              <li key={meal.id}>
                <button
                  onClick={() => onAddMeal(meal)}
                  className="w-full px-1 py-3 text-left text-sm hover:bg-slate-900"
                >
                  {meal.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
