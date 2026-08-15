import { describe, it, expect } from 'vitest';
import { reorderItems } from './reorderItems';

describe('reorderItems', () => {
  it('moves an item from an earlier index to a later index', () => {
    expect(reorderItems(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item from a later index to an earlier index', () => {
    expect(reorderItems(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('is a no-op when fromIndex equals toIndex', () => {
    expect(reorderItems(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const original = ['a', 'b', 'c'];
    reorderItems(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });
});
