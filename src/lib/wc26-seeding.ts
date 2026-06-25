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

import type { OfficialR32 } from '@/lib/bracket-picks';

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

const THIRD_SLOT_NUMS = [2, 5, 7, 8, 9, 10, 13, 15] as const;

/**
 * Perfect matching of the 8 third-slots to the 8 qualifying groups, honoring
 * THIRD_SLOTS eligibility. Deterministic backtracking: slots in ascending order, each
 * tries eligible unused groups in alphabetical order; first complete matching wins.
 */
export function assignThirds(qualified: string[]): Record<number, string> {
  const qset = new Set(qualified);
  const slots = [...THIRD_SLOT_NUMS];
  const used = new Set<string>();
  const result: Record<number, string> = {};

  function solve(i: number): boolean {
    if (i === slots.length) return true;
    const slot = slots[i];
    const eligible = THIRD_SLOTS[slot]
      .split('')
      .filter((g) => qset.has(g) && !used.has(g))
      .sort();
    for (const g of eligible) {
      used.add(g);
      result[slot] = g;
      if (solve(i + 1)) return true;
      used.delete(g);
      delete result[slot];
    }
    return false;
  }

  if (!solve(0)) throw new Error(`no valid third-place allocation for [${qualified.join(',')}]`);
  return result;
}

function byLetter(groups: GroupStanding[]): Map<string, GroupStanding> {
  return new Map(groups.map((g) => [g.group, g]));
}
function rowAtRank(g: GroupStanding | undefined, rank: number): string | null {
  return g?.teams.find((t) => t.rank === rank)?.code ?? null;
}

/**
 * R32 field from current standings, in two views:
 *  - `projected`: the full as-it-stands field (every position filled).
 *  - `confirmed`: each position kept ONLY if that team is mathematically final in
 *    that exact slot (a group winner/runner-up of a completed group, or a third
 *    once all groups are done). Positions confirm independently — a confirmed team
 *    shows even if its opponent isn't decided yet.
 */
export function seedR32(groups: GroupStanding[]): { projected: OfficialR32; confirmed: OfficialR32 } {
  const map = byLetter(groups);
  const allComplete = groups.length === 12 && groups.every((g) => g.complete);
  const qualifiedThirds = rankThirds(groups);
  const thirdAssign = assignThirds(qualifiedThirds); // slot -> group letter

  const projected: OfficialR32 = {};
  const confirmed: OfficialR32 = {};

  // Resolve one position to a team code + whether it is mathematically final.
  // `slot` is needed only for third positions (it selects the allocated group).
  function resolve(p: Pos, slot: number): { code: string | null; confirmed: boolean } {
    if (p.kind === 'W') return { code: rowAtRank(map.get(p.group), 1), confirmed: map.get(p.group)?.complete ?? false };
    if (p.kind === 'R') return { code: rowAtRank(map.get(p.group), 2), confirmed: map.get(p.group)?.complete ?? false };
    // third: the allocated group's 3rd-place team; final only once ALL groups are complete
    return { code: rowAtRank(map.get(thirdAssign[slot]), 3), confirmed: allComplete };
  }

  for (let slot = 1; slot <= 16; slot++) {
    const [p1, p2] = R32_SCHEDULE[slot];
    const r1 = resolve(p1, slot);
    const r2 = resolve(p2, slot);
    projected[slot] = { teamA: r1.code, teamB: r2.code };
    confirmed[slot] = {
      teamA: r1.confirmed ? r1.code : null,
      teamB: r2.confirmed ? r2.code : null,
    };
  }

  return { projected, confirmed };
}
