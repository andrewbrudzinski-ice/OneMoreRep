import { describe, expect, it } from 'vitest';
import { filterExercises, matchesQuery } from './exerciseSearch';
import type { Exercise } from '../types';

function ex(partial: Partial<Exercise> & { id: string; name: string }): Exercise {
  return {
    user_id: 'local-user',
    primary_muscle_group_id: 'mg-chest',
    secondary_muscle_group_ids: [],
    equipment: 'barbell',
    movement_type: 'push',
    is_compound: true,
    instructions: '',
    is_custom: false,
    is_archived: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

const list: Exercise[] = [
  ex({ id: '1', name: 'Barbell Bench Press', primary_muscle_group_id: 'mg-chest' }),
  ex({ id: '2', name: 'Barbell Curl', primary_muscle_group_id: 'mg-biceps', equipment: 'barbell' }),
  ex({ id: '3', name: 'Dumbbell Curl', primary_muscle_group_id: 'mg-biceps', equipment: 'dumbbell' }),
  ex({ id: '4', name: 'Incline Dumbbell Press', primary_muscle_group_id: 'mg-chest', equipment: 'dumbbell' }),
  ex({ id: '5', name: 'Old Machine', is_archived: true }),
];

describe('matchesQuery', () => {
  it('matches when all tokens are present, case-insensitive', () => {
    expect(matchesQuery('Barbell Bench Press', 'bench')).toBe(true);
    expect(matchesQuery('Barbell Bench Press', 'BENCH press')).toBe(true);
    expect(matchesQuery('Barbell Bench Press', 'press barbell')).toBe(true);
  });

  it('fails when any token is missing', () => {
    expect(matchesQuery('Barbell Bench Press', 'bench squat')).toBe(false);
  });

  it('empty query matches everything', () => {
    expect(matchesQuery('Anything', '   ')).toBe(true);
  });
});

describe('filterExercises', () => {
  it('excludes archived by default and includes them when asked', () => {
    expect(filterExercises(list).find((e) => e.id === '5')).toBeUndefined();
    expect(
      filterExercises(list, { includeArchived: true }).find((e) => e.id === '5'),
    ).toBeDefined();
  });

  it('filters by query token', () => {
    const result = filterExercises(list, { query: 'curl' });
    expect(result.map((e) => e.id).sort()).toEqual(['2', '3']);
  });

  it('ranks name-prefix matches ahead of mid-string matches', () => {
    const result = filterExercises(list, { query: 'barbell' });
    // "Barbell Bench Press" and "Barbell Curl" both start with the query.
    expect(result[0]?.name.startsWith('Barbell')).toBe(true);
  });

  it('filters by muscle group', () => {
    const result = filterExercises(list, { muscleGroupId: 'mg-biceps' });
    expect(result.map((e) => e.id).sort()).toEqual(['2', '3']);
  });

  it('filters by equipment', () => {
    const result = filterExercises(list, { equipment: 'dumbbell' });
    expect(result.map((e) => e.id).sort()).toEqual(['3', '4']);
  });

  it('combines filters', () => {
    const result = filterExercises(list, { query: 'curl', equipment: 'dumbbell' });
    expect(result.map((e) => e.id)).toEqual(['3']);
  });

  it('sorts alphabetically with no query', () => {
    const names = filterExercises(list).map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
