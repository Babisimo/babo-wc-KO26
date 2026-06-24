import { describe, it, expect } from 'vitest';
import { scoreBracket, winnersToPicks, type OfficialWinners } from './scoring';
import type { Picks } from './bracket-picks';

describe('scoreBracket', () => {
  it('is 0 for an empty bracket', () => {
    expect(scoreBracket({}, {})).toBe(0);
  });
  it('awards 1 point for a correct R32 pick', () => {
    const picks: Picks = { 1: 'ARG' };
    const winners: OfficialWinners = { 1: 'ARG' };
    expect(scoreBracket(picks, winners)).toBe(1);
  });
  it('awards 16 points for a correct Final pick', () => {
    expect(scoreBracket({ 31: 'ARG' }, { 31: 'ARG' })).toBe(16);
  });
  it('awards nothing for a wrong pick', () => {
    expect(scoreBracket({ 1: 'BRA' }, { 1: 'ARG' })).toBe(0);
  });
  it('awards nothing when the result is undecided', () => {
    expect(scoreBracket({ 1: 'ARG' }, { 1: null })).toBe(0);
    expect(scoreBracket({ 1: 'ARG' }, {})).toBe(0);
  });
  it('sums round-weighted points across rounds', () => {
    // a correct R32 (1), a correct R16 (2), and a correct QF (4) = 7
    const picks: Picks = { 1: 'ARG', 17: 'ARG', 25: 'ARG' };
    const winners: OfficialWinners = { 1: 'ARG', 17: 'ARG', 25: 'ARG' };
    expect(scoreBracket(picks, winners)).toBe(7);
  });
  it('totals 80 for a perfect bracket', () => {
    const picks: Picks = {};
    const winners: OfficialWinners = {};
    for (let s = 1; s <= 31; s++) { picks[s] = 'X'; winners[s] = 'X'; }
    expect(scoreBracket(picks, winners)).toBe(80);
  });
});

describe('winnersToPicks', () => {
  it('drops null values and keeps coded winners', () => {
    expect(winnersToPicks({ 1: 'ARG', 2: null, 17: 'FRA' })).toEqual({ 1: 'ARG', 17: 'FRA' });
  });
});
