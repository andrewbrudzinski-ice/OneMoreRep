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
    <div className="rounded-tile border border-line bg-surface2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
      >
        <span className="flex items-center gap-2 text-ink2">
          🧮 Plates
          <span className="text-ink3">
            {result.achievable ? formatPerSide(result) : 'not loadable'} · {weight} {unit}
          </span>
        </span>
        <span className="text-ink4">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-hairline px-3 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink3">Bar</span>
            {[defaultBar(unit), unit === 'kg' ? 15 : 35].map((b) => (
              <button
                key={b}
                onClick={() => setBar(b)}
                className={`rounded-control px-2.5 py-1 text-xs transition-colors ${
                  bar === b ? 'bg-accent text-on-accent' : 'border border-line bg-surface text-ink2'
                }`}
              >
                {b} {unit}
              </button>
            ))}
          </div>

          {result.achievable ? (
            <div>
              <div className="text-xs text-ink3">Per side</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.perSide.length === 0 ? (
                  <span className="text-ink4">Empty bar</span>
                ) : (
                  result.perSide.flatMap((p) =>
                    Array.from({ length: p.count }).map((_, i) => (
                      <span
                        key={`${p.plate}-${i}`}
                        className="rounded-control border border-line bg-surface px-2 py-1 text-xs font-semibold tabular-nums text-ink"
                      >
                        {p.plate}
                      </span>
                    )),
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-ink3">
              Can’t match {weight} {unit} on a {bar} {unit} bar with standard plates.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
