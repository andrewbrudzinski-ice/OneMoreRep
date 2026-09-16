import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorState, Modal, Spinner, TextField } from '../components/ui';
import { PageBody } from '../components/ScreenHeader';
import {
  ChevronRight,
  DeltaBadge,
  KpiValue,
  Panel,
  PanelAction,
  PanelHeader,
  PrimaryAction,
  ProgressBar,
  SectionHeader,
  SectionLabel,
} from '../components/primitives';
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

  const routineId = state.data?.activeWorkout ? undefined : state.data?.suggestedRoutine?.id;
  const detail = useAsync(
    () => (routineId ? repository.getRoutineDetail(routineId) : Promise.resolve(undefined)),
    [routineId],
  );

  // One shared 0→1 pass drives every counting number, bar, and the ring in sync.
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
        <DashboardHeader />
        <ErrorState error={state.error} onRetry={state.reload} />
      </>
    );
  }
  if (state.loading || !state.data) {
    return (
      <>
        <DashboardHeader />
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
  const estMin = setCount > 0 ? Math.max(5, Math.round((setCount * 3.5) / 5) * 5) : 0;

  const workoutTitle = d.activeWorkout
    ? d.activeWorkout.name
    : (d.suggestedRoutine?.name ?? 'Start a session');
  const hasPlan = !d.activeWorkout && d.suggestedRoutine && routineDetail;
  const routineNotes = !d.activeWorkout ? (d.suggestedRoutine?.notes ?? '') : '';

  const volume = d.volumeSparkline;
  const volumePeak = Math.max(...volume, 0);
  const { recentVolumeAvg, priorVolumeAvg } = d.readiness.input;
  const volDelta =
    recentVolumeAvg !== null && priorVolumeAvg !== null && priorVolumeAvg > 0
      ? (recentVolumeAvg / priorVolumeAvg - 1) * 100
      : null;

  return (
    <>
      <DashboardHeader userName={d.userName} />

      <PageBody>
        {/* 1 — Readiness (bordered hero) */}
        <ReadinessCard readiness={d.readiness} p={p} />

        {/* 2 — Today's workout (bordered action module) */}
        <Panel className="p-4">
          <PanelHeader
            label={d.activeWorkout ? 'Session in progress' : "Today's workout"}
            action={
              !d.activeWorkout && d.suggestedRoutine ? (
                <PanelAction onClick={() => navigate('/workout')}>Change</PanelAction>
              ) : undefined
            }
          />
          <div className="mt-2.5 text-[24px] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink">
            {workoutTitle}
          </div>
          {(hasPlan || d.activeWorkout) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink2">
              {hasPlan ? (
                <>
                  <MetaStat value={exerciseCount} label={exerciseCount === 1 ? 'exercise' : 'exercises'} />
                  <Dot />
                  <MetaStat value={setCount} label={setCount === 1 ? 'set' : 'sets'} />
                  {estMin > 0 && (
                    <>
                      <Dot />
                      <span className="text-ink3">~{estMin} min</span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-accent">Pick up where you left off</span>
              )}
            </div>
          )}
          {routineNotes && <p className="mt-1 text-[12px] text-ink3">{routineNotes}</p>}
          <PrimaryAction
            onClick={startSuggested}
            label={d.activeWorkout ? 'Resume workout' : 'Start workout'}
            className="mt-4"
          />
        </Panel>

        {/* 3 — This week (OPEN section on the ground) */}
        <section className="pt-1">
          <SectionHeader
            label="This week"
            action={<PanelAction onClick={() => navigate('/progress')}>Progress</PanelAction>}
          />
          <div className="mt-4 flex divide-x divide-hairline">
            <OpenNum value={String(anim(d.week.workoutsThisWeek))} label="Workouts" />
            <OpenNum value={String(anim(d.week.streak))} label="Day streak" />
            <OpenNum value={formatNumber(anim(d.weeklyVolume))} label={`Volume ${unit}`} />
          </div>

          <div className="mt-5 flex items-center justify-between">
            <SectionLabel>Working volume · 7 days</SectionLabel>
            {volDelta !== null && <DeltaBadge percent={volDelta} />}
          </div>
          <WeeklyVolumeChart volume={volume} p={p} />
          <p className="mt-2.5 text-[11px] text-ink3">
            Peak {formatNumber(volumePeak)} {unit} · trend vs prior sessions
          </p>
        </section>

        {/* 4 — Nutrition (bordered module) */}
        <NutritionPanel
          totals={d.todayTotals}
          settings={d.settings}
          p={p}
          onLog={() => navigate('/nutrition')}
        />

        {/* 5 — Bodyweight (OPEN section) */}
        <section className="pt-1">
          <SectionHeader
            label="Bodyweight"
            action={<PanelAction onClick={() => setWeighIn(true)}>Weigh in</PanelAction>}
          />
          {d.bodyweight.latest ? (
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <KpiValue value={formatDecimal(d.bodyweight.latest.weight)} unit={unit} size="text-[32px]" />
                {d.bodyweight.changeFromStart !== null && (
                  <div className="mt-1.5 text-[11.5px] text-ink2">
                    {d.bodyweight.changeFromStart >= 0 ? '+' : ''}
                    {formatDecimal(d.bodyweight.changeFromStart)} {unit} overall
                  </div>
                )}
              </div>
              <Sparkline values={d.bodyweight.sparkline} color="#8FE81E" width={128} height={44} strokeWidth={1.75} />
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-ink3">No weigh-ins yet. Tap “Weigh in”.</p>
          )}
        </section>

        {/* 6 — Recent PRs (OPEN section) */}
        <section className="pt-1">
          <SectionHeader
            label="Recent PRs"
            action={<PanelAction onClick={() => navigate('/progress')}>All</PanelAction>}
          />
          {d.recentPRs.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-ink3">Finish a workout to earn PRs.</p>
          ) : (
            <ul className="mt-1">
              {d.recentPRs.slice(0, 3).map(({ record, exerciseName }) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between gap-3 border-t border-hairline py-3 first:border-t-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{exerciseName}</div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink3">
                      {PR_TYPE_LABELS[record.pr_type]}
                    </div>
                  </div>
                  <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-accent">
                    {record.pr_type === 'estimated_1rm'
                      ? formatDecimal(record.value)
                      : formatNumber(record.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 7 — Muscle map (OPEN drill-in row) */}
        <button
          onClick={() => navigate('/progress')}
          className="mt-1 flex w-full items-center justify-between border-t border-hairline pt-4 text-left"
          aria-label="Open muscle volume map"
        >
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-[3px] rounded-full bg-accent" aria-hidden />
            <div>
              <div className="text-[13px] font-extrabold text-ink">Muscle volume map</div>
              <div className="mt-0.5 text-[11.5px] text-ink3">This week, by muscle group</div>
            </div>
          </div>
          <ChevronRight />
        </button>
      </PageBody>

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
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function DashboardHeader({ userName }: { userName?: string }) {
  const now = new Date();
  const hr = now.getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
  const name = userName && userName !== 'Me' ? `, ${userName}` : '';
  return (
    <header className="px-4 pb-1 pt-7">
      <div className="mx-auto max-w-xl">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">{dateStr}</div>
        <h1 className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.03em] text-ink">
          {greeting}
          {name}
        </h1>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Building blocks                                                            */
/* -------------------------------------------------------------------------- */

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-ink5" aria-hidden />;
}

function MetaStat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="font-bold tabular-nums text-ink">{value}</span> <span className="text-ink2">{label}</span>
    </span>
  );
}

/** A big number sitting directly on the ground (open section metric). */
function OpenNum({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 px-4 first:pl-0 last:pr-0">
      <div className="text-[29px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-2 text-[9px] font-bold uppercase tracking-[0.13em] text-ink3">{label}</div>
    </div>
  );
}

function WeeklyVolumeChart({ volume, p }: { volume: number[]; p: number }) {
  const volumeMax = Math.max(...volume, 1);
  const todayDow = new Date().getDay();
  return (
    <div className="mt-3">
      <div className="relative h-[92px]">
        {[0, 0.5, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 h-px bg-hairline" style={{ top: `${g * 100}%` }} />
        ))}
        <div className="absolute inset-0 grid grid-cols-7 items-end gap-2">
          {volume.map((v, i) => {
            const pct = v > 0 ? Math.max(4, (v / volumeMax) * 100) : 2;
            const isPeak = v === volumeMax && v > 0;
            return (
              <div key={i} className="flex h-full items-end">
                <div
                  className={`w-full rounded-t-[3px] ${v > 0 ? (isPeak ? 'bg-accent' : 'bg-accent/45') : 'bg-surface3'}`}
                  style={{ height: `${(pct * p).toFixed(1)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {volume.map((v, i) => {
          const isToday = i === 6;
          const letter = DAY_LETTERS[(todayDow - (6 - i) + 700) % 7];
          const color = isToday ? 'text-ink' : v > 0 ? 'text-ink2' : 'text-ink4';
          return (
            <div key={i} className={`text-center text-[9.5px] font-bold ${color}`}>
              {letter}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NutritionPanel({
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
    <Panel className="p-4">
      <PanelHeader label="Nutrition today" action={<PanelAction onClick={onLog}>Log</PanelAction>} />

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <KpiValue
          value={formatNumber(calories)}
          target={calorieTarget !== null ? formatNumber(calorieTarget) : undefined}
          unit="cal"
          size="text-[40px]"
        />
        {calorieTarget !== null && (
          <div className="mb-1.5 text-right text-[11px] font-semibold text-ink2">
            {metCalories ? (
              <span className="text-accent">Target met</span>
            ) : (
              <>
                <span className="tabular-nums text-ink">{formatNumber(remaining)}</span> left
              </>
            )}
          </div>
        )}
      </div>

      {calorieTarget !== null && <ProgressBar ratio={calRatio} p={p} height="h-2" className="mt-3" />}

      <div className="mt-3.5 space-y-2">
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
    <div className="grid grid-cols-[58px_1fr_78px] items-center gap-3 rounded-tile border border-hairline bg-surface2 px-3 py-2">
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

/* -------------------------------------------------------------------------- */
/* Weigh-in modal                                                            */
/* -------------------------------------------------------------------------- */

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
