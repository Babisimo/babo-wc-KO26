import { describe, it, expect } from 'vitest';
import { mapScoreboardGames, type Game } from './next-games';

const resolve = (abbr?: string) => {
  const known = new Set(['RSA', 'CAN', 'GER', 'PAR']);
  return abbr && known.has(abbr) ? abbr : null;
};

describe('mapScoreboardGames', () => {
  it('maps scheduled, live, and final events with scores', () => {
    const json = {
      events: [
        { date: '2026-06-28T19:00Z', competitions: [{ status: { type: { state: 'pre' } },
          competitors: [{ team: { abbreviation: 'RSA' }, score: '0' }, { team: { abbreviation: 'CAN' }, score: '0' }] }] },
        { date: '2026-06-29T20:30Z', competitions: [{ status: { type: { state: 'in' } },
          competitors: [{ team: { abbreviation: 'GER' }, score: '1' }, { team: { abbreviation: 'PAR' }, score: '2' }] }] },
      ],
    };
    expect(mapScoreboardGames(json, resolve)).toEqual<Game[]>([
      { teamA: 'RSA', teamB: 'CAN', kickoffIso: '2026-06-28T19:00Z', state: 'pre', scoreA: null, scoreB: null },
      { teamA: 'GER', teamB: 'PAR', kickoffIso: '2026-06-29T20:30Z', state: 'in', scoreA: 1, scoreB: 2 },
    ]);
  });

  it('skips placeholder/unresolved competitors and dedupes', () => {
    const json = {
      events: [
        { date: '2026-06-28T19:00Z', competitions: [{ status: { type: { state: 'pre' } },
          competitors: [{ team: { abbreviation: 'RD32', displayName: 'Round of 32 1 Winner' } }, { team: { abbreviation: 'GER' } }] }] },
        { date: '2026-06-28T19:00Z', competitions: [{ status: { type: { state: 'pre' } },
          competitors: [{ team: { abbreviation: 'RSA' } }, { team: { abbreviation: 'CAN' } }] }] },
        { date: '2026-06-28T19:00Z', competitions: [{ status: { type: { state: 'pre' } },
          competitors: [{ team: { abbreviation: 'CAN' } }, { team: { abbreviation: 'RSA' } }] }] },
      ],
    };
    expect(mapScoreboardGames(json, resolve).map((g) => [g.teamA, g.teamB])).toEqual([['RSA', 'CAN']]);
  });
});

import { pickGames } from './next-games';

describe('pickGames', () => {
  const g = (teamA: string, teamB: string, kickoffIso: string, state: 'pre' | 'in' | 'post') =>
    ({ teamA, teamB, kickoffIso, state, scoreA: null, scoreB: null });

  it('orders live first, then soonest upcoming, then recent finals, capped at 3', () => {
    const games = [
      g('A', 'B', '2026-06-30T00:00Z', 'pre'),
      g('C', 'D', '2026-06-29T00:00Z', 'pre'),
      g('E', 'F', '2026-06-29T12:00Z', 'in'),
      g('G', 'H', '2026-06-28T00:00Z', 'post'),
      g('I', 'J', '2026-06-27T00:00Z', 'post'),
    ];
    expect(pickGames(games).map((x) => x.teamA)).toEqual(['E', 'C', 'A']);
  });

  it('falls back to finals when nothing is upcoming or live', () => {
    const games = [g('G', 'H', '2026-06-28T00:00Z', 'post'), g('I', 'J', '2026-06-29T00:00Z', 'post')];
    expect(pickGames(games, 1).map((x) => x.teamA)).toEqual(['I']);
  });
});

import { poolSplit } from './next-games';

describe('poolSplit', () => {
  it('tallies the fraction of brackets backing each side of a slot', () => {
    const picks: Record<number, string>[] = [
      { 1: 'CAN', 2: 'GER' },
      { 1: 'CAN' },
      { 1: 'RSA', 2: 'PAR' },
      { 2: 'GER' }, // no pick for slot 1 → not a voter
    ];
    const r = poolSplit(picks, 1, 'RSA', 'CAN');
    expect(r.voters).toBe(3); // two CAN, one RSA; the blank doesn't count
    expect(r.a).toBeCloseTo(1 / 3, 6); // RSA = teamA
    expect(r.b).toBeCloseTo(2 / 3, 6); // CAN = teamB
  });

  it('returns zero fractions and zero voters when nobody picked the slot', () => {
    expect(poolSplit([{ 5: 'BRA' }], 1, 'RSA', 'CAN')).toEqual({ a: 0, b: 0, voters: 0 });
  });
});
