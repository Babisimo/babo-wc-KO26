import type { OfficialR32 } from '@/lib/bracket-picks';

export type EffectiveR32 = {
  /** Teams to render and pick from in each R32 slot (1..16); null where not yet known. */
  r32: OfficialR32;
  /** True for a slot once both its teams are locked and will no longer drift. */
  confirmed: Record<number, boolean>;
};

/**
 * Resolve the R32 a user actually fills against, so they can start now:
 *
 *  1. If the official slot (admin / results feed) has both teams, use it — confirmed, never drifts.
 *  2. Else fall back to the live "as-it-stands" projection — provisional, may change.
 *  3. Else leave the slot empty (TBD).
 *
 * A slot is `confirmed` when it came from the official draw, or when the projection's teams
 * for that slot match the projection's own confirmed set (i.e. both groups have finished).
 */
export function mergeEffectiveR32(
  official: OfficialR32,
  projected: OfficialR32,
  projectedConfirmed: OfficialR32,
): EffectiveR32 {
  const r32: OfficialR32 = {};
  const confirmed: Record<number, boolean> = {};
  for (let s = 1; s <= 16; s++) {
    const off = official[s];
    if (off?.teamA && off?.teamB) {
      r32[s] = { teamA: off.teamA, teamB: off.teamB };
      confirmed[s] = true;
      continue;
    }
    const proj = projected[s];
    const conf = projectedConfirmed[s];
    r32[s] = { teamA: proj?.teamA ?? null, teamB: proj?.teamB ?? null };
    confirmed[s] =
      !!proj?.teamA && !!proj?.teamB &&
      conf?.teamA === proj.teamA && conf?.teamB === proj.teamB;
  }
  return { r32, confirmed };
}
