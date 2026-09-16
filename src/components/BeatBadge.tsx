import { useState } from 'react';
import type { BeatEvaluation } from '../lib/beatLastTime';

// The Beat / Matched / Down triple maps to accent / moderate / secondary ink —
// no red, no emoji; a small square swatch carries the status color.
const STATUS_META: Record<
  BeatEvaluation['status'],
  { label: string; dot: string; text: string; ring: string }
> = {
  beat: { label: 'Beat', dot: 'bg-accent', text: 'text-accent', ring: 'border-accent/40' },
  matched: { label: 'Matched', dot: 'bg-moderate', text: 'text-moderate', ring: 'border-moderate/40' },
  down: { label: 'Down', dot: 'bg-ink2', text: 'text-ink2', ring: 'border-white/[0.18]' },
  neutral: { label: '', dot: 'bg-ink4', text: 'text-ink4', ring: 'border-white/[0.12]' },
};

/**
 * Reason-tagged Beat Last Time status. Green carries its reason ("+5 lbs") and
 * exposes the honest e1RM comparison on tap — green never implies "better in
 * every way".
 */
export function BeatBadge({ evaluation }: { evaluation: BeatEvaluation | null }) {
  const [open, setOpen] = useState(false);
  if (!evaluation || evaluation.status === 'neutral') {
    return <span className="text-xs text-slate-600">—</span>;
  }
  const meta = STATUS_META[evaluation.status];

  return (
    <button
      type="button"
      onClick={() => evaluation.detail && setOpen((o) => !o)}
      className={`inline-flex flex-col items-end gap-0.5 border px-2 py-1 text-right ${meta.ring}`}
    >
      <span className={`flex items-center gap-1.5 text-xs font-extrabold ${meta.text}`}>
        <span aria-hidden className={`h-2 w-2 ${meta.dot}`} />
        {meta.label}
        {evaluation.tag && <span className="font-normal">· {evaluation.tag}</span>}
      </span>
      {open && evaluation.detail && (
        <span className="text-[10px] font-normal text-ink2">e1RM {evaluation.detail}</span>
      )}
    </button>
  );
}
