import { describe, expect, it } from 'vitest';
import {
  bestE1RM,
  epley1RM,
  evaluateSet,
  findComparableSet,
  workingVolume,
  type ComparableSet,
} from './beatLastTime';

describe('epley1RM', () => {
  it('computes weight × (1 + reps/30)', () => {
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(185, 10)).toBeCloseTo(246.6667, 3);
    expect(epley1RM(190, 8)).toBeCloseTo(240.6667, 3);
    expect(epley1RM(100, 30)).toBe(200);
  });
});

describe('findComparableSet', () => {
  const prior: ComparableSet[] = [
    { weight: 185, reps: 10 },
    { weight: 185, reps: 8 },
    { weight: 175, reps: 10 },
  ];

  it('picks the closest weight', () => {
    expect(findComparableSet(176, prior)?.weight).toBe(175);
  });

  it('breaks weight ties toward the strongest (highest e1RM) set', () => {
    // Two 185 sets — the 185×10 has the higher e1RM.
    const comp = findComparableSet(190, prior);
    expect(comp?.weight).toBe(185);
    expect(comp?.reps).toBe(10);
  });

  it('returns null when there are no prior sets', () => {
    expect(findComparableSet(100, [])).toBeNull();
  });
});

describe('evaluateSet — the headline load case (185×10 → 190×8)', () => {
  const prior: ComparableSet[] = [
    { weight: 185, reps: 10 },
    { weight: 185, reps: 8 },
    { weight: 175, reps: 10 },
  ];

  it('reads green on load (+5 lbs) even though e1RM dipped, with honest detail', () => {
    const result = evaluateSet({ weight: 190, reps: 8 }, prior);
    expect(result.status).toBe('beat');
    expect(result.axis).toBe('load');
    expect(result.color).toBe('green');
    expect(result.tag).toBe('+5 lbs');
    // Honest e1RM comparison surfaced: 240.7 vs 246.7 (compared to 185×10).
    expect(result.detail).toBe('240.7 vs 246.7');
    expect(result.comparison?.reps).toBe(10);
  });

  it('respects the unit option in the tag', () => {
    const result = evaluateSet({ weight: 92.5, reps: 8 }, [{ weight: 90, reps: 8 }], {
      unit: 'kg',
    });
    expect(result.tag).toBe('+2.5 kg');
  });
});

describe('evaluateSet — reps axis', () => {
  it('more reps at same weight → green (+reps)', () => {
    const result = evaluateSet({ weight: 185, reps: 11 }, [{ weight: 185, reps: 10 }]);
    expect(result.status).toBe('beat');
    expect(result.axis).toBe('reps');
    expect(result.tag).toBe('+1 rep');
  });

  it('pluralizes the reps tag', () => {
    const result = evaluateSet({ weight: 185, reps: 12 }, [{ weight: 185, reps: 10 }]);
    expect(result.tag).toBe('+2 reps');
  });
});

describe('evaluateSet — strength axis', () => {
  it('lower weight but clearly higher e1RM → green (stronger)', () => {
    // 175×12 e1RM = 245 vs 185×8 e1RM = 234.3 → +4.6%, beyond the 2% band.
    const result = evaluateSet({ weight: 175, reps: 12 }, [{ weight: 185, reps: 8 }]);
    expect(result.status).toBe('beat');
    expect(result.axis).toBe('strength');
    expect(result.tag).toBe('stronger');
  });
});

describe('evaluateSet — matched', () => {
  it('identical set → amber matched', () => {
    const result = evaluateSet({ weight: 185, reps: 8 }, [{ weight: 185, reps: 8 }]);
    expect(result.status).toBe('matched');
    expect(result.color).toBe('amber');
    expect(result.axis).toBeNull();
  });

  it('within ~2% e1RM with no load/rep win → matched', () => {
    // 185×8 = 234.3 vs comparable 185×8; a tiny sub-2% e1RM change stays amber.
    const result = evaluateSet({ weight: 184, reps: 8 }, [{ weight: 185, reps: 8 }]);
    expect(result.status).toBe('matched');
  });
});

describe('evaluateSet — down (never red)', () => {
  it('fewer reps at same weight → down, neutral grey', () => {
    const result = evaluateSet({ weight: 185, reps: 8 }, [{ weight: 185, reps: 10 }]);
    expect(result.status).toBe('down');
    expect(result.color).toBe('grey');
  });
});

describe('evaluateSet — deload / light suppression', () => {
  const prior: ComparableSet[] = [{ weight: 185, reps: 10 }];

  it('suppresses Down to neutral on a deload day', () => {
    const result = evaluateSet({ weight: 185, reps: 8 }, prior, { intent: 'deload' });
    expect(result.status).toBe('neutral');
    expect(result.color).toBe('grey');
  });

  it('suppresses Down to neutral on a light day', () => {
    const result = evaluateSet({ weight: 135, reps: 8 }, prior, { intent: 'light' });
    expect(result.status).toBe('neutral');
  });

  it('still reads green for a real beat on a light day', () => {
    const result = evaluateSet({ weight: 195, reps: 10 }, prior, { intent: 'light' });
    expect(result.status).toBe('beat');
    expect(result.axis).toBe('load');
  });
});

describe('evaluateSet — first time', () => {
  it('returns neutral when there is no comparable set', () => {
    const result = evaluateSet({ weight: 135, reps: 5 }, []);
    expect(result.status).toBe('neutral');
    expect(result.comparison).toBeNull();
    expect(result.detail).toBeNull();
  });
});

describe('evaluateSet — LOAD_ALWAYS_GREEN = false', () => {
  it('heavier-but-weaker set is no longer an automatic green', () => {
    // 190×8 e1RM 240.7 < 185×10 e1RM 246.7 → not green when load flag off.
    const result = evaluateSet({ weight: 190, reps: 8 }, [{ weight: 185, reps: 10 }], {
      loadAlwaysGreen: false,
    });
    expect(result.status).not.toBe('beat');
  });
});

describe('workingVolume & bestE1RM (warm-ups excluded)', () => {
  const sets = [
    { weight: 45, reps: 10, is_warmup: true, is_completed: true }, // warm-up, excluded
    { weight: 185, reps: 10, is_warmup: false, is_completed: true },
    { weight: 185, reps: 8, is_warmup: false, is_completed: true },
    { weight: 185, reps: 8, is_warmup: false, is_completed: false }, // not completed, excluded
  ];

  it('sums only completed working sets', () => {
    expect(workingVolume(sets)).toBe(185 * 10 + 185 * 8);
  });

  it('best e1RM ignores warm-ups and incomplete sets', () => {
    expect(bestE1RM(sets)).toBeCloseTo(epley1RM(185, 10), 6);
  });
});
