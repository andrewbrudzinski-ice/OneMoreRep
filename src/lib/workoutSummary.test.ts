import { describe, expect, it } from 'vitest';
import { summarizeVsLast } from './workoutSummary';

describe('summarizeVsLast', () => {
  it('first session — nothing to compare', () => {
    const r = summarizeVsLast({ intent: 'normal', currentVolume: 5000, lastVolume: null });
    expect(r.tone).toBe('first');
    expect(r.percent).toBeNull();
  });

  it('more volume → up with a +% label', () => {
    const r = summarizeVsLast({ intent: 'normal', currentVolume: 5150, lastVolume: 5000 });
    expect(r.tone).toBe('up');
    expect(r.percent).toBeCloseTo(3, 5);
    expect(r.label).toBe('+3.0% volume vs last');
  });

  it('less volume → down with a −% label (never red wording)', () => {
    const r = summarizeVsLast({ intent: 'normal', currentVolume: 4500, lastVolume: 5000 });
    expect(r.tone).toBe('down');
    expect(r.label).toBe('−10.0% volume vs last');
  });

  it('on par within the flat band', () => {
    const r = summarizeVsLast({ intent: 'normal', currentVolume: 5010, lastVolume: 5000 });
    expect(r.tone).toBe('flat');
    expect(r.label).toBe('On par with last session');
  });

  it('deload day → intentional wording, not a shortfall', () => {
    const r = summarizeVsLast({ intent: 'deload', currentVolume: 3000, lastVolume: 5000 });
    expect(r.tone).toBe('deload');
    expect(r.label).toBe('Deload — volume intentionally reduced');
  });

  it('light day → intentional wording', () => {
    const r = summarizeVsLast({ intent: 'light', currentVolume: 3500, lastVolume: 5000 });
    expect(r.tone).toBe('light');
    expect(r.label).toBe('Light day — volume intentionally reduced');
  });

  it('auto safety net: sharp drop vs recent average → "lighter", not a red number', () => {
    const r = summarizeVsLast({
      intent: 'normal',
      currentVolume: 3000,
      lastVolume: 5000,
      recentAverage: 5000,
    });
    expect(r.tone).toBe('lighter');
    expect(r.label).toBe('Lighter session than usual');
  });

  it('a normal-sized session near the average is not flagged lighter', () => {
    const r = summarizeVsLast({
      intent: 'normal',
      currentVolume: 4800,
      lastVolume: 5000,
      recentAverage: 5000,
    });
    expect(r.tone).toBe('down');
  });
});
