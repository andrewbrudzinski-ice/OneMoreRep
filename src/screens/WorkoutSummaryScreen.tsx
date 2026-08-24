import { useNavigate, useParams } from 'react-router-dom';
import { Button, Spinner } from '../components/ui';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { Panel, PanelHeader, SectionHeader } from '../components/primitives';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { formatDuration } from '../hooks/useElapsedSeconds';
import { formatDecimal, formatLongDate, formatNumber, PR_TYPE_LABELS } from '../lib/format';
import type { VsLastTone } from '../lib/workoutSummary';
import type { Settings } from '../types';

const TONE_CLASSES: Record<VsLastTone, string> = {
  up: 'text-accent',
  flat: 'text-ink',
  down: 'text-ink',
  deload: 'text-moderate',
  light: 'text-moderate',
  lighter: 'text-moderate',
  first: 'text-ink2',
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
        <p className="text-lg font-extrabold text-ink">Summary unavailable</p>
        <Button onClick={() => navigate('/workout')}>Back to workouts</Button>
      </div>
    );
  }

  const unit = settings.units;
  const date = summary.workout.completed_at ?? summary.workout.started_at;

  return (
    <>
      <ScreenHeader kicker="Workout complete" title={summary.workout.name} subtitle={formatLongDate(date)} />

      <PageBody>
        {/* Stats — open divided row */}
        <section className="flex divide-x divide-hairline pt-1">
          <Stat label="Duration" value={formatDuration(summary.workout.duration_seconds ?? 0)} />
          <Stat label="Exercises" value={String(summary.exerciseCount)} />
          <Stat label="Sets" value={String(summary.workingSetCount)} />
          <Stat label={`Vol ${unit}`} value={formatNumber(summary.totalVolume)} />
        </section>

        {/* vs last time — module panel */}
        <Panel className="p-4">
          <PanelHeader label="vs last time" />
          <div className={`mt-2 text-[20px] font-extrabold ${TONE_CLASSES[summary.vsLast.tone]}`}>
            {summary.vsLast.label}
          </div>
        </Panel>

        {/* New PRs — open section */}
        <section className="pt-1">
          <SectionHeader
            label={`New PRs${summary.newPRs.length > 0 ? ` · ${summary.newPRs.length}` : ''}`}
          />
          {summary.newPRs.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-ink3">
              No new PRs this session — consistency still counts.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.newPRs.map((pr) => (
                <li
                  key={pr.id}
                  className="flex items-center justify-between gap-3 rounded-tile border border-accent/25 bg-accent-soft px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold text-ink">
                      {PR_TYPE_LABELS[pr.pr_type]}
                    </div>
                    {pr.previous_value !== null && (
                      <div className="mt-0.5 text-[11px] text-ink3">
                        prev {formatPrValue(pr.pr_type, pr.previous_value, unit)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-extrabold tabular-nums text-accent">
                      {formatPrValue(pr.pr_type, pr.value, unit)}
                    </div>
                    {pr.weight !== null && pr.reps !== null && (
                      <div className="text-[11px] tabular-nums text-ink3">
                        {pr.weight}×{pr.reps}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Actions */}
        <div className="space-y-2 pt-3">
          <Button variant="primary" className="w-full" onClick={() => navigate('/')}>
            Done
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => navigate(`/session/${workoutId}`)}>
              Edit workout
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/progress')}>
              View progress
            </Button>
          </div>
        </div>
      </PageBody>
    </>
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
    <div className="flex-1 px-3 first:pl-0 last:pr-0">
      <div className="text-[21px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.11em] text-ink3">{label}</div>
    </div>
  );
}
