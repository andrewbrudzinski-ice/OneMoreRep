import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, EmptyState, Modal, Spinner, TextField } from '../components/ui';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { rollingAverageByDays } from '../lib/rollingAverage';
import { formatDecimal, formatLongDate, formatShortDate } from '../lib/format';
import { todayDateString } from '../lib/id';
import type { BodyWeightEntry } from '../types';

export function BodyweightScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BodyWeightEntry | null>(null);

  const state = useAsync(async () => {
    const [entries, stats, settings] = await Promise.all([
      repository.getBodyWeightEntries(),
      repository.getBodyWeightStats(),
      repository.getSettings(),
    ]);
    return { entries, stats, settings };
  }, []);

  const chartData = useMemo(() => {
    const entries = state.data?.entries ?? [];
    const points = entries.map((e) => ({ date: e.date, value: e.weight }));
    const avg7 = rollingAverageByDays(points, 7);
    const avg30 = rollingAverageByDays(points, 30);
    return entries.map((e, i) => ({
      label: formatShortDate(e.date),
      weight: e.weight,
      avg7: Math.round(avg7[i]! * 10) / 10,
      avg30: Math.round(avg30[i]! * 10) / 10,
    }));
  }, [state.data?.entries]);

  async function save(date: string, weight: number, note: string, id?: string) {
    if (id) await repository.updateBodyWeightEntry(id, { date, weight, note });
    else await repository.addBodyWeightEntry({ date, weight, note });
    setAdding(false);
    setEditing(null);
    state.reload();
  }

  async function remove(entry: BodyWeightEntry) {
    await repository.deleteBodyWeightEntry(entry.id);
    state.reload();
  }

  if (state.loading || !state.data) return <Spinner />;

  const { entries, stats, settings } = state.data;
  const unit = settings.units;
  const reversed = [...entries].reverse();

  return (
    <>
      <ScreenHeader
        title="Bodyweight"
        subtitle="Trend & weigh-ins"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              + Weigh in
            </Button>
          </div>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon="⚖️"
          title="No weigh-ins yet"
          note="Add your weight to see a trend line smoothed by a 7-day rolling average."
        />
      ) : (
        <div className="space-y-5 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Current" value={fmt(stats.current, unit)} />
            <Stat label="Change" value={fmtDelta(stats.change, unit)} />
            <Stat label="7-day avg" value={fmt(stats.avg7, unit)} />
            <Stat label="30-day avg" value={fmt(stats.avg30, unit)} />
            <Stat label="High" value={fmt(stats.high, unit)} />
            <Stat label="Low" value={fmt(stats.low, unit)} />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-400">
              <Legend color="#334155" label="Raw" />
              <Legend color="#22c55e" label="7-day avg" />
              <Legend color="#38bdf8" label="30-day avg" />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={['dataMin - 2', 'dataMax + 2']}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    color: '#e2e8f0',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#334155"
                  strokeWidth={1.5}
                  dot={{ r: 1.5 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="avg7"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="avg30"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-300">Weigh-ins</h2>
            <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
              {reversed.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(entry)}>
                    <div className="text-sm font-medium tabular-nums">
                      {formatDecimal(entry.weight)} {unit}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatLongDate(entry.date)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  </button>
                  <button
                    onClick={() => remove(entry)}
                    className="h-8 w-8 shrink-0 text-slate-600 hover:text-red-400"
                    aria-label="Delete weigh-in"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(adding || editing) && (
        <EntryForm
          initial={editing}
          unit={unit}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
    </>
  );
}

function fmt(value: number | null, unit: string): string {
  return value === null ? '—' : `${formatDecimal(value)} ${unit}`;
}

function fmtDelta(value: number | null, unit: string): string {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${formatDecimal(value)} ${unit}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function EntryForm({
  initial,
  unit,
  onCancel,
  onSave,
}: {
  initial: BodyWeightEntry | null;
  unit: string;
  onCancel: () => void;
  onSave: (date: string, weight: number, note: string, id?: string) => void | Promise<void>;
}) {
  const [date, setDate] = useState(initial?.date ?? todayDateString());
  const [weight, setWeight] = useState(initial ? String(initial.weight) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const w = Number(weight);
  const canSave = weight.trim() !== '' && !Number.isNaN(w) && w > 0;

  return (
    <Modal
      title={initial ? 'Edit weigh-in' : 'Weigh in'}
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSave}
            onClick={() => canSave && onSave(date, w, note.trim(), initial?.id)}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField
          label={`Weight (${unit})`}
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          autoFocus
        />
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
