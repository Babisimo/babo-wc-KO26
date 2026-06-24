import { describe, it, expect } from 'vitest';
import { rankThirds, assignThirds, seedR32, THIRD_SLOTS, type GroupStanding } from './wc26-seeding';

// helper: build a group where the 3rd-place row has given points/gd/gf
function grp(letter: string, third: { points: number; gd: number; gf: number }, complete = true): GroupStanding {
  return {
    group: letter,
    complete,
    teams: [
      { code: `${letter}1`, rank: 1, points: 9, gd: 9, gf: 9 },
      { code: `${letter}2`, rank: 2, points: 6, gd: 3, gf: 5 },
      { code: `${letter}3`, rank: 3, points: third.points, gd: third.gd, gf: third.gf },
      { code: `${letter}4`, rank: 4, points: 0, gd: -9, gf: 0 },
    ],
  };
}

const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

describe('rankThirds', () => {
  it('returns the 8 best third-placed group letters, ordered by points then gd then gf', () => {
    // Give each group's 3rd a distinct points total so order is unambiguous.
    const groups = LETTERS.map((l, i) => grp(l, { points: i, gd: 0, gf: 0 }));
    const best = rankThirds(groups);
    expect(best).toHaveLength(8);
    // highest points = L(11) down to E(4); A(0)..D(3) eliminated
    expect(best).toEqual(['L','K','J','I','H','G','F','E']);
  });

  it('breaks point ties by goal difference, then goals scored', () => {
    const groups = LETTERS.map((l) => grp(l, { points: 3, gd: 0, gf: 0 }));
    // all tied on points; give A best gd, B second by gf
    groups[0] = grp('A', { points: 3, gd: 5, gf: 5 });
    groups[1] = grp('B', { points: 3, gd: 2, gf: 9 });
    const best = rankThirds(groups);
    expect(best[0]).toBe('A'); // best gd
    expect(best[1]).toBe('B'); // next: gd 2 beats the rest at gd 0
  });

  it('breaks remaining ties deterministically by group letter', () => {
    const groups = LETTERS.map((l) => grp(l, { points: 3, gd: 0, gf: 0 }));
    const best = rankThirds(groups);
    expect(best).toEqual(['A','B','C','D','E','F','G','H']); // alphabetical when fully tied
  });
});

// Build all 12 groups, fully complete, winners/runners coded "<L>1"/"<L>2"/"<L>3".
function fullGroups(thirdPoints: Record<string, number> = {}): GroupStanding[] {
  return LETTERS.map((l) =>
    grp(l, { points: thirdPoints[l] ?? 3, gd: 0, gf: 0 }, true),
  );
}

describe('assignThirds', () => {
  it('assigns every third-slot to an eligible qualifying group (perfect matching)', () => {
    // qualifying = the 8 groups A,B,C,D,E,F,G,H
    const qualified = ['A','B','C','D','E','F','G','H'];
    const m = assignThirds(qualified);
    const slots = Object.keys(m).map(Number).sort((a, b) => a - b);
    expect(slots).toEqual([2,5,7,8,9,10,13,15]);
    // each assigned group is eligible for its slot and is in the qualified set
    for (const [slot, g] of Object.entries(m)) {
      expect(THIRD_SLOTS[Number(slot)]).toContain(g);
      expect(qualified).toContain(g);
    }
    // bijection: 8 distinct groups used
    expect(new Set(Object.values(m)).size).toBe(8);
  });

  it('is deterministic for the same qualifying set', () => {
    const q = ['A','B','C','D','E','F','G','H'];
    expect(assignThirds(q)).toEqual(assignThirds(q));
  });
});

describe('seedR32', () => {
  it('fills all 16 R32 slots with winners, runners-up, and allocated thirds', () => {
    const { projected } = seedR32(fullGroups());
    for (let s = 1; s <= 16; s++) {
      expect(projected[s]?.teamA).toBeTruthy();
      expect(projected[s]?.teamB).toBeTruthy();
    }
    // slot 1 = R-A vs R-B
    expect(projected[1]).toEqual({ teamA: 'A2', teamB: 'B2' });
    // slot 3 = W-F vs R-C
    expect(projected[3]).toEqual({ teamA: 'F1', teamB: 'C2' });
  });

  it('marks every slot confirmed when all 12 groups are complete', () => {
    const { confirmedSlots } = seedR32(fullGroups());
    expect(confirmedSlots.size).toBe(16);
  });

  it('leaves third-slots unconfirmed while any group is still in progress', () => {
    const groups = fullGroups();
    groups[11] = grp('L', { points: 3, gd: 0, gf: 0 }, false); // group L not complete
    const { confirmedSlots } = seedR32(groups);
    // a non-third slot whose two groups are both complete stays confirmed (e.g. slot 1: A,B)
    expect(confirmedSlots.has(1)).toBe(true);
    // every third-slot is unconfirmed because best-8 needs all 12 complete
    for (const s of [2,5,7,8,9,10,13,15]) expect(confirmedSlots.has(s)).toBe(false);
    // slot 11 (R-K vs R-L) references incomplete group L -> unconfirmed
    expect(confirmedSlots.has(11)).toBe(false);
  });
});
