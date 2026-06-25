import { describe, it, expect } from 'vitest';
import { stalePicks } from './bracket-changes';
import { applyPick, contestantsForSlot, type OfficialR32, type Picks } from './bracket-picks';

function fullOfficial(): OfficialR32 {
  const o: OfficialR32 = {};
  for (let s = 1; s <= 16; s++) o[s] = { teamA: `T${2 * s - 1}`, teamB: `T${2 * s}` };
  return o;
}

// Complete valid bracket: always advance the current teamA of every slot.
function fullValidPicks(o: OfficialR32): Picks {
  let picks: Picks = {};
  for (let s = 1; s <= 31; s++) {
    const { teamA } = contestantsForSlot(s, o, picks);
    picks = applyPick(o, picks, s, teamA as string);
  }
  return picks;
}

describe('stalePicks', () => {
  it('returns nothing when every pick still matches a contestant', () => {
    const o = fullOfficial();
    expect(stalePicks(o, fullValidPicks(o))).toEqual([]);
  });

  it('flags a Round-of-32 slot whose team changed', () => {
    const o = fullOfficial();
    const picks: Picks = { 1: 'T1' }; // picked T1 to win slot 1
    o[1] = { teamA: 'X1', teamB: 'X2' }; // draw later resolved differently
    expect(stalePicks(o, picks)).toContain(1);
  });

  it('cascades: a stale feeder pick invalidates downstream picks built on it', () => {
    const o = fullOfficial();
    const picks = fullValidPicks(o);
    // Change slot 1's teams so its pick (T1) and everything it fed becomes stale.
    o[1] = { teamA: 'X1', teamB: 'X2' };
    const stale = stalePicks(o, picks);
    expect(stale).toContain(1);
    expect(stale.length).toBeGreaterThan(1); // the R16/QF/... it fed are stale too
  });

  it('ignores missing picks', () => {
    const o = fullOfficial();
    expect(stalePicks(o, {})).toEqual([]);
  });
});
