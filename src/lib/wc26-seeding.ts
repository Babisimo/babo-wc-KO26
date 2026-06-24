// Live WC26 Round-of-32 seeding from group standings.
//
// v1 approximations (documented, per the approved spec):
//  - Third-place tiebreakers use points -> goal difference -> goals scored (exact from
//    ESPN). FIFA's deeper conduct + FIFA-ranking tiebreakers are NOT applied; remaining
//    ties break by group letter (deterministic).
//  - Third-place SLOT allocation uses a deterministic eligibility-matching algorithm
//    (Task 2), not FIFA's official 495-row combination table. The result always honors
//    the published per-slot eligibility sets, but may differ from the official table in
//    rare combinations. Encoding the exact table is a future enhancement.

export type StandingRow = { code: string | null; rank: number; points: number; gd: number; gf: number };
export type GroupStanding = { group: string; complete: boolean; teams: StandingRow[] };

// Position tokens for the R32 schedule.
type Pos = { kind: 'W' | 'R'; group: string } | { kind: 'T'; eligible: string };

export const THIRD_SLOTS: Record<number, string> = {
  2: 'ABCDF', 5: 'CDFGH', 7: 'CEFHI', 8: 'EHIJK',
  9: 'BEFIJ', 10: 'AEHIJ', 13: 'EFGIJ', 15: 'DEIJL',
};

// app slot -> [position, position]
export const R32_SCHEDULE: Record<number, [Pos, Pos]> = {
  1:  [{ kind: 'R', group: 'A' }, { kind: 'R', group: 'B' }],
  2:  [{ kind: 'W', group: 'E' }, { kind: 'T', eligible: THIRD_SLOTS[2] }],
  3:  [{ kind: 'W', group: 'F' }, { kind: 'R', group: 'C' }],
  4:  [{ kind: 'W', group: 'C' }, { kind: 'R', group: 'F' }],
  5:  [{ kind: 'W', group: 'I' }, { kind: 'T', eligible: THIRD_SLOTS[5] }],
  6:  [{ kind: 'R', group: 'E' }, { kind: 'R', group: 'I' }],
  7:  [{ kind: 'W', group: 'A' }, { kind: 'T', eligible: THIRD_SLOTS[7] }],
  8:  [{ kind: 'W', group: 'L' }, { kind: 'T', eligible: THIRD_SLOTS[8] }],
  9:  [{ kind: 'W', group: 'D' }, { kind: 'T', eligible: THIRD_SLOTS[9] }],
  10: [{ kind: 'W', group: 'G' }, { kind: 'T', eligible: THIRD_SLOTS[10] }],
  11: [{ kind: 'R', group: 'K' }, { kind: 'R', group: 'L' }],
  12: [{ kind: 'W', group: 'H' }, { kind: 'R', group: 'J' }],
  13: [{ kind: 'W', group: 'B' }, { kind: 'T', eligible: THIRD_SLOTS[13] }],
  14: [{ kind: 'W', group: 'J' }, { kind: 'R', group: 'H' }],
  15: [{ kind: 'W', group: 'K' }, { kind: 'T', eligible: THIRD_SLOTS[15] }],
  16: [{ kind: 'R', group: 'D' }, { kind: 'R', group: 'G' }],
};

function thirdOf(g: GroupStanding): StandingRow | undefined {
  return g.teams.find((t) => t.rank === 3);
}

/** Group letters of the best 8 third-placed teams, best first. */
export function rankThirds(groups: GroupStanding[]): string[] {
  const ranked = [...groups]
    .map((g) => ({ group: g.group, t: thirdOf(g) }))
    .filter((x): x is { group: string; t: StandingRow } => !!x.t)
    .sort((a, b) =>
      b.t.points - a.t.points ||
      b.t.gd - a.t.gd ||
      b.t.gf - a.t.gf ||
      a.group.localeCompare(b.group),
    );
  return ranked.slice(0, 8).map((x) => x.group);
}
