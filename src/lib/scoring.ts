import { TOTAL_SLOTS, roundForSlot, ROUND_POINTS } from '@/lib/bracket-structure';
import type { Picks } from '@/lib/bracket-picks';

export type OfficialWinners = Record<number, string | null>;

/** Round-weighted score: sum of ROUND_POINTS over slots the user got right. */
export function scoreBracket(picks: Picks, winners: OfficialWinners): number {
  let total = 0;
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const winner = winners[slot];
    if (winner && picks[slot] === winner) {
      total += ROUND_POINTS[roundForSlot(slot)];
    }
  }
  return total;
}

/** Strip nulls so an OfficialWinners map fits where a Picks (Record<number,string>) is expected. */
export function winnersToPicks(winners: OfficialWinners): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(winners)) {
    if (typeof v === 'string') out[Number(k)] = v;
  }
  return out;
}
