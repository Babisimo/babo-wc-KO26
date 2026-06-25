import type { Round } from '@prisma/client';
import { TOTAL_SLOTS, roundForSlot, ROUND_POINTS } from '@/lib/bracket-structure';
import type { Picks } from '@/lib/bracket-picks';
import { scoreBracket, type OfficialWinners } from '@/lib/scoring';

// One undecided slot where the two brackets picked different teams — the only kind
// of game that can still move the head-to-head between them.
export interface H2HSlot {
  slot: number;
  round: Round;
  points: number;   // ROUND_POINTS[round] — what this game is worth
  aPick: string;    // team A needs to win this slot to bank the points
  bPick: string;
}

export interface H2HReport {
  a: string;                  // label of bracket A
  b: string;                  // label of bracket B
  aNow: number;               // points banked so far
  bNow: number;
  gap: number;                // aNow - bNow (signed)
  leader: string | null;      // label ahead, or null if tied
  trailer: string | null;     // label behind, or null if tied
  settled: { aWon: number; bWon: number };  // points won on decided slots where they differed
  remaining: H2HSlot[];       // undecided differences, biggest swing first
  remainingValue: number;     // total points still in play across `remaining`
  needNet: number;            // points the trailer must net to take the lead (0 if tied)
  canCatch: boolean;          // whether enough points remain for the trailer to lead on picks alone
  identical: boolean;         // no remaining differences to play for
}

/**
 * Compare two brackets slot by slot: surface the still-undecided games where they
 * picked different teams (round-weighted), and frame what the trailing bracket needs
 * to overtake. Pure — no fetching, no React.
 */
export function compareBrackets(
  a: { label: string; picks: Picks },
  b: { label: string; picks: Picks },
  winners: OfficialWinners,
): H2HReport {
  const aNow = scoreBracket(a.picks, winners);
  const bNow = scoreBracket(b.picks, winners);

  const gap = aNow - bNow;
  const leader = gap > 0 ? a.label : gap < 0 ? b.label : null;
  const trailer = gap > 0 ? b.label : gap < 0 ? a.label : null;

  const settled = { aWon: 0, bWon: 0 };
  const remaining: H2HSlot[] = [];

  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const aPick = a.picks[slot];
    const bPick = b.picks[slot];
    if (!aPick || !bPick) continue;   // an incomplete bracket — not comparable here
    if (aPick === bPick) continue;    // same pick — can't move the head-to-head

    const round = roundForSlot(slot);
    const points = ROUND_POINTS[round];
    const winner = winners[slot] ?? null;

    if (winner) {
      if (aPick === winner) settled.aWon += points;
      else if (bPick === winner) settled.bWon += points;
      continue;
    }
    remaining.push({ slot, round, points, aPick, bPick });
  }

  // Biggest swing first (Final before a Round-of-32 game), then by slot for stability.
  remaining.sort((x, y) => (y.points - x.points) || (x.slot - y.slot));

  const remainingValue = remaining.reduce((sum, g) => sum + g.points, 0);
  const needNet = leader ? Math.abs(gap) + 1 : 0;

  return {
    a: a.label,
    b: b.label,
    aNow,
    bNow,
    gap,
    leader,
    trailer,
    settled,
    remaining,
    remainingValue,
    needNet,
    canCatch: remainingValue >= needNet,
    identical: remaining.length === 0,
  };
}
