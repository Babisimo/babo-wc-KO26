import { TOTAL_SLOTS, roundForSlot } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32, type Picks } from '@/lib/bracket-picks';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';
import type { Round } from '@prisma/client';

export type SlotStatus = 'correct' | 'wrong' | 'pending';
export type SlotView = {
  slot: number;
  round: Round;
  teamA: string | null;
  teamB: string | null;
  pick: string | null;
  officialWinner: string | null;
  status: SlotStatus;
};

export function buildBracketView(
  officialR32: OfficialR32,
  picks: Picks,
  winners: OfficialWinners,
): SlotView[] {
  const out: SlotView[] = [];
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
    const pick = picks[slot] ?? null;
    const officialWinner = winners[slot] ?? null;
    let status: SlotStatus = 'pending';
    if (officialWinner) status = pick === officialWinner ? 'correct' : 'wrong';
    out.push({ slot, round: roundForSlot(slot), teamA, teamB, pick, officialWinner, status });
  }
  return out;
}

// Re-export so consumers that already hold OfficialWinners can normalize if needed.
export { winnersToPicks };
