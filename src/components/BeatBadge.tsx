import { useState } from 'react';
import type { BeatEvaluation } from '../lib/beatLastTime';

const STATUS_META: Record<
  BeatEvaluation['status'],
  { label: string; dot: string; text: string; ring: string }
> = {
  beat: { label: 'Beat', dot: 'bg-beat', text: 'text-beat', ring: 'border-beat/40' },
  matched: { label: 'Matched', dot: 'bg-matched', text: 'text-matched', ring: 'border-matched/40' },
  down: { label: 'Down', dot: 'bg-down', text: 'text-down', ring: 'border-slate-600' },
  neutral: { label: '', dot: 'bg-slate-600', text: 'text-slate-400', ring: 'border-slate-700' },
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
  const emoji = evaluation.status === 'beat' ? '🟢' : evaluation.status === 'matched' ? '🟡' : '⚪';

  return (
    <button
      type="button"
      onClick={() => evaluation.detail && setOpen((o) => !o)}
      className={`inline-flex flex-col items-end gap-0.5 rounded-lg border px-2 py-1 text-right ${meta.ring}`}
    >
      <span className={`flex items-center gap-1 text-xs font-semibold ${meta.text}`}>
        <span aria-hidden>{emoji}</span>
        {meta.label}
        {evaluation.tag && <span className="font-normal">· {evaluation.tag}</span>}
      </span>
      {open && evaluation.detail && (
        <span className="text-[10px] font-normal text-slate-400">e1RM {evaluation.detail}</span>
      )}
    </button>
  );
}
