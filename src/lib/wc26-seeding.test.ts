import { describe, it, expect } from 'vitest';
import { rankThirds, type GroupStanding } from './wc26-seeding';

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
