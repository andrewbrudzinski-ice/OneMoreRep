import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, ErrorState, Modal, Spinner, TextField } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { useAnimationProgress } from '../hooks/useAnimationProgress';
import { todayDateString } from '../lib/id';
import { entryTotals } from '../lib/nutrition';
import { formatNumber } from '../lib/format';
import { searchFoods } from '../lib/foodApi';
import type { FoodSearchResult } from '../lib/foodSearch';
import type { Food, Meal, MealType, Settings } from '../types';
import type { FoodEntryWithFood, NutritionDay } from '../repository/Repository';

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
  const [editing, setEditing] = useState<FoodEntryWithFood | null>(null);

  const state = useAsync(async () => {
    const [day, settings] = await Promise.all([
      repository.getNutritionDay(date),
      repository.getSettings(),
    ]);
    return { day, settings };
  }, [date]);

  const p = useAnimationProgress(state.data);

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

  // Import a food-database result into the local library, then log it.
  async function addSearchResult(result: FoodSearchResult, mealType: MealType) {
    const food = await repository.createFood(result.food);
    await repository.addFoodEntry(date, { food_id: food.id, meal_type: mealType, servings: 1 });
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
  const atToday = date >= todayDateString();

  return (
    <>
      <ScreenHeader
        kicker={prettyDate(date)}
        title="Nutrition"
        action={
          <div className="flex gap-0.5">
            <StepButton label="Previous day" onClick={() => setDate((d) => shiftDate(d, -1))}>
              ‹
            </StepButton>
            <StepButton label="Next day" onClick={() => setDate((d) => shiftDate(d, 1))} disabled={atToday}>
              ›
            </StepButton>
          </div>
        }
      />

      {state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : !day || !settings ? (
        <Spinner />
      ) : (
        <>
          <CaloriesBlock totals={day.totals} settings={settings} p={p} />

          {/* Foods / Meals */}
          <div className="grid grid-cols-2 gap-0.5 border-b-2 border-white/[0.15] bg-white/[0.15]">
            <button
              onClick={() => navigate('/nutrition/foods')}
              className="bg-ground px-5 py-[15px] text-left text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-surface"
            >
              Foods
            </button>
            <button
              onClick={() => navigate('/nutrition/meals')}
              className="bg-ground px-5 py-[15px] text-left text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-surface"
            >
              Meals
            </button>
          </div>

          {MEALS.map(({ type, label }) => (
            <MealSection
              key={type}
              label={label}
              entries={day.byMeal[type]}
              onAdd={() => setAddTo(type)}
              onEdit={setEditing}
            />
          ))}
        </>
      )}

      {addTo && (
        <AddEntrySheet
          mealLabel={MEALS.find((m) => m.type === addTo)?.label ?? ''}
          onClose={() => setAddTo(null)}
          onAddFood={(food) => addFood(food, addTo)}
          onAddMeal={(meal) => addMeal(meal, addTo)}
          onAddSearchResult={(result) => addSearchResult(result, addTo)}
        />
      )}

      {editing && (
        <ServingsEditor
          entry={editing}
          onClose={() => setEditing(null)}
          onChange={(servings) => {
            void changeServings(editing, servings);
          }}
          onRemove={() => {
            void removeEntry(editing);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-[34px] w-[34px] items-center justify-center border border-white/[0.18] text-lg text-ink transition-colors hover:bg-surface disabled:cursor-default disabled:border-white/[0.08] disabled:text-ink5 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function CaloriesBlock({
  totals,
  settings,
  p,
}: {
  totals: NutritionDay['totals'];
  settings: Settings;
  p: number;
}) {
  const target = settings.calorie_target;
  const calories = Math.round(totals.calories * p);
  const ratio = target ? Math.min(1, totals.calories / target) : 0;
  const remaining = target ? Math.max(0, Math.round(target - totals.calories)) : 0;
  const met = target !== null && totals.calories >= target;

  return (
    <section className="border-b-2 border-white/[0.15] bg-surface px-5 py-5">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">Calories</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[52px] font-extrabold leading-[0.88] tracking-[-0.045em] tabular-nums text-ink">
          {formatNumber(calories)}
        </span>
        {target !== null && (
          <span className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink3">
            / {formatNumber(target)}
          </span>
        )}
      </div>

      {target !== null && (
        <>
          <div className="mt-3 h-2 bg-ground">
            <div className="h-full bg-accent" style={{ width: `${(ratio * p * 100).toFixed(1)}%` }} />
          </div>
          <div className="mt-1 text-[10.5px] text-ink4">
            {met ? 'Target met' : `${formatNumber(remaining)} left`}
          </div>
        </>
      )}

      <div className="mt-3">
        <MacroRow label="Protein" value={totals.protein} target={settings.protein_target} p={p} />
        <MacroRow label="Carbs" value={totals.carbs} target={settings.carb_target} p={p} />
        <MacroRow label="Fat" value={totals.fat} target={settings.fat_target} p={p} />
        <MacroRow label="Fiber" value={totals.fiber} target={settings.fiber_target} p={p} fiber />
      </div>
    </section>
  );
}

function MacroRow({
  label,
  value,
  target,
  p,
  fiber,
}: {
  label: string;
  value: number;
  target: number | null;
  p: number;
  fiber?: boolean;
}) {
  const met = target !== null && value >= target;
  const ratio = target ? Math.min(1, value / target) : 0;
  return (
    <div className="grid grid-cols-[64px_1fr_88px] items-center gap-3 border-t border-white/[0.08] py-[11px]">
      <div
        className={`text-[9.5px] font-extrabold uppercase tracking-[0.13em] ${fiber ? 'text-ink4' : 'text-ink2'}`}
      >
        {label}
      </div>
      <div className={`bg-ground ${fiber ? 'h-0.5' : 'h-1'}`}>
        <div
          className={`h-full ${fiber ? 'bg-ink5' : met ? 'bg-accent' : 'bg-accent-muted'}`}
          style={{ width: `${(ratio * p * 100).toFixed(1)}%` }}
        />
      </div>
      <div className={`text-right tabular-nums ${fiber ? 'text-[11.5px] text-ink3' : 'text-[13px]'}`}>
        <span className={fiber ? '' : 'font-extrabold text-ink'}>{Math.round(value * p)}</span>
        <span className={fiber ? '' : 'text-ink3'}>{target !== null ? ` / ${target}g` : 'g'}</span>
      </div>
    </div>
  );
}

function MealSection({
  label,
  entries,
  onAdd,
  onEdit,
}: {
  label: string;
  entries: FoodEntryWithFood[];
  onAdd: () => void;
  onEdit: (entry: FoodEntryWithFood) => void;
}) {
  const sectionCalories = entries.reduce((sum, e) => sum + entryTotals(e).calories, 0);
  return (
    <section className="border-b border-white/[0.08]">
      <div className="flex items-center justify-between px-5 pb-1 pt-[15px]">
        <h2 className="text-[14px] font-extrabold text-ink">{label}</h2>
        <span
          className={`text-[11px] font-extrabold tabular-nums ${sectionCalories > 0 ? 'text-ink2' : 'text-ink4'}`}
        >
          {formatNumber(Math.round(sectionCalories))} cal
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-1.5 text-[11.5px] text-ink4">Nothing logged yet.</p>
      ) : (
        <ul>
          {entries.map((entry) => {
            const totals = entryTotals(entry);
            return (
              <li key={entry.id}>
                <button
                  onClick={() => onEdit(entry)}
                  className="flex w-full items-center gap-2 border-t border-white/[0.05] px-5 py-[9px] text-left transition-colors hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink">{entry.name_snapshot}</div>
                    <div className="text-[10.5px] tabular-nums text-ink3">
                      {formatNumber(Math.round(totals.calories))} cal · {Math.round(totals.protein)}p{' '}
                      {Math.round(totals.carbs)}c {Math.round(totals.fat)}f
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold tabular-nums text-ink2">
                    ×{entry.servings}
                  </span>
                  <ChevronRight className="h-[14px] w-[14px] shrink-0 text-ink4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={onAdd}
        className="px-5 py-[11px] text-[10px] font-extrabold uppercase tracking-[0.13em] text-accent hover:text-accent-hover"
      >
        + Add to {label.toLowerCase()}
      </button>
    </section>
  );
}

function ServingsEditor({
  entry,
  onClose,
  onChange,
  onRemove,
}: {
  entry: FoodEntryWithFood;
  onClose: () => void;
  onChange: (servings: number) => void;
  onRemove: () => void;
}) {
  const [servings, setServings] = useState(entry.servings);
  const step = (delta: number) => {
    const next = Math.max(0.5, Math.round((servings + delta) * 100) / 100);
    setServings(next);
    onChange(next);
  };
  return (
    <Modal
      title={entry.name_snapshot}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <Button variant="danger" onClick={onRemove}>
            Remove
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink2">Servings</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => step(-0.5)}
            className="h-9 w-9 bg-slate-800 text-lg text-ink hover:bg-slate-700"
            aria-label="Fewer servings"
          >
            −
          </button>
          <span className="w-10 text-center text-lg font-extrabold tabular-nums">{servings}</span>
          <button
            onClick={() => step(0.5)}
            className="h-9 w-9 bg-slate-800 text-lg text-ink hover:bg-slate-700"
            aria-label="More servings"
          >
            +
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const ADD_TABS = [
  { key: 'search', label: 'Search' },
  { key: 'food', label: 'Library' },
  { key: 'meal', label: 'Meals' },
] as const;
type AddTab = (typeof ADD_TABS)[number]['key'];

function AddEntrySheet({
  mealLabel,
  onClose,
  onAddFood,
  onAddMeal,
  onAddSearchResult,
}: {
  mealLabel: string;
  onClose: () => void;
  onAddFood: (food: Food) => void;
  onAddMeal: (meal: Meal) => void;
  onAddSearchResult: (result: FoodSearchResult) => void;
}) {
  const repository = useRepository();
  const [tab, setTab] = useState<AddTab>('search');
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

  // Online database search (debounced, cancelable) for the Search tab.
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (tab !== 'search') return;
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      searchFoods(trimmed, controller.signal)
        .then((r) => {
          setResults(r);
          setSearching(false);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setSearchError(e instanceof Error ? e.message : 'Search failed');
          setSearching(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tab, trimmed]);

  return (
    <Modal title={`Add to ${mealLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-0.5">
          {ADD_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-2 text-sm font-extrabold ${
                tab === t.key ? 'bg-accent text-on-accent' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <TextField
          placeholder={tab === 'search' ? 'Search foods online…' : 'Search…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Search"
        />

        {tab === 'search' ? (
          <SearchResults
            query={trimmed}
            results={results}
            loading={searching}
            error={searchError}
            onPick={onAddSearchResult}
          />
        ) : tab === 'food' ? (
          foods.loading ? (
            <Spinner />
          ) : filteredFoods.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink3">
              No foods yet. Add one from Search, or create it in the Foods library.
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
                    <span className="text-xs text-ink3 tabular-nums">
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
          <p className="py-6 text-center text-sm text-ink3">
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

function SearchResults({
  query,
  results,
  loading,
  error,
  onPick,
}: {
  query: string;
  results: FoodSearchResult[];
  loading: boolean;
  error: string | null;
  onPick: (result: FoodSearchResult) => void;
}) {
  if (query.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-ink3">
        Type at least 2 letters to search USDA & Open Food Facts. Picking a result fills in the
        macros and saves it to your library.
      </p>
    );
  }
  if (loading) return <Spinner />;
  if (error) return <p className="py-6 text-center text-sm text-fatigued">{error}</p>;
  if (results.length === 0) {
    return <p className="py-6 text-center text-sm text-ink3">No matches — try a simpler name.</p>;
  }
  return (
    <ul className="max-h-[45vh] divide-y divide-slate-800 overflow-y-auto">
      {results.map((r) => (
        <li key={r.key}>
          <button
            onClick={() => onPick(r)}
            className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-slate-900"
          >
            <div className="min-w-0">
              <div className="truncate text-sm text-ink">{r.name}</div>
              <div className="truncate text-[11px] text-ink3">
                {r.brand ? `${r.brand} · ` : ''}
                {r.source === 'usda' ? 'USDA' : 'Open Food Facts'} · per 100 g
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-extrabold tabular-nums text-ink2">
                {formatNumber(r.food.calories)} cal
              </div>
              <div className="text-[10px] tabular-nums text-ink3">
                {r.food.protein}p {r.food.carbs}c {r.food.fat}f
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
