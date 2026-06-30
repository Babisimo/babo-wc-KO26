import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32 } from '@/lib/bracket-picks';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';

/**
 * Global map of eliminated team -> the team that knocked them out, derived only from the
 * official R32 draw and the recorded knockout winners (independent of any user's picks).
 * For each decided slot, the loser is whichever official contestant is not the winner.
 * The champion (winner of the final slot) never loses, so never appears as a key.
 */
export function eliminations(
  officialR32: OfficialR32,
  winners: OfficialWinners,
): Record<string, string> {
  const cascade = winnersToPicks(winners);
  const out: Record<string, string> = {};
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const w = winners[slot];
    if (!w) continue;
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, cascade);
    const loser = w === teamA ? teamB : w === teamB ? teamA : null;
    if (loser) out[loser] = w;
  }
  return out;
}
