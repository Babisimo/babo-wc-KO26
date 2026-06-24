import { describe, it, expect } from 'vitest';
import { validateSubmission } from './bracket-validate';
import { applyPick, contestantsForSlot, type OfficialR32, type Picks } from './bracket-picks';

// Full official R32: 16 slots, each a distinct pair. Teams T1..T32.
function fullOfficial(): OfficialR32 {
  const o: OfficialR32 = {};
  for (let s = 1; s <= 16; s++) {
    o[s] = { teamA: `T${2 * s - 1}`, teamB: `T${2 * s}` };
  }
  return o;
}

// helper to read the current teamA for a slot
function advanceA(o: OfficialR32, picks: Picks, slot: number): string {
  const c = contestantsForSlot(slot, o, picks);
  return c.teamA as string;
}

// Build a complete valid bracket by always advancing teamA of every slot.
function fullValidPicks(o: OfficialR32): Picks {
  let picks: Picks = {};
  for (let s = 1; s <= 31; s++) {
    // teamA at the moment of picking is always defined once feeders are set,
    // because we go in slot order. Use applyPick to derive the current teamA.
    picks = applyPick(o, picks, s, advanceA(o, picks, s));
  }
  return picks;
}

describe('validateSubmission', () => {
  it('accepts a complete, valid bracket', () => {
    const o = fullOfficial();
    expect(validateSubmission(o, fullValidPicks(o))).toEqual({ ok: true });
  });
  it('rejects when the official R32 is not fully set', () => {
    const o = fullOfficial();
    delete o[16];
    expect(validateSubmission(o, {}).ok).toBe(false);
  });
  it('rejects an incomplete bracket', () => {
    const o = fullOfficial();
    const picks = fullValidPicks(o);
    delete picks[31];
    expect(validateSubmission(o, picks).ok).toBe(false);
  });
  it('rejects a pick that is not one of the slot contestants', () => {
    const o = fullOfficial();
    const picks = fullValidPicks(o);
    picks[1] = 'NOPE'; // not T1/T2
    expect(validateSubmission(o, picks).ok).toBe(false);
  });
});
