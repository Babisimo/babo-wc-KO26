import { describe, it, expect } from 'vitest';
import { rankEntries, potSplit, type ScoreEntry } from './leaderboard-rank';

describe('rankEntries', () => {
  it('orders by total descending', () => {
    const r = rankEntries([
      { key: 'a', name: 'Ann', total: 5 },
      { key: 'b', name: 'Bob', total: 9 },
    ]);
    expect(r.map((e) => e.key)).toEqual(['b', 'a']);
    expect(r.map((e) => e.rank)).toEqual([1, 2]);
  });
  it('shares ranks on ties and skips accordingly (1,1,3)', () => {
    const r = rankEntries([
      { key: 'a', name: 'Ann', total: 9 },
      { key: 'b', name: 'Bob', total: 9 },
      { key: 'c', name: 'Cy', total: 4 },
    ]);
    expect(r.map((e) => e.rank)).toEqual([1, 1, 3]);
  });
  it('breaks display order by name when totals tie', () => {
    const r = rankEntries([
      { key: 'z', name: 'Zoe', total: 7 },
      { key: 'a', name: 'Al', total: 7 },
    ]);
    expect(r.map((e) => e.name)).toEqual(['Al', 'Zoe']);
    expect(r.map((e) => e.rank)).toEqual([1, 1]);
  });
  it('handles an empty list', () => {
    expect(rankEntries([])).toEqual([]);
  });
});

describe('potSplit', () => {
  const entries: ScoreEntry[] = [
    { key: 'a', name: 'Ann', total: 9 },
    { key: 'b', name: 'Bob', total: 9 },
    { key: 'c', name: 'Cy', total: 4 },
  ];
  it('splits the pot among rank-1 winners', () => {
    const { winners, shareCents } = potSplit(rankEntries(entries), 10000);
    expect(winners.map((w) => w.key).sort()).toEqual(['a', 'b']);
    expect(shareCents).toBe(5000);
  });
  it('floors uneven splits', () => {
    const { shareCents } = potSplit(rankEntries(entries), 10001);
    expect(shareCents).toBe(5000);
  });
  it('returns 0 share for no entries', () => {
    expect(potSplit([], 10000)).toEqual({ winners: [], shareCents: 0 });
  });
});
