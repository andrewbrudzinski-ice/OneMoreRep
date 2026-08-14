import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { formatDuration } from '../hooks/useElapsedSeconds';
import { formatLongDate, formatNumber } from '../lib/format';
import type { WorkoutHistoryEntry } from '../repository/Repository';
import type { Settings } from '../types';

export function WorkoutHistoryScreen() {
  const repository = useRepository();
  const navigate = useNavigate();

  const state = useAsync(async () => {
    const [entries, settings] = await Promise.all([
      repository.getWorkoutHistory(),
      repository.getSettings(),
    ]);
    return { entries, settings };
  }, []);

  const header = <ScreenHeader kicker="Every session, most recent first" title="History" />;

  if (state.error) {
    return (
      <>
        {header}
        <ErrorState error={state.error} onRetry={state.reload} />
      </>
    );
  }
  if (state.loading || !state.data) {
    return (
      <>
        {header}
        <Spinner />
      </>
    );
  }

  const { entries, settings } = state.data;

  return (
    <>
      {header}
      {entries.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          note="Finish a session and it'll show up here — tap any one to review or edit it."
        />
      ) : (
        <ul>
          {entries.map((entry) => (
            <HistoryRow
              key={entry.workout.id}
              entry={entry}
              units={settings.units}
              onOpen={() => navigate(`/summary/${entry.workout.id}`)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function HistoryRow({
  entry,
  units,
  onOpen,
}: {
  entry: WorkoutHistoryEntry;
  units: Settings['units'];
  onOpen: () => void;
}) {
  const { workout } = entry;
  const date = workout.completed_at ?? workout.started_at;
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-[15px] text-left transition-colors hover:bg-surface"
      >
        <div className="min-w-0">
          <div className="truncate text-[15px] font-extrabold tracking-[-0.015em] text-ink">
            {workout.name}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink3">{formatLongDate(date)}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] tabular-nums text-ink2">
            <span>
              <span className="font-extrabold text-ink">{formatNumber(entry.volume)}</span> {units}
            </span>
            <span>{entry.workingSetCount} sets</span>
            <span>{entry.exerciseCount} exercises</span>
            {workout.duration_seconds ? <span>{formatDuration(workout.duration_seconds)}</span> : null}
          </div>
        </div>
        <ChevronRight className="h-[17px] w-[17px] shrink-0 text-ink4" />
      </button>
    </li>
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
