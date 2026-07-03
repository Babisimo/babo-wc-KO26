import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32 } from '@/lib/bracket-picks';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';
import type { SlotStatus } from '@/lib/bracket-view';

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

/**
 * Which eliminator (if any) to name in the "knocked out by" badge on a single card side.
 * An eliminated team is always struck through wherever it appears; the badge is narrower —
 * it only surfaces where a player *backed a doomed team*: this side is their pick AND the
 * pick did not win this slot (`status !== 'correct'`). On the official view the highlighted
 * side is the actual slot winner (status 'correct'), so it never shows a badge — just the
 * strikethrough. Returns the eliminator code to display, or null to suppress the badge.
 */
export function eliminatorBadge(
  eliminatedBy: Record<string, string> | undefined,
  code: string | null,
  isPick: boolean,
  status: SlotStatus | undefined,
): string | null {
  if (code == null || !isPick || status === 'correct') return null;
  return eliminatedBy?.[code] ?? null;
}
