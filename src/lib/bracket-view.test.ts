import { describe, it, expect } from 'vitest';
import { buildBracketView } from './bracket-view';
import type { OfficialR32, Picks } from './bracket-picks';
import type { OfficialWinners } from './scoring';

const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
};

describe('buildBracketView', () => {
  it('returns one entry per slot with the round', () => {
    const view = buildBracketView(OFFICIAL, {}, {});
    expect(view).toHaveLength(31);
    expect(view[0].round).toBe('R32');
    expect(view[30].round).toBe('FINAL');
  });
  it('marks a correct decided pick', () => {
    const picks: Picks = { 1: 'ARG' };
    const winners: OfficialWinners = { 1: 'ARG' };
    const s1 = buildBracketView(OFFICIAL, picks, winners)[0];
    expect(s1).toMatchObject({ slot: 1, teamA: 'ARG', teamB: 'BRA', pick: 'ARG', officialWinner: 'ARG', status: 'correct' });
  });
  it('marks a wrong decided pick', () => {
    const s1 = buildBracketView(OFFICIAL, { 1: 'BRA' }, { 1: 'ARG' })[0];
    expect(s1.status).toBe('wrong');
  });
  it('marks an undecided slot pending', () => {
    const s1 = buildBracketView(OFFICIAL, { 1: 'ARG' }, {})[0];
    expect(s1.status).toBe('pending');
  });
  it('derives later-round contestants from the user picks', () => {
    const picks: Picks = { 1: 'ARG', 2: 'FRA', 17: 'ARG' };
    const s17 = buildBracketView(OFFICIAL, picks, {}).find((s) => s.slot === 17)!;
    expect(s17).toMatchObject({ teamA: 'ARG', teamB: 'FRA', pick: 'ARG' });
  });
});
