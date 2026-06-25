import type { Round } from '@prisma/client';
import { slotsForRound, TOTAL_SLOTS } from '@/lib/bracket-structure';
import type { OfficialWinners } from '@/lib/scoring';

export type RoundStatus = 'done' | 'live' | 'upcoming';
export type RoundStage = { round: Round; decided: number; total: number; status: RoundStatus };
export type Stage = {
  rounds: RoundStage[];
  current: Round | null;   // the round being played; null once the Final is decided
  champion: string | null; // winner of slot 31 once decided
  started: boolean;        // any game decided yet
};

const ORDER: Round[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];

/**
 * Where the knockout stage stands, derived purely from decided winners. The current
 * round is the earliest one not yet complete; everything before it is done, after it
 * upcoming. Pure — no fetching.
 */
export function computeStage(winners: OfficialWinners): Stage {
  const rounds: RoundStage[] = ORDER.map((round) => {
    const slots = slotsForRound(round);
    const decided = slots.filter((s) => winners[s]).length;
    return { round, decided, total: slots.length, status: 'upcoming' as RoundStatus };
  });

  let current: Round | null = null;
  for (const r of rounds) {
    if (r.decided >= r.total) {
      r.status = 'done';
    } else {
      r.status = 'live';
      current = r.round;
      break; // rounds after this stay 'upcoming'
    }
  }

  const finalDone = rounds[rounds.length - 1].status === 'done';
  return {
    rounds,
    current,
    champion: finalDone ? (winners[TOTAL_SLOTS] ?? null) : null,
    started: rounds.some((r) => r.decided > 0),
  };
}
