import type { Equipment, Exercise } from '../types';

/**
 * Pure exercise search + filtering used by the instant-search UI. No storage,
 * fully unit-tested. Matching is token-based and case-insensitive; results
 * are ranked so name-prefix matches float to the top.
 */

export interface ExerciseFilter {
  query?: string;
  muscleGroupId?: string;
  equipment?: Equipment;
  includeArchived?: boolean;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** True if every whitespace-separated token in `query` appears in `name`. */
export function matchesQuery(name: string, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalize(name);
  return tokens.every((t) => haystack.includes(t));
}

function score(name: string, query: string): number {
  const n = normalize(name);
  const q = normalize(query);
  if (q.length === 0) return 0;
  if (n === q) return 3;
  if (n.startsWith(q)) return 2;
  // word-boundary prefix (e.g. "curl" matching "Barbell Curl")
  if (n.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  return 0;
}

/**
 * Filter + rank exercises. Archived exercises are excluded unless
 * `includeArchived` is set. Ties (or empty query) fall back to name order.
 */
export function filterExercises(
  exercises: readonly Exercise[],
  filter: ExerciseFilter = {},
): Exercise[] {
  const { query = '', muscleGroupId, equipment, includeArchived = false } = filter;

  const filtered = exercises.filter((e) => {
    if (!includeArchived && e.is_archived) return false;
    if (muscleGroupId && e.primary_muscle_group_id !== muscleGroupId) return false;
    if (equipment && e.equipment !== equipment) return false;
    if (query.trim() && !matchesQuery(e.name, query)) return false;
    return true;
  });

  const trimmed = query.trim();
  return filtered.sort((a, b) => {
    if (trimmed) {
      const diff = score(b.name, trimmed) - score(a.name, trimmed);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
}
