import { useState } from 'react';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { Button, EmptyState, ErrorState, Modal, Spinner, TextField } from '../components/ui';
import { Panel, PanelHeader, SectionHeader } from '../components/primitives';
import { useRepository } from '../repository/repositoryContext';
import { useAsync } from '../hooks/useAsync';
import { todayDateString } from '../lib/id';
import { addDays, dayDiff } from '../lib/dates';
import type { Mesocycle } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mesocycleStatus(m: Mesocycle): 'upcoming' | 'active' | 'completed' {
  const today = todayDateString();
  const end = addDays(m.start_date, m.weeks * 7);
  if (today < m.start_date) return 'upcoming';
  if (today >= end) return 'completed';
  return 'active';
}

function currentWeekIndex(m: Mesocycle): number {
  const today = todayDateString();
  const elapsed = dayDiff(today, m.start_date);
  return Math.min(Math.floor(elapsed / 7), m.weeks - 1);
}

function formatDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function MesocycleScreen() {
  const repository = useRepository();
  const [showCreate, setShowCreate] = useState(false);

  const state = useAsync(() => repository.getMesocycles(), []);

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;

  const mesocycles = state.data ?? [];

  return (
    <>
      <ScreenHeader
        kicker="Structured training blocks"
        title="Mesocycles"
        action={
          <Button variant="ghost" onClick={() => setShowCreate(true)}>
            New
          </Button>
        }
      />

      <PageBody>
        {mesocycles.length === 0 ? (
          <EmptyState
            title="No mesocycles yet"
            note="Plan a 4–6 week training block with a built-in deload to structure your progress."
          />
        ) : (
          <section>
            <SectionHeader label="Your blocks" />
            <ul className="mt-1 space-y-3">
              {mesocycles.map((m) => (
                <MesocycleCard
                  key={m.id}
                  meso={m}
                  onDelete={async () => {
                    await repository.deleteMesocycle(m.id);
                    state.reload();
                  }}
                />
              ))}
            </ul>
          </section>
        )}

        <section className="pt-2">
          <SectionHeader label="What's a mesocycle?" />
          <div className="mt-3 space-y-3 text-[12.5px] leading-[1.6] text-ink2">
            <p>
              A <span className="font-extrabold text-ink">mesocycle</span> is a focused training
              block — typically 4–6 weeks — where you progressively overload the same exercises
              before taking a deload week to recover and consolidate gains.
            </p>
            <p>
              Research shows training in structured blocks with planned deloads produces better
              long-term strength and hypertrophy than endless random variation.
            </p>
          </div>
        </section>
      </PageBody>

      {showCreate && (
        <CreateMesocycleModal
          onClose={() => setShowCreate(false)}
          onCreate={async (input) => {
            await repository.createMesocycle(input);
            setShowCreate(false);
            state.reload();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Mesocycle card
// ---------------------------------------------------------------------------

const STATUS_META = {
  upcoming: { label: 'Upcoming', color: 'text-ink3 bg-surface2 border-hairline' },
  active: { label: 'Active', color: 'text-accent bg-accent/10 border-accent/25' },
  completed: { label: 'Done', color: 'text-beat bg-beat/10 border-beat/25' },
};

function MesocycleCard({ meso, onDelete }: { meso: Mesocycle; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = mesocycleStatus(meso);
  const meta = STATUS_META[status];
  const endDate = addDays(meso.start_date, meso.weeks * 7);
  const currentWeek = status === 'active' ? currentWeekIndex(meso) : -1;

  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-extrabold text-ink">{meso.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink3">
            {formatDate(meso.start_date)} – {formatDate(endDate)}
            {meso.deload_week && (
              <span className="ml-1.5 rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold text-ink3">
                deload wk {meso.weeks}
              </span>
            )}
          </div>
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 text-[11.5px] text-ink4 hover:text-error"
          >
            Delete
          </button>
        ) : (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11.5px] text-ink3"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              className="text-[11.5px] font-semibold text-error"
            >
              Confirm
            </button>
          </div>
        )}
      </div>

      {/* Week timeline */}
      <div className="mt-4 flex gap-1">
        {Array.from({ length: meso.weeks }, (_, i) => {
          const isDeload = meso.deload_week && i === meso.weeks - 1;
          const isCurrent = status === 'active' && i === currentWeek;
          const isDone = status === 'completed' || (status === 'active' && i < currentWeek);
          return (
            <div key={i} className="flex-1">
              <div
                className={`h-[6px] rounded-full ${
                  isCurrent
                    ? 'bg-accent'
                    : isDone
                      ? 'bg-accent/40'
                      : isDeload
                        ? 'bg-[#F2B33D]/30 border border-[#F2B33D]/50'
                        : 'bg-surface2'
                }`}
              />
              <div className="mt-1 text-center text-[8.5px] text-ink4">
                {isDeload ? 'D' : `W${i + 1}`}
              </div>
            </div>
          );
        })}
      </div>

      {status === 'active' && (
        <p className="mt-2 text-[11.5px] text-ink2">
          Week {currentWeek + 1} of {meso.weeks}
          {meso.deload_week && currentWeek === meso.weeks - 1 && (
            <span className="ml-1 font-semibold text-[#F2B33D]">· Deload week</span>
          )}
        </p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Create modal
// ---------------------------------------------------------------------------

function CreateMesocycleModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: { name: string; start_date: string; weeks: number; deload_week: boolean; notes: null }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayDateString());
  const [weeks, setWeeks] = useState(5);
  const [deload, setDeload] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), start_date: startDate, weeks, deload_week: deload, notes: null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Mesocycle" onClose={onClose}>
      <div className="space-y-4">
        <TextField
          label="Block name"
          placeholder="e.g. Hypertrophy Block 1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <label className="mb-1.5 block text-[11.5px] font-semibold text-ink2">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-tile border border-line bg-surface2 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11.5px] font-semibold text-ink2">Duration</label>
          <div className="flex gap-2">
            {[4, 5, 6].map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className={`flex-1 rounded-tile border py-2 text-[13px] font-semibold transition-colors ${
                  weeks === w
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line bg-surface2 text-ink2'
                }`}
              >
                {w} weeks
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-tile border border-line bg-surface2 p-3.5">
          <span className="text-sm text-ink">
            <span className="font-semibold">Deload final week</span>
            <span className="mt-0.5 block text-xs text-ink3">
              Plan week {weeks} as a reduced-volume recovery week.
            </span>
          </span>
          <input
            type="checkbox"
            checked={deload}
            onChange={(e) => setDeload(e.target.checked)}
            className="h-5 w-5 accent-beat"
          />
        </label>

        <div className="pt-1">
          <Button
            variant="primary"
            onClick={submit}
            disabled={saving || !name.trim()}
            className="w-full"
          >
            {saving ? 'Creating…' : 'Start block'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
