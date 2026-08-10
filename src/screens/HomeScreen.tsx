import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Modal, Spinner, TextField } from '../components/ui';
import { MacroRings } from '../components/MacroRings';
import { Sparkline } from '../components/Sparkline';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { todayDateString } from '../lib/id';
import { formatDecimal, formatNumber, PR_TYPE_LABELS } from '../lib/format';
import type { DashboardData } from '../repository/Repository';

export function HomeScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const [weighIn, setWeighIn] = useState(false);

  const state = useAsync<DashboardData>(() => repository.getDashboardData(), []);

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

  if (state.loading || !state.data) {
    return (
      <>
        <ScreenHeader title="Home" />
        <Spinner />
      </>
    );
  }

  const d = state.data;
  const unit = d.settings.units;

  return (
    <>
      <ScreenHeader title={`Hey, ${d.userName}`} subtitle="Chase green." />

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {/* Today's workout */}
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Today’s workout</div>
              <div className="mt-1 text-lg font-semibold">
                {d.activeWorkout
                  ? `${d.activeWorkout.name} — in progress`
                  : (d.suggestedRoutine?.name ?? 'Start a session')}
              </div>
            </div>
            <Button variant="primary" onClick={startSuggested}>
              {d.activeWorkout ? 'Resume' : 'Start'}
            </Button>
          </div>
        </Card>

        {/* Bodyweight */}
        <Card onClick={() => navigate('/bodyweight')}>
          <CardHeader
            label="Bodyweight"
            action={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setWeighIn(true);
                }}
                className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                + Weigh in
              </button>
            }
          />
          {d.bodyweight.latest ? (
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatDecimal(d.bodyweight.latest.weight)}{' '}
                  <span className="text-sm font-normal text-slate-400">{unit}</span>
                </div>
                {d.bodyweight.changeFromStart !== null && (
                  <div className="text-xs text-slate-500">
                    {d.bodyweight.changeFromStart >= 0 ? '+' : ''}
                    {formatDecimal(d.bodyweight.changeFromStart)} {unit} overall
                  </div>
                )}
              </div>
              <Sparkline values={d.bodyweight.sparkline} color="#38bdf8" />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No weigh-ins yet. Tap “+ Weigh in”.</p>
          )}
        </Card>

        {/* This week */}
        <Card>
          <CardHeader label="This week" />
          <div className="mt-2 flex items-center gap-6">
            <div>
              <div className="text-2xl font-bold tabular-nums">{d.week.workoutsThisWeek}</div>
              <div className="text-xs text-slate-500">workouts</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {d.week.streak}
                <span className="ml-1 text-base">🔥</span>
              </div>
              <div className="text-xs text-slate-500">day streak</div>
            </div>
          </div>
        </Card>

        {/* Macros today */}
        <Card className="md:col-span-2">
          <CardHeader label="Macros today" action={<LinkText onClick={() => navigate('/nutrition')}>Log</LinkText>} />
          <div className="mt-3">
            <MacroRings totals={d.todayTotals} settings={d.settings} />
          </div>
        </Card>

        {/* Weekly volume */}
        <Card>
          <CardHeader label="Weekly volume" />
          <div className="mt-2 flex items-end justify-between">
            <div className="text-2xl font-bold tabular-nums">
              {formatNumber(d.weeklyVolume)} <span className="text-sm font-normal text-slate-400">{unit}</span>
            </div>
            <Sparkline values={d.volumeSparkline} />
          </div>
        </Card>

        {/* Recent PRs */}
        <Card>
          <CardHeader label="Recent PRs" action={<LinkText onClick={() => navigate('/progress')}>All</LinkText>} />
          {d.recentPRs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Finish a workout to earn PRs.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {d.recentPRs.map(({ record, exerciseName }) => (
                <li key={record.id} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 truncate">
                    <span className="text-slate-200">{exerciseName}</span>{' '}
                    <span className="text-slate-500">· {PR_TYPE_LABELS[record.pr_type]}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-beat">
                    {record.pr_type === 'estimated_1rm'
                      ? formatDecimal(record.value)
                      : formatNumber(record.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

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

function Card({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-800 bg-slate-900/50 p-4 ${
        onClick ? 'cursor-pointer hover:border-slate-700' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      {action}
    </div>
  );
}

function LinkText({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-xs text-beat hover:underline"
    >
      {children}
    </button>
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
      <p className="mt-2 text-xs text-slate-500">Logs today’s weigh-in (replaces an existing one).</p>
    </Modal>
  );
}
