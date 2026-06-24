import { describe, it, expect } from 'vitest';
import { contestantsForSlot, applyPick, bracketComplete, type OfficialR32, type Picks } from './bracket-picks';

// Minimal official R32: slot 1 = ARG vs BRA, slot 2 = ESP vs FRA. (others omitted for focused tests)
const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
};

describe('contestantsForSlot', () => {
  it('returns the official matchup for an R32 slot', () => {
    expect(contestantsForSlot(1, OFFICIAL, {})).toEqual({ teamA: 'ARG', teamB: 'BRA' });
  });
  it('returns the user feeder-pick winners for a later slot', () => {
    const picks: Picks = { 1: 'ARG', 2: 'FRA' };
    // slot 17 feeds from slots 1 and 2
    expect(contestantsForSlot(17, OFFICIAL, picks)).toEqual({ teamA: 'ARG', teamB: 'FRA' });
  });
  it('returns nulls for a later slot whose feeders are unpicked', () => {
    expect(contestantsForSlot(17, OFFICIAL, {})).toEqual({ teamA: null, teamB: null });
  });
});

describe('applyPick', () => {
  it('sets a pick without mutating the input', () => {
    const before: Picks = {};
    const after = applyPick(OFFICIAL, before, 1, 'ARG');
    expect(after).toEqual({ 1: 'ARG' });
    expect(before).toEqual({});
  });
  it('clears a downstream pick that is no longer valid after changing an upstream winner', () => {
    // User advances ARG (slot1) and FRA (slot2), then picks ARG to win slot 17.
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 1, 'ARG');
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 17, 'ARG');
    expect(picks[17]).toBe('ARG');
    // Now change slot 1 to BRA. ARG no longer reaches slot 17, so the slot-17 pick must clear.
    picks = applyPick(OFFICIAL, picks, 1, 'BRA');
    expect(picks[1]).toBe('BRA');
    expect(picks[17]).toBeUndefined();
  });
  it('keeps a downstream pick that is still valid', () => {
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 1, 'ARG');
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 17, 'FRA');
    // Change slot 1 to BRA — slot 17 pick was FRA (from slot 2), still valid.
    picks = applyPick(OFFICIAL, picks, 1, 'BRA');
    expect(picks[17]).toBe('FRA');
  });
});

describe('bracketComplete', () => {
  it('is false for an empty bracket', () => {
    expect(bracketComplete({})).toBe(false);
  });
  it('is true only when all 31 slots are picked', () => {
    const full: Picks = {};
    for (let s = 1; s <= 31; s++) full[s] = 'X';
    expect(bracketComplete(full)).toBe(true);
    delete full[31];
    expect(bracketComplete(full)).toBe(false);
  });
});
