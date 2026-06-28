import { describe, it, expect } from 'vitest';
import { myStanding, type StandingEntry } from './standing';

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
