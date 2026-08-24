import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { Button, ErrorState, Modal, Spinner, TextField } from '../components/ui';
import {
  ChevronRight,
  KpiValue,
  Panel,
  PanelHeader,
  ProgressBar,
  SectionHeader,
} from '../components/primitives';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { useAnimationProgress } from '../hooks/useAnimationProgress';
import { todayDateString } from '../lib/id';
import { entryTotals } from '../lib/nutrition';
import { formatNumber } from '../lib/format';
import { searchFoods, lookupBarcode } from '../lib/foodApi';
import type { FoodSearchResult } from '../lib/foodSearch';

const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'));
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
          <div className="flex gap-1.5">
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
        <PageBody>
          <CaloriesPanel totals={day.totals} settings={settings} p={p} />

          {/* Library shortcuts — open row on the ground */}
          <div className="grid grid-cols-2 gap-3">
            <LibraryButton label="Foods" onClick={() => navigate('/nutrition/foods')} />
            <LibraryButton label="Meals" onClick={() => navigate('/nutrition/meals')} />
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
        </PageBody>
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
      className="flex h-[34px] w-[34px] items-center justify-center rounded-control border border-line text-lg text-ink2 transition-colors hover:border-line-strong hover:text-ink disabled:cursor-default disabled:border-hairline disabled:text-ink5 disabled:hover:text-ink5"
    >
      {children}
    </button>
  );
}

function LibraryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-control border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong"
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink">{label}</span>
      <ChevronRight className="h-4 w-4 text-ink4" />
    </button>
  );
}

function CaloriesPanel({
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
    <Panel feature className="p-5">
      <PanelHeader label="Calories today" />
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <KpiValue
          value={formatNumber(calories)}
          target={target !== null ? formatNumber(target) : undefined}
          unit="cal"
          size="text-[46px]"
        />
        {target !== null && (
          <div className="mb-2 text-right text-[11px] font-semibold text-ink2">
            {met ? (
              <span className="text-accent">Target met</span>
            ) : (
              <>
                <span className="tabular-nums text-ink">{formatNumber(remaining)}</span> left
              </>
            )}
          </div>
        )}
      </div>

      {target !== null && <ProgressBar ratio={ratio} p={p} height="h-2" className="mt-3.5" />}

      <div className="mt-4 space-y-2">
        <MacroRow label="Protein" value={totals.protein} target={settings.protein_target} p={p} />
        <MacroRow label="Carbs" value={totals.carbs} target={settings.carb_target} p={p} />
        <MacroRow label="Fat" value={totals.fat} target={settings.fat_target} p={p} />
        <MacroRow label="Fiber" value={totals.fiber} target={settings.fiber_target} p={p} faint />
      </div>
    </Panel>
  );
}

function MacroRow({
  label,
  value,
  target,
  p,
  faint = false,
}: {
  label: string;
  value: number;
  target: number | null;
  p: number;
  faint?: boolean;
}) {
  const met = target !== null && value >= target;
  const ratio = target ? Math.min(1, value / target) : 0;
  return (
    <div className="grid grid-cols-[64px_1fr_84px] items-center gap-3 rounded-tile border border-hairline bg-surface2 px-3 py-2">
      <div
        className={`text-[9.5px] font-bold uppercase tracking-[0.11em] ${faint ? 'text-ink3' : 'text-ink2'}`}
      >
        {label}
      </div>
      <ProgressBar ratio={ratio} p={p} tone={faint ? 'faint' : met ? 'accent' : 'muted'} height="h-1.5" />
      <div className="text-right text-[12.5px] tabular-nums">
        <span className={`font-extrabold ${faint ? 'text-ink2' : 'text-ink'}`}>{Math.round(value * p)}</span>
        <span className="text-ink3">{target !== null ? ` / ${target}g` : 'g'}</span>
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
    <section className="pt-1">
      <SectionHeader
        label={label}
        action={
          <span
            className={`text-[11px] font-bold tabular-nums ${sectionCalories > 0 ? 'text-ink2' : 'text-ink4'}`}
          >
            {formatNumber(Math.round(sectionCalories))} cal
          </span>
        }
      />

      {entries.length === 0 ? (
        <p className="mt-2 text-[11.5px] text-ink4">Nothing logged yet.</p>
      ) : (
        <ul className="mt-1">
          {entries.map((entry) => {
            const totals = entryTotals(entry);
            return (
              <li key={entry.id}>
                <button
                  onClick={() => onEdit(entry)}
                  className="flex w-full items-center gap-2 border-t border-hairline py-2.5 text-left transition-colors first:border-t-0 hover:bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink">{entry.name_snapshot}</div>
                    <div className="mt-0.5 text-[10.5px] tabular-nums text-ink3">
                      {formatNumber(Math.round(totals.calories))} cal · {Math.round(totals.protein)}p{' '}
                      {Math.round(totals.carbs)}c {Math.round(totals.fat)}f
                    </div>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-ink2">×{entry.servings}</span>
                  <ChevronRight className="h-[14px] w-[14px] shrink-0 text-ink4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={onAdd}
        className="mt-2 text-[10px] font-bold uppercase tracking-[0.13em] text-accent hover:text-accent-hover"
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
            className="h-9 w-9 rounded-control border border-line bg-surface2 text-lg text-ink2 hover:border-line-strong hover:text-ink"
            aria-label="Fewer servings"
          >
            −
          </button>
          <span className="w-10 text-center text-lg font-extrabold tabular-nums text-ink">{servings}</span>
          <button
            onClick={() => step(0.5)}
            className="h-9 w-9 rounded-control border border-line bg-surface2 text-lg text-ink2 hover:border-line-strong hover:text-ink"
            aria-label="More servings"
          >
            +
          </button>
        </div>
      </div>
    </Modal>
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

  // Barcode scanning.
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  async function handleScanned(code: string) {
    setScanning(false);
    setLooking(true);
    setScanError(null);
    try {
      const result = await lookupBarcode(code);
      if (result) {
        onAddSearchResult(result); // imports + logs + closes the sheet
      } else {
        setScanError(`No macros found for barcode ${code}. Try searching by name.`);
      }
    } catch {
      setScanError('Barcode lookup failed — check your connection and try again.');
    } finally {
      setLooking(false);
    }
  }

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
        <div className="grid grid-cols-3 gap-1.5">
          {ADD_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-control py-2 text-sm font-bold transition-colors ${
                tab === t.key
                  ? 'bg-accent text-on-accent'
                  : 'border border-line bg-surface2 text-ink2 hover:text-ink'
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
          <>
            <button
              onClick={() => {
                setScanError(null);
                setScanning(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-control border border-line py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-line-strong hover:bg-surface2"
            >
              <BarcodeIcon className="h-4 w-4" />
              Scan barcode
            </button>
            {scanError && <p className="text-center text-[12px] text-fatigued">{scanError}</p>}
            {looking ? (
              <Spinner />
            ) : (
              <SearchResults
                query={trimmed}
                results={results}
                loading={searching}
                error={searchError}
                onPick={onAddSearchResult}
              />
            )}
          </>
        ) : tab === 'food' ? (
          foods.loading ? (
            <Spinner />
          ) : filteredFoods.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink3">
              No foods yet. Add one from Search, or create it in the Foods library.
            </p>
          ) : (
            <ul className="max-h-[45vh] divide-y divide-hairline overflow-y-auto">
              {filteredFoods.map((food) => (
                <li key={food.id}>
                  <button
                    onClick={() => onAddFood(food)}
                    className="flex w-full items-center justify-between px-1 py-3 text-left hover:bg-white/[0.03]"
                  >
                    <span className="text-sm text-ink">{food.name}</span>
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
          <ul className="max-h-[45vh] divide-y divide-hairline overflow-y-auto">
            {filteredMeals.map((meal) => (
              <li key={meal.id}>
                <button
                  onClick={() => onAddMeal(meal)}
                  className="w-full px-1 py-3 text-left text-sm text-ink hover:bg-white/[0.03]"
                >
                  {meal.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner onDetected={handleScanned} onClose={() => setScanning(false)} />
        </Suspense>
      )}
    </Modal>
  );
}

function BarcodeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14" strokeLinecap="round" />
    </svg>
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
    <ul className="max-h-[45vh] divide-y divide-hairline overflow-y-auto">
      {results.map((r) => (
        <li key={r.key}>
          <button
            onClick={() => onPick(r)}
            className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-white/[0.03]"
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
