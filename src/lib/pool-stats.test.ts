import { describe, it, expect } from 'vitest';
import { computePoolStats } from './pool-stats';

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
