import { describe, expect, it } from 'vitest';
import { moveDown, moveItem, moveUp, reorderByIds, withSortOrder } from './order';

describe('order helpers', () => {
  const base = ['a', 'b', 'c', 'd'];

  it('moves an item forward', () => {
    expect(moveItem(base, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward', () => {
    expect(moveItem(base, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('is a no-op for equal indices', () => {
    expect(moveItem(base, 1, 1)).toEqual(base);
  });

  it('returns an unchanged copy for out-of-range indices', () => {
    expect(moveItem(base, -1, 2)).toEqual(base);
    expect(moveItem(base, 1, 9)).toEqual(base);
    // must be a copy, not the same reference
    expect(moveItem(base, 1, 1)).not.toBe(base);
  });

  it('moveUp / moveDown adjust by one slot', () => {
    expect(moveUp(base, 2)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveDown(base, 2)).toEqual(['a', 'b', 'd', 'c']);
    // edges are no-ops
    expect(moveUp(base, 0)).toEqual(base);
    expect(moveDown(base, 3)).toEqual(base);
  });

  it('does not mutate the input', () => {
    const input = ['x', 'y', 'z'];
    moveItem(input, 0, 2);
    expect(input).toEqual(['x', 'y', 'z']);
  });

  it('reorderByIds reorders to the given id order', () => {
    const items = [
      { id: '1', v: 'a' },
      { id: '2', v: 'b' },
      { id: '3', v: 'c' },
    ];
    expect(reorderByIds(items, ['3', '1', '2']).map((i) => i.id)).toEqual(['3', '1', '2']);
  });

  it('reorderByIds appends items missing from the id list', () => {
    const items = [
      { id: '1', v: 'a' },
      { id: '2', v: 'b' },
      { id: '3', v: 'c' },
    ];
    expect(reorderByIds(items, ['2']).map((i) => i.id)).toEqual(['2', '1', '3']);
  });

  it('withSortOrder assigns contiguous positions', () => {
    const result = withSortOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(result.map((r) => r.sort_order)).toEqual([0, 1, 2]);
  });
});
