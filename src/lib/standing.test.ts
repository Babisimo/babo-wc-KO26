import { describe, it, expect } from 'vitest';
import { myStanding, movement, type StandingEntry } from './standing';

const entries: StandingEntry[] = [
  { key: 'a', total: 28, rank: 1 },
  { key: 'b', total: 24, rank: 2 },
  { key: 'c', total: 24, rank: 2 },
];

describe('myStanding', () => {
  it("returns the best-ranked of the user's brackets", () => {
    expect(myStanding(entries, ['b', 'c'])).toEqual({ rank: 2, total: 24 });
    expect(myStanding(entries, ['a', 'b'])).toEqual({ rank: 1, total: 28 });
  });
  it('returns null when the user has no entry on the board', () => {
    expect(myStanding(entries, ['z'])).toBeNull();
    expect(myStanding(entries, [])).toBeNull();
  });
});

describe('movement', () => {
  it('reports no movement when there is no previous rank', () => {
    expect(movement(null, 3)).toEqual({ dir: 'none', places: 0 });
  });
  it('reports upward movement (lower rank number is better)', () => {
    expect(movement(5, 3)).toEqual({ dir: 'up', places: 2 });
  });
  it('reports downward movement', () => {
    expect(movement(2, 6)).toEqual({ dir: 'down', places: 4 });
  });
  it('reports no change when the rank is unchanged', () => {
    expect(movement(4, 4)).toEqual({ dir: 'same', places: 0 });
  });
});
