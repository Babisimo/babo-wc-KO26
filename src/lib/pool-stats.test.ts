import { describe, it, expect } from 'vitest';
import { computePoolStats, countFilledBrackets } from './pool-stats';

const picks = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 'TEAM']));

describe('computePoolStats', () => {
  it('is empty when nobody holds credits', () => {
    expect(computePoolStats([], 5000)).toEqual({ players: 0, entries: 0, potCents: 0 });
  });

  it('counts one credit as one player and one bracket', () => {
    expect(computePoolStats([{ credits: 1 }], 5000)).toEqual({ players: 1, entries: 1, potCents: 5000 });
  });

  it('ignores users with zero credits', () => {
    expect(computePoolStats([{ credits: 1 }, { credits: 0 }], 5000)).toEqual({ players: 1, entries: 1, potCents: 5000 });
  });

  it('sums credits into brackets while counting holders as players', () => {
    const users = [{ credits: 2 }, { credits: 1 }];
    expect(computePoolStats(users, 5000)).toEqual({ players: 2, entries: 3, potCents: 15000 });
  });

  it('prices the pot as credits times the entry price', () => {
    expect(computePoolStats([{ credits: 2 }], 2500)).toEqual({ players: 1, entries: 2, potCents: 5000 });
  });
});

describe('countFilledBrackets', () => {
  it('is zero with no brackets', () => {
    expect(countFilledBrackets([])).toBe(0);
  });

  it('counts a bracket only once all 31 games are picked', () => {
    expect(countFilledBrackets([{ picks: picks(31) }])).toBe(1);
    expect(countFilledBrackets([{ picks: picks(30) }])).toBe(0);
  });

  it('counts only the filled ones in a mix', () => {
    expect(countFilledBrackets([{ picks: picks(31) }, { picks: picks(10) }, { picks: picks(31) }])).toBe(2);
  });

  it('ignores blank picks toward completeness', () => {
    expect(countFilledBrackets([{ picks: { ...picks(30), 31: '' } }])).toBe(0);
  });
});
