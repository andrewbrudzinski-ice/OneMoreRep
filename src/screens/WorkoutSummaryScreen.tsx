import { useNavigate, useParams } from 'react-router-dom';
import { Button, Spinner } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { formatDuration } from '../hooks/useElapsedSeconds';
import { formatDecimal, formatNumber, PR_TYPE_LABELS } from '../lib/format';
import type { VsLastTone } from '../lib/workoutSummary';
import type { Settings } from '../types';

const TONE_CLASSES: Record<VsLastTone, string> = {
  up: 'text-beat',
  flat: 'text-slate-300',
  down: 'text-slate-300',
  deload: 'text-matched',
  light: 'text-matched',
  lighter: 'text-matched',
  first: 'text-slate-400',
};

export function WorkoutSummaryScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const { workoutId = '' } = useParams();

  const state = useAsync(async () => {
    const [summary, settings] = await Promise.all([
      repository.getWorkoutSummary(workoutId),
      repository.getSettings(),
    ]);
    return { summary, settings };
  }, [workoutId]);

  if (state.loading) return <Spinner />;
  const summary = state.data?.summary;
  const settings = state.data?.settings;
  if (!summary || !settings) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-semibold">Summary unavailable</p>
        <Button onClick={() => navigate('/workout')}>Back to workouts</Button>
      </div>
    );
  }

  const unit = settings.units;

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-24 pt-8">
      <div className="text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-2 text-2xl font-bold">{summary.workout.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Workout complete</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Duration" value={formatDuration(summary.workout.duration_seconds ?? 0)} />
        <Stat label="Exercises" value={String(summary.exerciseCount)} />
        <Stat label="Working sets" value={String(summary.workingSetCount)} />
        <Stat label="Volume" value={`${formatNumber(summary.totalVolume)} ${unit}`} />
      </div>

      <div className="mt-4  border border-slate-800 bg-slate-900/50 p-5 text-center">
        <div className="text-xs uppercase tracking-wide text-slate-500">vs last time</div>
        <div className={`mt-1 text-lg font-semibold ${TONE_CLASSES[summary.vsLast.tone]}`}>
          {summary.vsLast.label}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          New personal records {summary.newPRs.length > 0 && `(${summary.newPRs.length})`}
        </h2>
        {summary.newPRs.length === 0 ? (
          <p className=" border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
            No new PRs this session — consistency still counts.
          </p>
        ) : (
          <ul className="space-y-2">
            {summary.newPRs.map((pr) => (
              <li
                key={pr.id}
                className="flex items-center justify-between  border border-beat/30 bg-beat/5 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{PR_TYPE_LABELS[pr.pr_type]}</div>
                  {pr.previous_value !== null && (
                    <div className="text-xs text-slate-500">
                      prev {formatPrValue(pr.pr_type, pr.previous_value, unit)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-beat">{formatPrValue(pr.pr_type, pr.value, unit)}</div>
                  {pr.weight !== null && pr.reps !== null && (
                    <div className="text-xs text-slate-500 tabular-nums">
                      {pr.weight}×{pr.reps}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => navigate('/')}>
          Done
        </Button>
        <Button variant="secondary" onClick={() => navigate('/progress')}>
          View progress
        </Button>
      </div>
    </div>
  );
}

function formatPrValue(type: string, value: number, unit: Settings['units']): string {
  if (type === 'estimated_1rm') return `${formatDecimal(value)} ${unit}`;
  if (type === 'heaviest_weight') return `${formatNumber(value)} ${unit}`;
  if (type === 'reps_at_weight') return `${formatNumber(value)} reps`;
  return `${formatNumber(value)} ${unit}`; // volumes
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className=" border border-slate-800 bg-slate-900/50 p-4 text-center">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-slate-400">{label}</div>
    </div>
  );
}
