import { describe, it, expect } from 'vitest';
import { TEAM_ELO, DEFAULT_ELO, teamElo, eloWinProb } from '@/lib/team-elo';

describe('eloWinProb', () => {
  it('equal ratings → 0.5', () => {
    expect(eloWinProb(1800, 1800)).toBeCloseTo(0.5, 10);
  });
  it('+400 favourite → ~0.909', () => {
    expect(eloWinProb(2000, 1600)).toBeCloseTo(0.9090909, 6);
  });
  it('is symmetric (probs sum to 1)', () => {
    expect(eloWinProb(2000, 1600) + eloWinProb(1600, 2000)).toBeCloseTo(1, 10);
  });
});

describe('teamElo', () => {
  it('reads the table for a known code', () => {
    expect(teamElo('ARG')).toBe(TEAM_ELO['ARG']);
  });
  it('falls back to DEFAULT_ELO for null / unknown', () => {
    expect(teamElo(null)).toBe(DEFAULT_ELO);
    expect(teamElo('ZZZ')).toBe(DEFAULT_ELO);
  });
  it('covers every team code with a rating', () => {
    expect(Object.keys(TEAM_ELO).length).toBeGreaterThanOrEqual(48);
  });
});
