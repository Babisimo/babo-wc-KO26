import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32, type Picks } from '@/lib/bracket-picks';

export function validateSubmission(
  officialR32: OfficialR32,
  picks: Picks,
): { ok: true } | { ok: false; error: string } {
  // Official R32 must be fully set: slots 1..16 with both teams.
  for (let s = 1; s <= 16; s++) {
    const o = officialR32[s];
    if (!o || !o.teamA || !o.teamB) {
      return { ok: false, error: 'The official Round-of-32 bracket is not set yet.' };
    }
  }
  // Every slot must have a pick that is one of its current contestants.
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    const pick = picks[s];
    if (!pick) return { ok: false, error: 'Your bracket is incomplete — pick every game.' };
    const { teamA, teamB } = contestantsForSlot(s, officialR32, picks);
    if (pick !== teamA && pick !== teamB) {
      return { ok: false, error: `Slot ${s} has a pick that did not reach that game.` };
    }
  }
  return { ok: true };
}

/**
 * Draft-save validation: the bracket may be incomplete (the draw isn't final yet), but every
 * pick that *is* present must be one of that slot's current contestants. Missing picks are fine.
 */
export function validateDraft(
  officialR32: OfficialR32,
  picks: Picks,
): { ok: true } | { ok: false; error: string } {
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    const pick = picks[s];
    if (!pick) continue;
    const { teamA, teamB } = contestantsForSlot(s, officialR32, picks);
    if (pick !== teamA && pick !== teamB) {
      return { ok: false, error: `Slot ${s} has a pick that did not reach that game.` };
    }
  }
  return { ok: true };
}
