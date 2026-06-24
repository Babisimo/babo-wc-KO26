import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32 } from '@/lib/bracket-picks';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';

/**
 * Clear any later-round winner that is no longer one of its slot's current
 * contestants. One forward sweep suffices: slots are numbered in dependency
 * order, so an upstream clear is visible when we evaluate downstream slots.
 */
export function reconcileWinners(
  officialR32: OfficialR32,
  winners: OfficialWinners,
): OfficialWinners {
  const next: OfficialWinners = { ...winners };
  for (let s = 17; s <= TOTAL_SLOTS; s++) {
    const w = next[s];
    if (!w) continue;
    const { teamA, teamB } = contestantsForSlot(s, officialR32, winnersToPicks(next));
    if (w !== teamA && w !== teamB) delete next[s];
  }
  return next;
}

export function applyWinner(
  officialR32: OfficialR32,
  winners: OfficialWinners,
  slot: number,
  winner: string | null,
): OfficialWinners {
  const next: OfficialWinners = { ...winners };
  if (winner === null) delete next[slot];
  else next[slot] = winner;
  return reconcileWinners(officialR32, next);
}
