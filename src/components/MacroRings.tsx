import { progressRatio } from '../lib/nutrition';
import type { MacroTotals } from '../lib/nutrition';
import type { Settings } from '../types';
import { formatNumber } from '../lib/format';

interface RingSpec {
  key: keyof MacroTotals;
  label: string;
  color: string;
  target: number | null;
  unit: string;
}

/** A single circular progress ring. */
function Ring({
  label,
  value,
  target,
  color,
  unit,
}: {
  label: string;
  value: number;
  target: number | null;
  color: string;
  unit: string;
}) {
  const size = 72;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = progressRatio(value, target);
  const offset = circumference * (1 - ratio);
  const over = target !== null && target > 0 && value > target;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular-nums leading-none">{formatNumber(value)}</span>
          {target !== null && (
            <span className={`text-[10px] leading-none ${over ? 'text-matched' : 'text-slate-500'}`}>
              /{formatNumber(target)}
            </span>
          )}
        </div>
      </div>
      <span className="text-[11px] text-slate-400">
        {label}
        {unit ? ` (${unit})` : ''}
      </span>
    </div>
  );
}

/**
 * Four primary macro rings (calories, protein, carbs, fat) with fiber as a
 * secondary bar (§12 — 4 rings read cleaner than 5).
 */
export function MacroRings({ totals, settings }: { totals: MacroTotals; settings: Settings }) {
  const rings: RingSpec[] = [
    { key: 'calories', label: 'Cal', color: '#22c55e', target: settings.calorie_target, unit: '' },
    { key: 'protein', label: 'Protein', color: '#38bdf8', target: settings.protein_target, unit: 'g' },
    { key: 'carbs', label: 'Carbs', color: '#f59e0b', target: settings.carb_target, unit: 'g' },
    { key: 'fat', label: 'Fat', color: '#a78bfa', target: settings.fat_target, unit: 'g' },
  ];

  const fiberTarget = settings.fiber_target;
  const fiberRatio = progressRatio(totals.fiber, fiberTarget);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="grid grid-cols-4 gap-1">
        {rings.map((ring) => (
          <Ring
            key={ring.key}
            label={ring.label}
            value={Math.round(totals[ring.key])}
            target={ring.target}
            color={ring.color}
            unit={ring.unit}
          />
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>Fiber</span>
          <span className="tabular-nums">
            {formatNumber(Math.round(totals.fiber))}
            {fiberTarget ? ` / ${formatNumber(fiberTarget)} g` : ' g'}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-slate-400" style={{ width: `${fiberRatio * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
