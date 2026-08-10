import { useMemo, useState } from 'react';
import {
  computePlates,
  defaultBar,
  defaultPlates,
  formatPerSide,
} from '../lib/plateCalculator';
import type { Units } from '../types';

/**
 * Inline plate calculator for Workout Mode. Reads the current target weight
 * and shows the per-side breakdown. Bar weight is adjustable; plate inventory
 * uses the standard set for the unit.
 */
export function PlateCalculatorPanel({ weight, unit }: { weight: number; unit: Units }) {
  const [open, setOpen] = useState(false);
  const [bar, setBar] = useState(() => defaultBar(unit));
  const plates = useMemo(() => defaultPlates(unit), [unit]);
  const result = useMemo(() => computePlates(weight, bar, plates), [weight, bar, plates]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
      >
        <span className="flex items-center gap-2 text-slate-300">
          🧮 Plates
          <span className="text-slate-500">
            {result.achievable ? formatPerSide(result) : 'not loadable'} · {weight} {unit}
          </span>
        </span>
        <span className="text-slate-600">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-800 px-3 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Bar</span>
            {[defaultBar(unit), unit === 'kg' ? 15 : 35].map((b) => (
              <button
                key={b}
                onClick={() => setBar(b)}
                className={`rounded-lg px-2.5 py-1 text-xs ${
                  bar === b ? 'bg-beat text-onaccent' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {b} {unit}
              </button>
            ))}
          </div>

          {result.achievable ? (
            <div>
              <div className="text-xs text-slate-400">Per side</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {result.perSide.length === 0 ? (
                  <span className="text-slate-500">Empty bar</span>
                ) : (
                  result.perSide.flatMap((p) =>
                    Array.from({ length: p.count }).map((_, i) => (
                      <span
                        key={`${p.plate}-${i}`}
                        className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium tabular-nums text-slate-100"
                      >
                        {p.plate}
                      </span>
                    )),
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-down">
              Can’t match {weight} {unit} on a {bar} {unit} bar with standard plates.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
