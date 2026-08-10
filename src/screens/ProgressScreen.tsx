import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState, Spinner } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { formatDecimal, formatLongDate, formatNumber, PR_TYPE_LABELS } from '../lib/format';
import type { Exercise, PersonalRecord, Settings } from '../types';

export function ProgressScreen() {
  const repository = useRepository();
  const navigate = useNavigate();

  const state = useAsync(async () => {
    const [prs, exercises, settings] = await Promise.all([
      repository.getPersonalRecords(),
      repository.getExercises({ includeArchived: true }),
      repository.getSettings(),
    ]);
    return { prs, exercises, settings };
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

  if (state.loading) return <Spinner />;

  const prs = state.data?.prs ?? [];
  const unit = state.data?.settings.units ?? 'lbs';

  return (
    <>
      <ScreenHeader title="Progress" subtitle="History & personal records" />

      {prs.length === 0 ? (
        <EmptyState
          icon="📈"
          title="No progress yet"
          note="Finish a workout and your PRs and per-exercise trends will show up here."
        />
      ) : (
        <div className="space-y-6 p-4">
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
        </div>
      )}
    </>
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
