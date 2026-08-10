import { describe, expect, it } from 'vitest';
import { computeReadiness } from './readiness';
import { aggregateMuscleVolume, normalizeIntensities } from './muscleVolume';
import {
  defaultIncrement,
  sessionQualifies,
  suggestProgression,
  type RpeSet,
} from './autoRegulation';

describe('computeReadiness', () => {
  it('flags fatigue for a long streak + back-to-back muscles + rising volume', () => {
    const r = computeReadiness({
      consecutiveTrainingDays: 4,
      backToBackMuscles: ['Legs'],
      recentVolumeAvg: 12000,
      priorVolumeAvg: 10000,
    });
    expect(r.level).toBe('fatigued');
    expect(r.reasons).toContain('4 training days in a row');
    expect(r.suggestion).toMatch(/lighter|rest/);
  });

  it('reads fresh for a rested lifter', () => {
    const r = computeReadiness({
      consecutiveTrainingDays: 1,
      backToBackMuscles: [],
      recentVolumeAvg: 9000,
      priorVolumeAvg: 10000,
    });
    expect(r.level).toBe('fresh');
  });

  it('reads moderate for a mid streak with flat volume', () => {
    const r = computeReadiness({
      consecutiveTrainingDays: 3,
      backToBackMuscles: [],
      recentVolumeAvg: 10000,
      priorVolumeAvg: 10000,
    });
    expect(r.level).toBe('moderate');
    expect(r.reasons).toContain('Volume trending flat');
  });

  it('a downward volume trend eases the score', () => {
    const busy = computeReadiness({
      consecutiveTrainingDays: 3,
      backToBackMuscles: [],
      recentVolumeAvg: 7000,
      priorVolumeAvg: 10000,
    });
    // 3-day streak (+2) with volume down (−1) → score 1 → moderate, not fatigued
    expect(busy.level).toBe('moderate');
  });

  it('always gives a reason and a disclaimer-friendly suggestion', () => {
    const r = computeReadiness({
      consecutiveTrainingDays: 0,
      backToBackMuscles: [],
      recentVolumeAvg: null,
      priorVolumeAvg: null,
    });
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.level).toBe('fresh');
  });
});

describe('aggregateMuscleVolume', () => {
  it('credits primary fully and secondary partially', () => {
    const totals = aggregateMuscleVolume([
      { volume: 1000, primaryMuscleId: 'chest', secondaryMuscleIds: ['triceps', 'shoulders'] },
      { volume: 500, primaryMuscleId: 'triceps', secondaryMuscleIds: [] },
    ]);
    expect(totals.chest).toBe(1000);
    expect(totals.triceps).toBe(500 + 500); // 500 primary + 1000×0.5 secondary
    expect(totals.shoulders).toBe(500);
  });

  it('respects a custom secondary factor and ignores zero-volume entries', () => {
    const totals = aggregateMuscleVolume(
      [
        { volume: 0, primaryMuscleId: 'back', secondaryMuscleIds: ['biceps'] },
        { volume: 800, primaryMuscleId: 'back', secondaryMuscleIds: ['biceps'] },
      ],
      0.25,
    );
    expect(totals.back).toBe(800);
    expect(totals.biceps).toBe(200);
  });

  it('normalizeIntensities scales to the max', () => {
    const norm = normalizeIntensities({ a: 500, b: 1000, c: 0 });
    expect(norm.b).toBe(1);
    expect(norm.a).toBe(0.5);
    expect(norm.c).toBe(0);
  });
});

describe('RPE auto-regulation', () => {
  const easy = (weight: number, reps: number, rpe: number): RpeSet => ({
    weight,
    reps,
    rpe,
    is_warmup: false,
    is_completed: true,
  });

  it('default increment differs by unit', () => {
    expect(defaultIncrement('lbs')).toBe(5);
    expect(defaultIncrement('kg')).toBe(2.5);
  });

  it('sessionQualifies needs target reps at RPE ≤ 7', () => {
    expect(sessionQualifies([easy(185, 8, 7)], 8)).toEqual({ qualifies: true, weight: 185 });
    expect(sessionQualifies([easy(185, 8, 8.5)], 8).qualifies).toBe(false); // too hard
    expect(sessionQualifies([easy(185, 6, 7)], 8).qualifies).toBe(false); // short of reps
    expect(sessionQualifies([{ ...easy(185, 8, 7), is_warmup: true }], 8).qualifies).toBe(false);
  });

  it('suggests +5 lb after two easy sessions running', () => {
    const result = suggestProgression([[easy(185, 8, 7)], [easy(185, 8, 6.5)]], 8, 'lbs');
    expect(result.suggest).toBe(true);
    expect(result.suggestedWeight).toBe(190);
    expect(result.reason).toContain('try 190 lbs');
  });

  it('does not suggest if only one session qualifies', () => {
    const result = suggestProgression([[easy(185, 8, 7)], [easy(185, 8, 9)]], 8, 'lbs');
    expect(result.suggest).toBe(false);
    expect(result.suggestedWeight).toBeNull();
  });

  it('does not suggest with fewer than two sessions', () => {
    expect(suggestProgression([[easy(185, 8, 7)]], 8, 'lbs').suggest).toBe(false);
  });

  it('uses kg increment for metric users', () => {
    const result = suggestProgression([[easy(100, 8, 7)], [easy(100, 8, 7)]], 8, 'kg');
    expect(result.suggestedWeight).toBe(102.5);
  });
});
