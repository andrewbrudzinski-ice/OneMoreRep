import { READINESS_DISCLAIMER, type ReadinessLevel, type ReadinessResult } from '../lib/readiness';
import { Divider, Panel, PanelHeader, Ring } from './primitives';

const LEVEL_META: Record<ReadinessLevel, { word: string; state: string; color: string }> = {
  fresh: { word: 'PRIMED', state: 'Recovered', color: '#8FE81E' },
  moderate: { word: 'MODERATE', state: 'Managed', color: '#F2B33D' },
  fatigued: { word: 'FATIGUED', state: 'Loaded', color: '#FB923C' },
};

/** VOLUME TREND from the recent-vs-prior working-volume averages. */
function volumeTrend(recent: number | null, prior: number | null): string {
  if (recent === null || prior === null || prior <= 0) return '—';
  const ratio = recent / prior;
  if (ratio >= 1.15) return 'Up';
  if (ratio <= 0.85) return 'Down';
  return 'Flat';
}

/** One open signal column (no box) — label over value, divided by hairlines. */
function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <div className="text-[8.5px] font-bold uppercase leading-none tracking-[0.1em] text-ink3">
        {label}
      </div>
      <div className="mt-1.5 truncate text-[14px] font-extrabold leading-none tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

/**
 * Training-readiness hero — a 0–100 index ring (transparent transform of the
 * user's own log, not a medical score) with the qualitative level beside it and
 * the engine's real input signals below as open, divided columns.
 */
export function ReadinessCard({ readiness, p = 1 }: { readiness: ReadinessResult; p?: number }) {
  const meta = LEVEL_META[readiness.level];
  const { input } = readiness;
  const backToBack =
    input.backToBackMuscles.length === 0 ? 'None' : String(input.backToBackMuscles.length);
  const score = Math.round(readiness.index * p);

  return (
    <Panel feature className="p-5">
      <PanelHeader
        label="Training readiness"
        action={<span className="text-[11px] font-medium text-ink3">Today</span>}
      />

      <div className="mt-4 flex items-start gap-5">
        <Ring value={readiness.index} p={p} color={meta.color} size={118}>
          <span className="text-[33px] font-extrabold leading-none tabular-nums" style={{ color: meta.color }}>
            {score}
          </span>
          <span className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.14em] text-ink3">
            Ready
          </span>
        </Ring>

        <div className="min-w-0 flex-1 pt-0.5">
          <div
            className="text-[28px] font-extrabold leading-[0.9] tracking-[-0.03em]"
            style={{ color: meta.color }}
          >
            {meta.word}
          </div>
          <div className="mt-1.5">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
              style={{ background: `${meta.color}1F`, color: meta.color }}
            >
              {meta.state}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-[1.45] text-ink2">{readiness.suggestion}</p>
          {readiness.reasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {readiness.reasons.slice(0, 2).map((reason) => (
                <li key={reason} className="flex gap-2 text-[11.5px] leading-snug text-ink3">
                  <span className="mt-[1px] text-ink5">—</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Divider className="mt-4" />

      {/* Signals — open, divided columns (no boxes) */}
      <div className="mt-3.5 flex divide-x divide-hairline">
        <Signal label="Days on" value={String(input.consecutiveTrainingDays)} />
        <Signal label="Back-to-back" value={backToBack} />
        <Signal label="Vol. trend" value={volumeTrend(input.recentVolumeAvg, input.priorVolumeAvg)} />
      </div>

      <p className="mt-4 text-[10.5px] leading-tight text-ink4">{READINESS_DISCLAIMER}</p>
    </Panel>
  );
}
