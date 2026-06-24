import { describe, it, expect } from 'vitest';
import { applyWinner, reconcileWinners } from './official-winners';
import type { OfficialR32 } from './bracket-picks';
import type { OfficialWinners } from './scoring';

const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
};

describe('applyWinner', () => {
  it('sets a winner without mutating the input', () => {
    const before: OfficialWinners = {};
    const after = applyWinner(OFFICIAL, before, 1, 'ARG');
    expect(after[1]).toBe('ARG');
    expect(before).toEqual({});
  });
  it('clears downstream winners when an upstream winner changes', () => {
    let w: OfficialWinners = {};
    w = applyWinner(OFFICIAL, w, 1, 'ARG');
    w = applyWinner(OFFICIAL, w, 2, 'FRA');
    w = applyWinner(OFFICIAL, w, 17, 'ARG'); // slot 17 feeds from 1 & 2
    expect(w[17]).toBe('ARG');
    w = applyWinner(OFFICIAL, w, 1, 'BRA'); // ARG no longer advances
    expect(w[1]).toBe('BRA');
    expect(w[17]).toBeUndefined();
  });
  it('clears a slot (and its dependents) when winner is null', () => {
    let w: OfficialWinners = {};
    w = applyWinner(OFFICIAL, w, 1, 'ARG');
    w = applyWinner(OFFICIAL, w, 2, 'FRA');
    w = applyWinner(OFFICIAL, w, 17, 'FRA');
    w = applyWinner(OFFICIAL, w, 2, null); // clear slot 2; FRA no longer in slot 17
    expect(w[2]).toBeUndefined();
    expect(w[17]).toBeUndefined();
  });
});

describe('reconcileWinners', () => {
  it('drops a later winner not among its contestants', () => {
    const w: OfficialWinners = { 1: 'ARG', 2: 'FRA', 17: 'ZZZ' };
    expect(reconcileWinners(OFFICIAL, w)[17]).toBeUndefined();
  });
  it('keeps a valid later winner', () => {
    const w: OfficialWinners = { 1: 'ARG', 2: 'FRA', 17: 'FRA' };
    expect(reconcileWinners(OFFICIAL, w)[17]).toBe('FRA');
  });
});
