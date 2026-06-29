import { describe, it, expect } from 'vitest';
import { buildLeaderboardPicks } from './leaderboard-picks';
import type { SlotParticipants } from './game-slot';
import type { Game } from './next-games';

const slots: SlotParticipants[] = [
  { slot: 1, teamA: 'GER', teamB: 'PAR' },
  { slot: 2, teamA: 'FRA', teamB: 'SWE' },
  { slot: 3, teamA: 'USA', teamB: 'BIH' },
];

const game = (teamA: string, teamB: string, state: Game['state'] = 'pre'): Game => ({
  teamA, teamB, kickoffIso: '2026-06-30T19:00Z', state, scoreA: null, scoreB: null,
});

describe('buildLeaderboardPicks', () => {
  it('surfaces only the next not-yet-decided slot-matched game (one header)', () => {
    const { headers } = buildLeaderboardPicks(
      slots,
      [game('GER', 'PAR'), game('FRA', 'SWE')],
      [],
      {},
    );
    expect(headers).toEqual([{ teamA: 'GER', teamB: 'PAR', state: 'pre' }]);
  });

  it('returns each bracket its picked team for that one game', () => {
    const { cellsByKey } = buildLeaderboardPicks(
      slots,
      [game('GER', 'PAR'), game('FRA', 'SWE')],
      [
        { key: 'a', picks: { 1: 'GER', 2: 'SWE' } },
        { key: 'b', picks: { 1: 'PAR', 2: 'FRA' } },
      ],
      {},
    );
    expect(cellsByKey.a).toEqual([{ code: 'GER' }]);
    expect(cellsByKey.b).toEqual([{ code: 'PAR' }]);
  });

  it('yields a null cell when a bracket left that slot blank', () => {
    const { cellsByKey } = buildLeaderboardPicks(
      slots,
      [game('GER', 'PAR')],
      [{ key: 'a', picks: {} }],
      {},
    );
    expect(cellsByKey.a).toEqual([null]);
  });

  it('skips a game with no matching official slot and uses the next slot-matched game', () => {
    const { headers, cellsByKey } = buildLeaderboardPicks(
      slots,
      [game('ARG', 'BRA'), game('GER', 'PAR')],
      [{ key: 'a', picks: { 1: 'GER' } }],
      {},
    );
    expect(headers).toEqual([{ teamA: 'GER', teamB: 'PAR', state: 'pre' }]);
    expect(cellsByKey.a).toEqual([{ code: 'GER' }]);
  });

  it('skips a decided game and uses the next not-yet-decided one', () => {
    const { headers, cellsByKey } = buildLeaderboardPicks(
      slots,
      [game('GER', 'PAR', 'post'), game('FRA', 'SWE')],
      [{ key: 'a', picks: { 1: 'GER', 2: 'FRA' } }],
      { 1: 'GER' },
    );
    expect(headers).toEqual([{ teamA: 'FRA', teamB: 'SWE', state: 'pre' }]);
    expect(cellsByKey.a).toEqual([{ code: 'FRA' }]);
  });

  it('returns no headers when no slot-matched, not-yet-decided game exists', () => {
    const { headers } = buildLeaderboardPicks(
      slots,
      [game('ARG', 'BRA')],
      [{ key: 'a', picks: {} }],
      {},
    );
    expect(headers).toEqual([]);
  });
});
