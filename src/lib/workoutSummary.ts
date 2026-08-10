import type { WorkoutIntent } from '../types';

/**
 * Workout-summary vs-last wording — pure, unit-tested. "Chase green, never
 * punish": a deliberate light/deload day is framed as intentional, and an
 * unusually light session (auto safety net) reads as "lighter", never as a
 * red negative number.
 */

export type VsLastTone = 'first' | 'up' | 'flat' | 'down' | 'deload' | 'light' | 'lighter';

export interface VsLastResult {
  /** Signed percent change vs last comparable session, or null if none. */
  percent: number | null;
  tone: VsLastTone;
  label: string;
}

export interface VsLastInput {
  intent: WorkoutIntent;
  currentVolume: number;
  /** Working volume of the last comparable session, or null if none. */
  lastVolume: number | null;
  /** Rolling average of recent comparable sessions, for the safety net. */
  recentAverage?: number | null;
}

/** Below this fraction of the recent average → auto "lighter session". */
const LIGHTER_FRACTION = 0.7;
/** Dead-band around 0% that reads as "on par". */
const FLAT_BAND = 0.5;

function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

export function summarizeVsLast(input: VsLastInput): VsLastResult {
  const { intent, currentVolume, lastVolume, recentAverage } = input;

  if (lastVolume === null || lastVolume <= 0) {
    return { percent: null, tone: 'first', label: 'First session to compare against' };
  }

  const percent = ((currentVolume - lastVolume) / lastVolume) * 100;

  // Intentional light / deload days are never framed as a shortfall.
  if (intent === 'deload') {
    return { percent, tone: 'deload', label: 'Deload — volume intentionally reduced' };
  }
  if (intent === 'light') {
    return { percent, tone: 'light', label: 'Light day — volume intentionally reduced' };
  }

  // Auto safety net: a sharp drop below the recent baseline reads as "lighter".
  if (
    recentAverage !== undefined &&
    recentAverage !== null &&
    recentAverage > 0 &&
    currentVolume < recentAverage * LIGHTER_FRACTION
  ) {
    return { percent, tone: 'lighter', label: 'Lighter session than usual' };
  }

  if (percent > FLAT_BAND) {
    return { percent, tone: 'up', label: `${formatPercent(percent)} volume vs last` };
  }
  if (percent < -FLAT_BAND) {
    return { percent, tone: 'down', label: `${formatPercent(percent)} volume vs last` };
  }
  return { percent, tone: 'flat', label: 'On par with last session' };
}
