import { READINESS_DISCLAIMER, type ReadinessLevel, type ReadinessResult } from '../lib/readiness';

const LEVELS: ReadinessLevel[] = ['fresh', 'moderate', 'fatigued'];

const LEVEL_META: Record<ReadinessLevel, { word: string; label: string; color: string }> = {
  fresh: { word: 'FRESH', label: 'Fresh', color: '#8FE81E' },
  moderate: { word: 'MODERATE', label: 'Moderate', color: '#F2B33D' },
  fatigued: { word: 'FATIGUED', label: 'Fatigued', color: '#FB923C' },
};

/** VOLUME TREND from the recent-vs-prior working-volume averages. */
function volumeTrend(recent: number | null, prior: number | null): string {
  if (recent === null || prior === null || prior <= 0) return '—';
  const ratio = recent / prior;
  if (ratio >= 1.15) return 'Up';
  if (ratio <= 0.85) return 'Down';
  return 'Flat';
}

function Signal({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div className={`px-[14px] py-3 ${first ? '' : 'border-l border-white/[0.08]'}`}>
      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink3">{label}</div>
      <div className="mt-1 truncate text-[15px] font-extrabold tabular-nums text-ink">{value}</div>
    </div>
  );
}

/**
 * Training-readiness poster — qualitative, non-medical. The level word and a
 * 3-segment state ladder replace the emoji dot; the signals grid surfaces the
 * inputs the engine actually read so the level stays auditable.
 */
export function ReadinessCard({ readiness }: { readiness: ReadinessResult }) {
  const meta = LEVEL_META[readiness.level];
  const { input } = readiness;
  const backToBack =
    input.backToBackMuscles.length === 0 ? 'None' : input.backToBackMuscles.join(', ');

  return (
    <section className="border-t-2 border-accent bg-surface">
      {/* Label row */}
      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
          Readiness
        </span>
        <span className="text-[11px] text-ink3">Today</span>
      </div>

      {/* Level word */}
      <div
        className="px-5 text-[56px] font-extrabold leading-[0.86] tracking-[-0.045em]"
        style={{ color: meta.color }}
      >
        {meta.word}
      </div>

      {/* State ladder */}
      <div className="grid grid-cols-3 gap-[3px] px-5 pt-4">
        {LEVELS.map((level) => {
          const active = level === readiness.level;
          return (
            <div
              key={level}
              className="px-0.5 py-1.5 text-center text-[8.5px] font-extrabold uppercase tracking-[0.12em] transition-[background-color,color] duration-[250ms]"
              style={
                active
                  ? { background: LEVEL_META[level].color, color: '#0D1014' }
                  : { background: '#1B2027', color: '#7A838B' }
              }
            >
              {LEVEL_META[level].label}
            </div>
          );
        })}
      </div>

      {/* Suggestion */}
      <p className="px-5 pt-4 text-[14px] leading-[1.45] text-ink">{readiness.suggestion}</p>

      {/* Reasons */}
      <ul className="px-5 pt-2">
        {readiness.reasons.map((reason) => (
          <li key={reason} className="flex gap-2 py-0.5 text-[12.5px] leading-snug text-ink2">
            <span className="text-ink5">—</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      {/* Signals grid — the inputs the engine reads */}
      <div className="mt-3 grid grid-cols-3 border-t border-white/[0.08]">
        <Signal label="Consec. days" value={String(input.consecutiveTrainingDays)} first />
        <Signal label="Back-to-back" value={backToBack} />
        <Signal label="Volume trend" value={volumeTrend(input.recentVolumeAvg, input.priorVolumeAvg)} />
      </div>

      {/* Disclaimer */}
      <p className="px-5 pb-[14px] pt-2 text-[10.5px] text-ink4">{READINESS_DISCLAIMER}</p>
    </section>
  );
}
