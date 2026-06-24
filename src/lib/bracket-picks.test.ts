import { describe, it, expect } from 'vitest';
import { contestantsForSlot, applyPick, bracketComplete, type OfficialR32, type Picks } from './bracket-picks';

// Minimal official R32: slot 1 = ARG vs BRA, slot 2 = ESP vs FRA, slot 5 = GER vs POR. (others omitted for focused tests)
const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
  5: { teamA: 'GER', teamB: 'POR' },
};

describe('contestantsForSlot', () => {
  it('returns the official matchup for an R32 slot', () => {
    expect(contestantsForSlot(1, OFFICIAL, {})).toEqual({ teamA: 'ARG', teamB: 'BRA' });
  });
  it('returns the user feeder-pick winners for a later slot', () => {
    const picks: Picks = { 2: 'FRA', 5: 'GER' };
    // slot 17 feeds from slots 2 and 5
    expect(contestantsForSlot(17, OFFICIAL, picks)).toEqual({ teamA: 'FRA', teamB: 'GER' });
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
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 5, 'GER');
    picks = applyPick(OFFICIAL, picks, 17, 'FRA');
    expect(picks[17]).toBe('FRA');
    // Change slot 2 to ESP. FRA no longer reaches slot 17, so the slot-17 pick must clear.
    picks = applyPick(OFFICIAL, picks, 2, 'ESP');
    expect(picks[2]).toBe('ESP');
    expect(picks[17]).toBeUndefined();
  });
  it('keeps a downstream pick that is still valid', () => {
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 5, 'GER');
    picks = applyPick(OFFICIAL, picks, 17, 'GER');
    // Change slot 2 to ESP — slot 17 pick was GER (from slot 5), still valid.
    picks = applyPick(OFFICIAL, picks, 2, 'ESP');
    expect(picks[17]).toBe('GER');
  });
  it('clears the entire downstream chain when an upstream winner changes', () => {
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 5, 'GER');
    picks = applyPick(OFFICIAL, picks, 17, 'FRA');
    picks = applyPick(OFFICIAL, picks, 25, 'FRA');
    picks = applyPick(OFFICIAL, picks, 29, 'FRA');
    picks = applyPick(OFFICIAL, picks, 31, 'FRA');
    expect(picks[31]).toBe('FRA');
    // Change slot 2 to ESP: FRA never advances, so the whole chain (17,25,29,31) must clear.
    picks = applyPick(OFFICIAL, picks, 2, 'ESP');
    expect(picks[2]).toBe('ESP');
    expect(picks[17]).toBeUndefined();
    expect(picks[25]).toBeUndefined();
    expect(picks[29]).toBeUndefined();
    expect(picks[31]).toBeUndefined();
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
