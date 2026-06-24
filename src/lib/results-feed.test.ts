import { describe, it, expect } from 'vitest';
import { mapEspnKnockout, resolveOfficialWinners, type FeedResult } from './results-feed';
import type { OfficialR32 } from './bracket-picks';

// Minimal ESPN scoreboard shape: one finished (ARG beat BRA on the winner flag,
// even though scores are equal — penalties), one not-yet-played.
const ESPN = {
  events: [
    {
      competitions: [
        {
          status: { type: { completed: true, state: 'post' } },
          competitors: [
            { homeAway: 'home', team: { displayName: 'Argentina' }, score: '1', winner: true },
            { homeAway: 'away', team: { displayName: 'Brazil' }, score: '1', winner: false },
          ],
        },
      ],
    },
    {
      competitions: [
        {
          status: { type: { completed: false, state: 'pre' } },
          competitors: [
            { homeAway: 'home', team: { displayName: 'Spain' }, score: null, winner: false },
            { homeAway: 'away', team: { displayName: 'France' }, score: null, winner: false },
          ],
        },
      ],
    },
  ],
};

describe('mapEspnKnockout', () => {
  it('keeps only finished events and resolves codes + winner', () => {
    const out = mapEspnKnockout(ESPN);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ teamA: 'ARG', teamB: 'BRA', winner: 'ARG' });
  });
  it('returns [] for junk input', () => {
    expect(mapEspnKnockout(null)).toEqual([]);
    expect(mapEspnKnockout({})).toEqual([]);
  });
});

describe('resolveOfficialWinners', () => {
  const OFFICIAL: OfficialR32 = {
    1: { teamA: 'ARG', teamB: 'BRA' },
    2: { teamA: 'ESP', teamB: 'FRA' },
    5: { teamA: 'GER', teamB: 'POR' },
  };
  it('records winners for matched R32 slots', () => {
    const feed: FeedResult[] = [{ teamA: 'ARG', teamB: 'BRA', winner: 'ARG' }];
    const w = resolveOfficialWinners(OFFICIAL, feed);
    expect(w[1]).toBe('ARG');
    expect(w[2]).toBeUndefined();
  });
  it('matches regardless of pair order', () => {
    const feed: FeedResult[] = [{ teamA: 'BRA', teamB: 'ARG', winner: 'BRA' }];
    expect(resolveOfficialWinners(OFFICIAL, feed)[1]).toBe('BRA');
  });
  it('fills a later round once its feeders are decided', () => {
    const feed: FeedResult[] = [
      { teamA: 'ESP', teamB: 'FRA', winner: 'FRA' },   // slot 2 winner
      { teamA: 'GER', teamB: 'POR', winner: 'GER' },   // slot 5 winner
      { teamA: 'FRA', teamB: 'GER', winner: 'FRA' },   // the R16 slot-17 game
    ];
    const w = resolveOfficialWinners(OFFICIAL, feed);
    expect(w[2]).toBe('FRA');
    expect(w[5]).toBe('GER');
    expect(w[17]).toBe('FRA');
  });
  it('respects an admin-seeded upstream winner for downstream pairings', () => {
    // Feed says ESP beat FRA for slot 2, but admin overrode slot 2 to FRA (locked).
    const feed: FeedResult[] = [
      { teamA: 'ESP', teamB: 'FRA', winner: 'ESP' },   // feed says ESP
      { teamA: 'GER', teamB: 'POR', winner: 'GER' },   // slot 5 winner
      { teamA: 'FRA', teamB: 'GER', winner: 'FRA' },   // R16 slot-17 uses FRA (admin), not ESP
    ];
    const w = resolveOfficialWinners(OFFICIAL, feed, { 2: 'FRA' }, new Set([2]));
    expect(w[2]).toBe('FRA');        // admin winner preserved
    expect(w[5]).toBe('GER');        // feed-decided
    expect(w[17]).toBe('FRA');       // derived from FRA vs GER, using admin FRA
  });
});
