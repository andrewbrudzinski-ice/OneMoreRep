import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { Panel, SectionHeader } from '../components/primitives';
import { Button, EmptyState, Spinner } from '../components/ui';
import { TrendChart, type TrendPoint } from '../components/TrendChart';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { formatDecimal, formatLongDate, formatNumber, formatShortDate } from '../lib/format';

type Metric = 'e1rm' | 'volume' | 'weight';

const METRICS: { key: Metric; label: string; unitKind: 'weight' | 'volume' }[] = [
  { key: 'e1rm', label: 'Est. 1RM', unitKind: 'weight' },
  { key: 'volume', label: 'Volume', unitKind: 'volume' },
  { key: 'weight', label: 'Top weight', unitKind: 'weight' },
];

export function ExerciseHistoryScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const { exerciseId = '' } = useParams();
  const [metric, setMetric] = useState<Metric>('e1rm');

  const state = useAsync(async () => {
    const [history, settings] = await Promise.all([
      repository.getExerciseHistory(exerciseId),
      repository.getSettings(),
    ]);
    return { history, settings };
  }, [exerciseId]);

  const history = state.data?.history;
  const unit = state.data?.settings.units ?? 'lbs';

  // Chart series ascending in time.
  const series: TrendPoint[] = useMemo(() => {
    if (!history) return [];
    const chrono = [...history.sessions].reverse();
    return chrono.map((s) => ({
      label: formatShortDate(s.workout.completed_at ?? s.workout.started_at),
      value:
        metric === 'e1rm'
          ? Math.round(s.bestE1rm * 10) / 10
          : metric === 'volume'
            ? s.volume
            : s.topWeight,
    }));
  }, [history, metric]);

  if (state.loading) return <Spinner />;
  if (!history) {
    return (
      <>
        <ScreenHeader title="History" />
        <EmptyState icon="🤔" title="Exercise not found" />
        <div className="p-4">
          <Button onClick={() => navigate(-1)}>← Back</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        title={history.exercise.name}
        subtitle={`${history.sessions.length} ${history.sessions.length === 1 ? 'session' : 'sessions'}`}
        action={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
        }
      />

      {history.sessions.length === 0 ? (
        <EmptyState
          title="No history yet"
          note="Log this exercise in a workout and your trends will appear here."
        />
      ) : (
        <PageBody className="space-y-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Best label="Best est. 1RM" value={`${formatDecimal(history.bestE1rm)} ${unit}`} />
            <Best label="Heaviest" value={`${formatNumber(history.bestWeight)} ${unit}`} />
            <Best label="Most reps" value={`${history.bestReps}`} />
            <Best label="Best set vol." value={`${formatNumber(history.bestSetVolume)} ${unit}`} />
            <Best label="Best session vol." value={`${formatNumber(history.bestWorkoutVolume)} ${unit}`} />
            <Best label="Lifetime vol." value={`${formatNumber(history.lifetimeVolume)} ${unit}`} />
          </div>

          <Panel className="p-4">
            <div className="mb-3 flex gap-2">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={`rounded-control px-3 py-1.5 text-xs font-bold transition-colors ${
                    metric === m.key
                      ? 'bg-accent text-on-accent'
                      : 'border border-line bg-surface2 text-ink2 hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <TrendChart data={series} unit={unit} />
          </Panel>

          <section>
            <SectionHeader label="Sessions" />
            <ul className="mt-3 space-y-2">
              {history.sessions.map((session) => (
                <li
                  key={session.workout.id}
                  className="rounded-panel border border-line bg-surface p-4 shadow-panel"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">
                      {formatLongDate(session.workout.completed_at ?? session.workout.started_at)}
                    </span>
                    <span className="text-xs tabular-nums text-ink3">
                      {formatNumber(session.volume)} {unit} · e1RM {formatDecimal(session.bestE1rm)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {session.sets
                      .filter((s) => !s.is_warmup)
                      .map((s) => (
                        <span
                          key={s.id}
                          className="rounded-control border border-hairline bg-surface2 px-2 py-1 text-xs tabular-nums text-ink"
                        >
                          {s.weight}×{s.reps}
                        </span>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </PageBody>
      )}
    </>
  );
}

function Best({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tile border border-hairline bg-surface2 px-3 py-2.5">
      <div className="text-[15px] font-extrabold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.11em] text-ink3">{label}</div>
    </div>
  );
}
