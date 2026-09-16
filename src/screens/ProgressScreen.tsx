import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { MuscleHeatmap } from '../components/MuscleHeatmap';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
import {
  ChevronRight,
  Panel,
  PanelHeader,
  ProgressBar,
  SectionHeader,
} from '../components/primitives';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { useAnimationProgress } from '../hooks/useAnimationProgress';
import { formatDecimal, formatLongDate, formatNumber, PR_TYPE_LABELS } from '../lib/format';
import type { ReadinessLevel } from '../lib/readiness';
import type { MuscleHeatmapCell, ProgressStats } from '../repository/Repository';
import type { Exercise, PersonalRecord, Settings } from '../types';

const LEVEL_META: Record<ReadinessLevel, { word: string; color: string }> = {
  fresh: { word: 'PRIMED', color: '#8FE81E' },
  moderate: { word: 'MODERATE', color: '#F2B33D' },
  fatigued: { word: 'FATIGUED', color: '#FB923C' },
};

export function ProgressScreen() {
  const repository = useRepository();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState<string | null>(null);

  const state = useAsync(async () => {
    const [prs, exercises, settings, stats, readiness, heatmap, history] = await Promise.all([
      repository.getPersonalRecords(),
      repository.getExercises({ includeArchived: true }),
      repository.getSettings(),
      repository.getProgressStats(),
      repository.getReadiness(),
      repository.getMuscleHeatmap(),
      repository.getWorkoutHistory(),
    ]);
    return { prs, exercises, settings, stats, readiness, heatmap, history };
  }, []);

  const p = useAnimationProgress(state.data);

  const exerciseById = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const ex of state.data?.exercises ?? []) map.set(ex.id, ex);
    return map;
  }, [state.data?.exercises]);

  const trackedExercises = useMemo(() => {
    const ids = new Set((state.data?.prs ?? []).map((pr) => pr.exercise_id));
    return [...ids]
      .map((id) => exerciseById.get(id))
      .filter((e): e is Exercise => !!e)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.data?.prs, exerciseById]);

  const workoutByPrDate = useMemo(() => {
    const history = state.data?.history ?? [];
    const map = new Map<string, string>();
    for (const entry of history) {
      const ts = entry.workout.completed_at ?? entry.workout.started_at;
      map.set(ts.slice(0, 10), entry.workout.name);
    }
    return map;
  }, [state.data?.history]);

  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.loading || !state.data) return <Spinner />;

  const { prs, settings, stats, readiness, heatmap } = state.data;
  const unit = settings.units;
  const nothingYet = prs.length === 0 && stats.totalWorkouts === 0;
  const meta = LEVEL_META[readiness.level];

  return (
    <>
      <ScreenHeader kicker="History & personal records" title="Progress" />

      {nothingYet ? (
        <EmptyState
          title="No progress yet"
          note="Finish a workout and your PRs and per-exercise trends will show up here."
        />
      ) : (
        <PageBody>
          {/* Readiness — compact panel */}
          <Panel className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink3">Readiness</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[26px] font-extrabold leading-none tracking-[-0.02em]" style={{ color: meta.color }}>
                  {meta.word}
                </span>
                <span className="text-[13px] font-extrabold tabular-nums text-ink3">
                  {Math.round(readiness.index * p)}
                </span>
              </div>
            </div>
            <p className="max-w-[160px] shrink-0 text-right text-[11.5px] leading-snug text-ink2">
              {readiness.suggestion}
            </p>
          </Panel>

          {/* Consistency — open section */}
          <section className="pt-1">
            <SectionHeader label="Consistency" />
            <div className="mt-4 flex divide-x divide-hairline">
              <OpenNum value={Math.round(stats.currentStreak * p)} label="Day streak" />
              <OpenNum value={Math.round(stats.workoutsThisWeek * p)} label="This week" />
              <OpenNum value={Math.round(stats.longestStreak * p)} label="Best streak" />
            </div>
            <div className="mt-5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink3">Last 14 days</div>
            <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: 'repeat(14, 1fr)' }}>
              {stats.activityLast14.map((active, i) => (
                <div
                  key={i}
                  className={`h-[30px] rounded-[3px] ${active ? 'bg-accent' : 'bg-surface2'}`}
                  title={active ? 'Trained' : 'Rest'}
                />
              ))}
            </div>
          </section>

          {/* Muscle volume — module panel */}
          {heatmap.some((c) => c.volume > 0) && (
            <MuscleVolume
              cells={heatmap}
              unit={unit}
              expanded={expanded}
              onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
            />
          )}

          {/* Nutrition adherence — open section */}
          <MacroConsistency stats={stats} />

          {/* Recent PRs — open section */}
          {prs.length > 0 && (
            <section className="pt-1">
              <SectionHeader label="Recent PRs" />
              <ul className="mt-1">
                {prs.slice(0, 20).map((pr) => {
                  const workoutName = workoutByPrDate.get(pr.achieved_at.slice(0, 10));
                  return (
                    <li
                      key={pr.id}
                      className="flex items-center justify-between gap-3 border-t border-hairline py-3 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-ink">
                          {exerciseById.get(pr.exercise_id)?.name ?? 'Exercise'}
                        </div>
                        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink3">
                          {PR_TYPE_LABELS[pr.pr_type]} · {formatLongDate(pr.achieved_at)}
                        </div>
                        {workoutName && (
                          <div className="mt-0.5 truncate text-[9px] text-ink4">{workoutName}</div>
                        )}
                      </div>
                      <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-accent">
                        {formatPr(pr, unit)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Exercise trends — open section */}
          {trackedExercises.length > 0 && (
            <section className="pt-1">
              <SectionHeader label="Exercise trends" />
              <ul className="mt-1">
                {trackedExercises.map((ex) => (
                  <li key={ex.id} className="border-t border-hairline first:border-t-0">
                    <button
                      onClick={() => navigate(`/history/${ex.id}`)}
                      className="flex w-full items-center justify-between py-3 text-left transition-colors hover:bg-white/[0.02]"
                    >
                      <span className="text-[13px] text-ink">{ex.name}</span>
                      <ChevronRight className="h-4 w-4 text-ink4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </PageBody>
      )}
    </>
  );
}

function OpenNum({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 px-4 first:pl-0 last:pr-0">
      <div className="text-[29px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-2 text-[9px] font-bold uppercase tracking-[0.13em] text-ink3">{label}</div>
    </div>
  );
}

function MuscleVolume({
  cells,
  unit,
  expanded,
  onToggle,
}: {
  cells: MuscleHeatmapCell[];
  unit: string;
  expanded: string | null;
  onToggle: (id: string) => void;
}) {
  const ranked = [...cells].filter((c) => c.volume > 0).sort((a, b) => b.volume - a.volume);
  const max = Math.max(...ranked.map((c) => c.volume), 1);

  return (
    <Panel className="p-4">
      <PanelHeader label="This week’s muscle volume" />

      {/* Body map — dark → lime by how hard each group was worked. */}
      <div className="mt-3 rounded-tile border border-hairline bg-surface2 p-2">
        <MuscleHeatmap
          cells={cells}
          selectedId={expanded}
          onSelect={(cell) => onToggle(cell.muscleGroupId)}
        />
      </div>

      <ul className="mt-4">
        {ranked.map((cell, i) => {
          const isOpen = expanded === cell.muscleGroupId;
          return (
            <li key={cell.muscleGroupId} className="border-t border-hairline first:border-t-0">
              <button onClick={() => onToggle(cell.muscleGroupId)} className="w-full py-2.5 text-left">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] font-semibold text-ink">{cell.name}</span>
                  <span className="text-[11.5px] font-extrabold tabular-nums text-ink2">
                    {formatNumber(cell.volume)}
                  </span>
                </div>
                <ProgressBar
                  ratio={cell.volume / max}
                  tone={i === 0 ? 'accent' : 'muted'}
                  height="h-[3px]"
                  className="mt-2"
                />
              </button>
              {isOpen && (
                <div className="pb-3">
                  {cell.exercises.length > 0 ? (
                    <ul className="space-y-1 text-[12px] text-ink2">
                      {cell.exercises.map((ex) => (
                        <li key={ex.name} className="flex justify-between">
                          <span>{ex.name}</span>
                          <span className="tabular-nums">{formatNumber(ex.volume)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-ink3">No direct work this week.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-ink3">
        Working volume by muscle group, {unit} · tap a group for its exercises.
      </p>
    </Panel>
  );
}

function MacroConsistency({ stats }: { stats: ProgressStats }) {
  const mc = stats.macroConsistency;
  return (
    <section className="pt-1">
      <SectionHeader label="Nutrition adherence" />
      <p className="mt-3 text-[13.5px] text-ink">
        Logged nutrition on <span className="font-extrabold">{mc.daysLogged}</span> of the last 7 days.
      </p>
      {mc.daysLogged > 0 ? (
        <div className="mt-3 flex divide-x divide-hairline">
          <div className="flex-1 pr-4">
            <div className="text-[22px] font-extrabold tabular-nums text-ink">
              {mc.proteinMet} <span className="text-[14px] text-ink3">/ {mc.daysLogged}</span>
            </div>
            <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-ink3">
              Protein hit
            </div>
          </div>
          <div className="flex-1 pl-4">
            <div className="text-[22px] font-extrabold tabular-nums text-ink">
              {mc.calorieMet} <span className="text-[14px] text-ink3">/ {mc.daysLogged}</span>
            </div>
            <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-ink3">
              Calories on target
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11.5px] text-ink3">Log food to track adherence.</p>
      )}
    </section>
  );
}

function formatPr(pr: PersonalRecord, unit: Settings['units']): string {
  switch (pr.pr_type) {
    case 'estimated_1rm':
      return `${formatDecimal(pr.value)} ${unit}`;
    case 'reps_at_weight':
      return `${formatNumber(pr.value)} reps`;
    default:
      return `${formatNumber(pr.value)} ${unit}`;
  }
}
