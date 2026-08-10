import type { PRType } from '../types';

const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimalFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** Whole-number formatting with thousands separators (e.g. volume). */
export function formatNumber(n: number): string {
  return numberFmt.format(n);
}

/** One-decimal formatting (e.g. e1RM). */
export function formatDecimal(n: number): string {
  return oneDecimalFmt.format(n);
}

/** Short calendar date, e.g. "Jan 15". */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Longer date with year, e.g. "Jan 15, 2026". */
export function formatLongDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const PR_TYPE_LABELS: Record<PRType, string> = {
  heaviest_weight: 'Heaviest weight',
  reps_at_weight: 'Most reps',
  estimated_1rm: 'Best est. 1RM',
  best_set_volume: 'Best set volume',
  best_workout_volume: 'Best session volume',
};
