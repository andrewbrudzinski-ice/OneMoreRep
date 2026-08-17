import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { MuscleHeatmap } from '../components/MuscleHeatmap';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
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
    const [prs, exercises, settings, stats, readiness, heatmap] = await Promise.all([
      repository.getPersonalRecords(),
      repository.getExercises({ includeArchived: true }),
      repository.getSettings(),
      repository.getProgressStats(),
      repository.getReadiness(),
      repository.getMuscleHeatmap(),
    ]);
    return { prs, exercises, settings, stats, readiness, heatmap };
  }, []);

  const p = useAnimationProgress(state.data);

  const exerciseById = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const ex of state.data?.exercises ?? []) map.set(ex.id, ex);
    return map;
  }, [state.data?.exercises]);

  const trackedExercises = useMemo(() => {
    const ids = new Set((state.data?.prs ?? []).map((p) => p.exercise_id));
    return [...ids]
      .map((id) => exerciseById.get(id))
      .filter((e): e is Exercise => !!e)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.data?.prs, exerciseById]);

  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.loading || !state.data) return <Spinner />;

  const { prs, settings, stats, readiness, heatmap } = state.data;
  const unit = settings.units;
  const nothingYet = prs.length === 0 && stats.totalWorkouts === 0;

  return (
    <>
      <ScreenHeader kicker="History & personal records" title="Progress" />

      {nothingYet ? (
        <EmptyState
          title="No progress yet"
          note="Finish a workout and your PRs and per-exercise trends will show up here."
        />
      ) : (
        <>
          {/* Readiness strip */}
          <section className="flex items-start justify-between gap-4 border-b-2 border-white/[0.15] bg-surface px-5 py-4">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
                Readiness
              </div>
              <div
                className="mt-1 text-[26px] font-extrabold leading-none"
                style={{ color: LEVEL_META[readiness.level].color }}
              >
                {LEVEL_META[readiness.level].word}
              </div>
            </div>
            <p className="max-w-[170px] text-left text-[11.5px] text-ink2">{readiness.suggestion}</p>
          </section>

          {/* Consistency */}
          <section className="border-b-2 border-white/[0.15] pb-[18px]">
            <div className="grid grid-cols-3 pt-[18px]">
              <Metric label="Day streak" value={Math.round(stats.currentStreak * p)} first />
              <Metric label="This week" value={Math.round(stats.workoutsThisWeek * p)} />
              <Metric label="Best streak" value={Math.round(stats.longestStreak * p)} />
            </div>
            <div className="mx-5 mt-4 text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink3">
              Last 14 days
            </div>
            <div
              className="mx-5 mt-2 grid gap-[3px]"
              style={{ gridTemplateColumns: 'repeat(14, 1fr)' }}
            >
              {stats.activityLast14.map((active, i) => (
                <div
                  key={i}
                  className={`h-[30px] ${active ? 'bg-accent' : 'bg-surface2'}`}
                  title={active ? 'Trained' : 'Rest'}
                />
              ))}
            </div>
          </section>

          {/* This week's muscle volume */}
          {heatmap.some((c) => c.volume > 0) && (
            <MuscleVolume
              cells={heatmap}
              unit={unit}
              expanded={expanded}
              onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
            />
          )}

          {/* Macro consistency */}
          <MacroConsistency stats={stats} />

          {/* Recent PRs */}
          {prs.length > 0 && (
            <section className="border-b-2 border-white/[0.15] px-5 py-[18px]">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
                Recent PRs
              </div>
              <ul className="mt-1">
                {prs.slice(0, 20).map((pr) => (
                  <li
                    key={pr.id}
                    className="flex items-center justify-between gap-3 border-t border-white/[0.08] py-3 first:border-t-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink">
                        {exerciseById.get(pr.exercise_id)?.name ?? 'Exercise'}
                      </div>
                      <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.13em] text-ink3">
                        {PR_TYPE_LABELS[pr.pr_type]} · {formatLongDate(pr.achieved_at)}
                      </div>
                    </div>
                    <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-accent">
                      {formatPr(pr, unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Exercise trends */}
          {trackedExercises.length > 0 && (
            <section>
              <div className="px-5 pb-1 pt-[18px] text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
                Exercise trends
              </div>
              <ul>
                {trackedExercises.map((ex) => (
                  <li key={ex.id}>
                    <button
                      onClick={() => navigate(`/history/${ex.id}`)}
                      className="flex w-full items-center justify-between border-t border-white/[0.08] px-5 py-[14px] text-left transition-colors hover:bg-surface"
                    >
                      <span className="text-[13px] text-ink">{ex.name}</span>
                      <ChevronRight className="h-4 w-4 text-ink4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

function Metric({ label, value, first }: { label: string; value: number; first?: boolean }) {
  return (
    <div className={`px-3 ${first ? '' : 'border-l border-white/[0.08]'}`}>
      <div className="text-[30px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink3">
        {label}
      </div>
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
    <section className="border-b-2 border-white/[0.15] px-5 py-[18px]">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
        This week’s muscle volume
      </div>

      {/* Body map — dark → lime by how hard each group was worked. */}
      <div className="mt-3">
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
            <li key={cell.muscleGroupId} className="border-t border-white/[0.08] first:border-t-0">
              <button onClick={() => onToggle(cell.muscleGroupId)} className="w-full py-2.5 text-left">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] font-semibold text-ink">{cell.name}</span>
                  <span className="text-[11.5px] font-extrabold tabular-nums text-ink2">
                    {formatNumber(cell.volume)}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] bg-surface2">
                  <div
                    className={`h-full ${i === 0 ? 'bg-accent' : 'bg-accent-muted2'}`}
                    style={{ width: `${(cell.volume / max) * 100}%` }}
                  />
                </div>
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
    </section>
  );
}

function MacroConsistency({ stats }: { stats: ProgressStats }) {
  const mc = stats.macroConsistency;
  return (
    <section className="border-b-2 border-white/[0.15] px-5 py-[18px]">
      <p className="text-[13.5px] text-ink">
        Logged nutrition on <span className="font-extrabold">{mc.daysLogged}</span> of the last 7
        days.
      </p>
      {mc.daysLogged > 0 ? (
        <div className="mt-3 grid grid-cols-2">
          <div className="pr-3">
            <div className="text-[20px] font-extrabold tabular-nums text-ink">
              {mc.proteinMet} / {mc.daysLogged}
            </div>
            <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink3">
              Protein hit
            </div>
          </div>
          <div className="border-l border-white/[0.08] pl-3">
            <div className="text-[20px] font-extrabold tabular-nums text-ink">
              {mc.calorieMet} / {mc.daysLogged}
            </div>
            <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink3">
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
