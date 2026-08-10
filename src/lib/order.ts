/**
 * Pure array-ordering helpers used for reordering routine exercises (and,
 * later, workout exercises). No storage, fully unit-tested.
 */

/** Move the item at `from` to `to`, returning a new array. Out-of-range or
 * no-op moves return a shallow copy unchanged. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const result = list.slice();
  if (from < 0 || from >= result.length) return result;
  if (to < 0 || to >= result.length) return result;
  if (from === to) return result;
  const [item] = result.splice(from, 1);
  // `item` is defined because `from` is in range and length > 0.
  result.splice(to, 0, item as T);
  return result;
}

/** Move the item at `index` one slot earlier. */
export function moveUp<T>(list: readonly T[], index: number): T[] {
  return moveItem(list, index, index - 1);
}

/** Move the item at `index` one slot later. */
export function moveDown<T>(list: readonly T[], index: number): T[] {
  return moveItem(list, index, index + 1);
}

/**
 * Reorder `items` to match the order of `orderedIds`. Items whose id is not
 * in `orderedIds` are appended, in their original relative order. Pure.
 */
export function reorderByIds<T extends { id: string }>(
  items: readonly T[],
  orderedIds: readonly string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const result: T[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) {
      result.push(item);
      byId.delete(id);
    }
  }
  // Append any leftovers in original order.
  for (const item of items) {
    if (byId.has(item.id)) result.push(item);
  }
  return result;
}

/** Assign contiguous 0-based sort_order values matching array position. */
export function withSortOrder<T>(items: readonly T[]): (T & { sort_order: number })[] {
  return items.map((item, index) => ({ ...item, sort_order: index }));
}
