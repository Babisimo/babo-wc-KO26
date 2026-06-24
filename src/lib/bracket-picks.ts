import { TOTAL_SLOTS, participantsForSlot, type SlotResult } from '@/lib/bracket-structure';

export type Picks = Record<number, string>;
export type OfficialR32 = Record<number, { teamA: string | null; teamB: string | null }>;

/** Build the SlotResult map participantsForSlot expects from the official R32 + the user's picks. */
function toSlotResults(officialR32: OfficialR32, picks: Picks): Record<number, SlotResult> {
  const map: Record<number, SlotResult> = {};
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const o = officialR32[slot];
    map[slot] = {
      teamA: o?.teamA ?? null,
      teamB: o?.teamB ?? null,
      winner: picks[slot] ?? null,
    };
  }
  return map;
}

export function contestantsForSlot(
  slot: number,
  officialR32: OfficialR32,
  picks: Picks,
): { teamA: string | null; teamB: string | null } {
  return participantsForSlot(slot, toSlotResults(officialR32, picks));
}

export function applyPick(
  officialR32: OfficialR32,
  picks: Picks,
  slot: number,
  winner: string,
): Picks {
  const next: Picks = { ...picks, [slot]: winner };
  // NOTE: we mutate `next` in place during this sweep on purpose — clearing an
  // earlier slot must be visible when we evaluate later slots in the SAME pass,
  // which is what makes the cascade transitive in one loop. Do not refactor to
  // build a fresh object slot-by-slot.
  // Sweep later slots in dependency order (slot numbers increase down the tree).
  // Clear any pick that is no longer one of its current two contestants.
  for (let s = slot + 1; s <= TOTAL_SLOTS; s++) {
    const current = next[s];
    if (current === undefined) continue;
    const { teamA, teamB } = contestantsForSlot(s, officialR32, next);
    if (current !== teamA && current !== teamB) {
      delete next[s];
    }
  }
  return next;
}

export function bracketComplete(picks: Picks): boolean {
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    if (!picks[s]) return false;
  }
  return true;
}
