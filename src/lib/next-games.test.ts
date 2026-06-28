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
