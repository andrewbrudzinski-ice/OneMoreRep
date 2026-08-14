import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, ErrorState, Modal, Spinner, TextField } from '../components/ui';
import { Sparkline } from '../components/Sparkline';
import { ReadinessCard } from '../components/ReadinessCard';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { useAnimationProgress } from '../hooks/useAnimationProgress';
import { todayDateString } from '../lib/id';
import { formatDecimal, formatNumber, PR_TYPE_LABELS } from '../lib/format';
import type { DashboardData } from '../repository/Repository';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HomeScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const [weighIn, setWeighIn] = useState(false);

  const state = useAsync<DashboardData>(() => repository.getDashboardData(), []);

  // Real exercise/set counts for the suggested routine (no active session).
  const routineId = state.data?.activeWorkout ? undefined : state.data?.suggestedRoutine?.id;
  const detail = useAsync(
    () => (routineId ? repository.getRoutineDetail(routineId) : Promise.resolve(undefined)),
    [routineId],
  );

  // One shared 0→1 pass drives every counting number and bar in sync.
  const p = useAnimationProgress(state.data);

  async function startSuggested() {
    const data = state.data;
    if (!data) return;
    if (data.activeWorkout) {
      navigate(`/session/${data.activeWorkout.id}`);
      return;
    }
    if (data.suggestedRoutine) {
      const workout = await repository.startWorkout({
        name: data.suggestedRoutine.name,
        routine_id: data.suggestedRoutine.id,
      });
      navigate(`/session/${workout.id}`);
    } else {
      navigate('/workout');
    }
  }

  if (state.error) {
    return (
      <>
        <ScreenHeader kicker="Chase green" title="Home" />
        <ErrorState error={state.error} onRetry={state.reload} />
      </>
    );
  }
  if (state.loading || !state.data) {
    return (
      <>
        <ScreenHeader kicker="Chase green" title="Home" />
        <Spinner />
      </>
    );
  }

  const d = state.data;
  const unit = d.settings.units;
  const anim = (n: number) => Math.round(n * p);

  const routineDetail = detail.data;
  const exerciseCount = routineDetail?.items.length ?? 0;
  const setCount = routineDetail?.items.reduce((sum, it) => sum + (it.target_sets ?? 0), 0) ?? 0;

  const workoutTitle = d.activeWorkout
    ? `${d.activeWorkout.name} — in progress`
    : (d.suggestedRoutine?.name ?? 'Start a session');
  const workoutMeta =
    !d.activeWorkout && d.suggestedRoutine && routineDetail
      ? `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}`
      : null;
  const routineNotes = !d.activeWorkout ? (d.suggestedRoutine?.notes ?? '') : '';

  // Weekly volume chart.
  const volume = d.volumeSparkline;
  const volumePeak = Math.max(...volume, 0); // true peak for the caption
  const volumeMax = Math.max(volumePeak, 1); // bar-scale denominator (avoid /0)
  const todayDow = new Date().getDay();

  return (
    <>
      <ScreenHeader kicker="Chase green" title={`Hey, ${d.userName}`} />

      {/* Readiness — the poster element */}
      <div className="border-b-2 border-white/[0.15]">
        <ReadinessCard readiness={d.readiness} />
      </div>

      {/* Today's workout — the strongest CTA */}
      <section className="grid grid-cols-[1fr_108px] border-b-2 border-white/[0.15]">
        <div className="py-[18px] pl-5 pr-4">
          <MicroLabel>Today's workout</MicroLabel>
          <div className="mt-1.5 text-[23px] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
            {workoutTitle}
          </div>
          {workoutMeta && <div className="mt-1 text-[12.5px] text-ink2">{workoutMeta}</div>}
          {routineNotes && <div className="mt-0.5 text-[12.5px] text-ink3">{routineNotes}</div>}
        </div>
        <button
          onClick={startSuggested}
          className="flex h-full flex-col items-start justify-between bg-accent px-4 py-[18px] text-left transition-colors hover:bg-accent-hover active:bg-accent-press"
        >
          <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-on-accent">
            {d.activeWorkout ? 'Resume' : 'Start'}
          </span>
          <ArrowRight className="h-[22px] w-[22px] text-on-accent" />
        </button>
      </section>

      {/* This week */}
      <section className="border-b-2 border-white/[0.15] pb-[18px]">
        <div className="grid grid-cols-3 pt-[18px]">
          <Metric label="Workouts" value={String(anim(d.week.workoutsThisWeek))} first />
          <Metric label="Day streak" value={String(anim(d.week.streak))} />
          <Metric label="Volume lbs" value={formatNumber(anim(d.weeklyVolume))} />
        </div>

        {/* 7-day volume chart */}
        <div className="relative mx-5 mt-4 h-[92px] border-b-[1.5px] border-t border-b-white/[0.16] border-t-white/[0.08]">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.05]" />
          <div className="grid h-full grid-cols-7 items-end gap-1.5">
            {volume.map((v, i) => {
              const pct = v > 0 ? Math.max(3, (v / volumeMax) * 92) : 1.6;
              return (
                <div
                  key={i}
                  className={v > 0 ? 'bg-accent' : 'bg-surface2'}
                  style={{ height: `${(pct * p).toFixed(2)}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Day letters */}
        <div className="mx-5 mt-2 grid grid-cols-7 gap-1.5">
          {volume.map((v, i) => {
            const isToday = i === 6;
            const letter = DAY_LETTERS[(todayDow - (6 - i) + 700) % 7];
            const color = isToday ? 'text-ink' : v > 0 ? 'text-ink2' : 'text-ink4';
            return (
              <div key={i} className={`text-center text-[9.5px] font-extrabold ${color}`}>
                {letter}
              </div>
            );
          })}
        </div>

        <p className="mx-5 mt-2 text-[11px] text-ink3">
          Working volume, last 7 days · peak {formatNumber(volumePeak)} {unit}
        </p>
      </section>

      {/* Nutrition today */}
      <NutritionToday totals={d.todayTotals} settings={d.settings} p={p} onLog={() => navigate('/nutrition')} />

      {/* Bodyweight */}
      <section className="border-b-2 border-white/[0.15] px-5 py-[18px]">
        <div className="flex items-center justify-between">
          <MicroLabel>Bodyweight</MicroLabel>
          <AccentLink onClick={() => setWeighIn(true)}>+ Weigh in</AccentLink>
        </div>
        {d.bodyweight.latest ? (
          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className="text-[30px] font-extrabold leading-none tabular-nums text-ink">
                {formatDecimal(d.bodyweight.latest.weight)}{' '}
                <span className="text-[13px] font-normal text-ink3">{unit}</span>
              </div>
              {d.bodyweight.changeFromStart !== null && (
                <div className="mt-1 text-[11.5px] text-ink2">
                  {d.bodyweight.changeFromStart >= 0 ? '+' : ''}
                  {formatDecimal(d.bodyweight.changeFromStart)} {unit} overall
                </div>
              )}
            </div>
            <Sparkline
              values={d.bodyweight.sparkline}
              color="#8FE81E"
              width={132}
              height={44}
              strokeWidth={1.75}
            />
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink3">No weigh-ins yet. Tap “+ Weigh in”.</p>
        )}
      </section>

      {/* Recent PRs */}
      <section className="border-b-2 border-white/[0.15] px-5 py-[18px]">
        <div className="flex items-center justify-between">
          <MicroLabel>Recent PRs</MicroLabel>
          <AccentLink onClick={() => navigate('/progress')}>All</AccentLink>
        </div>
        {d.recentPRs.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-ink3">Finish a workout to earn PRs.</p>
        ) : (
          <ul className="mt-1">
            {d.recentPRs.slice(0, 3).map(({ record, exerciseName }) => (
              <li
                key={record.id}
                className="flex items-center justify-between gap-3 border-t border-white/[0.08] py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-ink">{exerciseName}</div>
                  <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.13em] text-ink3">
                    {PR_TYPE_LABELS[record.pr_type]}
                  </div>
                </div>
                <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-accent">
                  {record.pr_type === 'estimated_1rm'
                    ? formatDecimal(record.value)
                    : formatNumber(record.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Muscle volume map */}
      <button
        onClick={() => navigate('/progress')}
        className="flex w-full items-center justify-between px-5 py-[17px] text-left transition-colors hover:bg-surface"
      >
        <div>
          <div className="text-[13px] font-extrabold text-ink">Muscle volume map</div>
          <div className="mt-0.5 text-[11.5px] text-ink3">This week, by muscle group</div>
        </div>
        <ChevronRight className="h-[18px] w-[18px] text-ink4" />
      </button>

      {weighIn && (
        <WeighInModal
          defaultWeight={d.bodyweight.latest?.weight ?? 0}
          unit={unit}
          onClose={() => setWeighIn(false)}
          onSave={async (weight) => {
            await repository.addBodyWeightEntry({ date: todayDateString(), weight });
            setWeighIn(false);
            state.reload();
          }}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Building blocks                                                            */
/* -------------------------------------------------------------------------- */

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
      {children}
    </span>
  );
}

function AccentLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-accent hover:text-accent-hover"
    >
      {children}
    </button>
  );
}

function Metric({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div className={`px-3 ${first ? '' : 'border-l border-white/[0.08]'}`}>
      <div className="text-[32px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink3">
        {label}
      </div>
    </div>
  );
}

function NutritionToday({
  totals,
  settings,
  p,
  onLog,
}: {
  totals: DashboardData['todayTotals'];
  settings: DashboardData['settings'];
  p: number;
  onLog: () => void;
}) {
  const calorieTarget = settings.calorie_target;
  const calories = Math.round(totals.calories * p);
  const calRatio = calorieTarget ? Math.min(1, totals.calories / calorieTarget) : 0;
  const remaining = calorieTarget ? Math.max(0, Math.round(calorieTarget - totals.calories)) : 0;
  const metCalories = calorieTarget !== null && totals.calories >= calorieTarget;

  return (
    <section className="border-b-2 border-white/[0.15] px-5 py-[18px]">
      <div className="flex items-center justify-between">
        <MicroLabel>Nutrition today</MicroLabel>
        <AccentLink onClick={onLog}>Log</AccentLink>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.04em] tabular-nums text-ink">
          {formatNumber(calories)}
        </span>
        {calorieTarget !== null && (
          <span className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink3">
            / {formatNumber(calorieTarget)} cal
          </span>
        )}
      </div>

      {calorieTarget !== null && (
        <>
          <div className="mt-2 h-1.5 bg-surface2">
            <div
              className="h-full bg-accent"
              style={{ width: `${(calRatio * p * 100).toFixed(1)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-ink4">
            <span>0</span>
            <span>{metCalories ? 'Target met' : `${formatNumber(remaining)} left`}</span>
          </div>
        </>
      )}

      <div className="mt-2">
        <MacroRow label="Protein" value={totals.protein} target={settings.protein_target} p={p} />
        <MacroRow label="Carbs" value={totals.carbs} target={settings.carb_target} p={p} />
        <MacroRow label="Fat" value={totals.fat} target={settings.fat_target} p={p} />
        <FiberRow value={totals.fiber} target={settings.fiber_target} p={p} />
      </div>
    </section>
  );
}

function MacroRow({
  label,
  value,
  target,
  p,
}: {
  label: string;
  value: number;
  target: number | null;
  p: number;
}) {
  const met = target !== null && value >= target;
  const ratio = target ? Math.min(1, value / target) : 0;
  return (
    <div className="grid grid-cols-[64px_1fr_88px] items-center gap-3 border-t border-white/[0.08] py-[11px]">
      <div className="text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-ink2">{label}</div>
      <div className="h-1 bg-surface2">
        <div
          className={`h-full ${met ? 'bg-accent' : 'bg-accent-muted'}`}
          style={{ width: `${(ratio * p * 100).toFixed(1)}%` }}
        />
      </div>
      <div className="text-right text-[13px] tabular-nums">
        <span className="font-extrabold text-ink">{Math.round(value * p)}</span>
        <span className="text-ink3">{target !== null ? ` / ${target}g` : 'g'}</span>
      </div>
    </div>
  );
}

function FiberRow({ value, target, p }: { value: number; target: number | null; p: number }) {
  const ratio = target ? Math.min(1, value / target) : 0;
  return (
    <div className="grid grid-cols-[64px_1fr_88px] items-center gap-3 border-t border-white/[0.08] py-[11px]">
      <div className="text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-ink4">Fiber</div>
      <div className="h-0.5 bg-surface2">
        <div className="h-full bg-ink5" style={{ width: `${(ratio * p * 100).toFixed(1)}%` }} />
      </div>
      <div className="text-right text-[11.5px] tabular-nums text-ink3">
        {Math.round(value * p)}
        {target !== null ? ` / ${target}g` : 'g'}
      </div>
    </div>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
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

function WeighInModal({
  defaultWeight,
  unit,
  onClose,
  onSave,
}: {
  defaultWeight: number;
  unit: string;
  onClose: () => void;
  onSave: (weight: number) => void | Promise<void>;
}) {
  const [value, setValue] = useState(defaultWeight > 0 ? String(defaultWeight) : '');
  const weight = Number(value);
  const canSave = value.trim() !== '' && !Number.isNaN(weight) && weight > 0;

  return (
    <Modal
      title="Weigh in"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={() => canSave && onSave(weight)}>
            Save
          </Button>
        </div>
      }
    >
      <TextField
        label={`Weight (${unit})`}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <p className="mt-2 text-xs text-ink3">Logs today’s weigh-in (replaces an existing one).</p>
    </Modal>
  );
}
