import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { formatDecimal, formatLongDate, formatNumber, PR_TYPE_LABELS } from '../lib/format';
import type { ProgressStats } from '../repository/Repository';
import type { Exercise, PersonalRecord, Settings } from '../types';

export function ProgressScreen() {
  const repository = useRepository();
  const navigate = useNavigate();

  const state = useAsync(async () => {
    const [prs, exercises, settings, stats] = await Promise.all([
      repository.getPersonalRecords(),
      repository.getExercises({ includeArchived: true }),
      repository.getSettings(),
      repository.getProgressStats(),
    ]);
    return { prs, exercises, settings, stats };
  }, []);

  const exerciseById = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const ex of state.data?.exercises ?? []) map.set(ex.id, ex);
    return map;
  }, [state.data?.exercises]);

  // Exercises that have at least one PR (i.e. at least one completed session).
  const trackedExercises = useMemo(() => {
    const ids = new Set((state.data?.prs ?? []).map((p) => p.exercise_id));
    return [...ids]
      .map((id) => exerciseById.get(id))
      .filter((e): e is Exercise => !!e)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.data?.prs, exerciseById]);

  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.loading) return <Spinner />;

  const prs = state.data?.prs ?? [];
  const unit = state.data?.settings.units ?? 'lbs';

  const stats = state.data?.stats;
  const nothingYet = prs.length === 0 && (stats?.totalWorkouts ?? 0) === 0;

  return (
    <>
      <ScreenHeader title="Progress" subtitle="History & personal records" />

      {nothingYet ? (
        <EmptyState
          icon="📈"
          title="No progress yet"
          note="Finish a workout and your PRs and per-exercise trends will show up here."
        />
      ) : (
        <div className="space-y-6 p-4">
          {stats && <ConsistencySection stats={stats} />}

          {prs.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-300">Recent PRs</h2>
            <ul className="space-y-2">
              {prs.slice(0, 20).map((pr) => (
                <li
                  key={pr.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {exerciseById.get(pr.exercise_id)?.name ?? 'Exercise'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {PR_TYPE_LABELS[pr.pr_type]} · {formatLongDate(pr.achieved_at)}
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold text-beat">
                    {formatPr(pr, unit)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          )}

          {trackedExercises.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-300">Exercise trends</h2>
            <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
              {trackedExercises.map((ex) => (
                <li key={ex.id}>
                  <button
                    onClick={() => navigate(`/history/${ex.id}`)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-900"
                  >
                    <span className="text-sm">{ex.name}</span>
                    <span className="text-slate-600">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          )}
        </div>
      )}
    </>
  );
}

function ConsistencySection({ stats }: { stats: ProgressStats }) {
  const mc = stats.macroConsistency;
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">Consistency</div>
        <div className="mt-2 flex items-center gap-6">
          <div>
            <div className="text-2xl font-bold tabular-nums">
              {stats.currentStreak}
              <span className="ml-1 text-base">🔥</span>
            </div>
            <div className="text-xs text-slate-500">day streak</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{stats.workoutsThisWeek}</div>
            <div className="text-xs text-slate-500">this week</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{stats.longestStreak}</div>
            <div className="text-xs text-slate-500">best streak</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs text-slate-500">Last 14 days</div>
          <div className="flex gap-1">
            {stats.activityLast14.map((active, i) => (
              <div
                key={i}
                className={`h-6 flex-1 rounded ${active ? 'bg-beat' : 'bg-slate-800'}`}
                title={active ? 'Trained' : 'Rest'}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">Macro consistency</div>
        <p className="mt-2 text-sm text-slate-300">
          Logged nutrition on <span className="font-semibold">{mc.daysLogged}</span> of the last 7
          days.
        </p>
        {mc.daysLogged > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            <li>
              Protein target hit <span className="font-semibold text-slate-200">{mc.proteinMet}</span>
              /{mc.daysLogged}
            </li>
            <li>
              Calories on target{' '}
              <span className="font-semibold text-slate-200">{mc.calorieMet}</span>/{mc.daysLogged}
            </li>
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Log food to track adherence.</p>
        )}
      </div>
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
