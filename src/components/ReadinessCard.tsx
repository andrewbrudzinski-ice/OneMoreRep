import { READINESS_DISCLAIMER, type ReadinessResult } from '../lib/readiness';

const META: Record<ReadinessResult['level'], { label: string; color: string; emoji: string }> = {
  fresh: { label: 'Fresh', color: 'text-beat', emoji: '🟢' },
  moderate: { label: 'Moderate', color: 'text-matched', emoji: '🟡' },
  fatigued: { label: 'Fatigued', color: 'text-orange-400', emoji: '🟠' },
};

/** Training-readiness card — qualitative, reasons shown, clearly non-medical. */
export function ReadinessCard({ readiness }: { readiness: ReadinessResult }) {
  const meta = META[readiness.level];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">Training readiness</span>
        <span className={`text-sm font-semibold ${meta.color}`}>
          {meta.emoji} {meta.label}
        </span>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm text-slate-300">
        {readiness.reasons.map((reason) => (
          <li key={reason} className="flex gap-1.5">
            <span className="text-slate-600">•</span>
            {reason}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-slate-200">{readiness.suggestion}</p>
      <p className="mt-2 text-[11px] text-slate-600">{READINESS_DISCLAIMER}</p>
    </div>
  );
}
