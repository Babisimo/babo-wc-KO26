import { gameSlotPick, type SlotParticipants } from '@/lib/game-slot';
import type { Game } from '@/lib/next-games';
import type { Picks } from '@/lib/bracket-picks';

export type GamePickHeader = { teamA: string; teamB: string; state: Game['state'] };
export type GamePickCell = { code: string } | null; // null = this bracket left the slot blank
export type LeaderboardPicks = {
  headers: GamePickHeader[];                  // the next match (0 or 1 header)
  cellsByKey: Record<string, GamePickCell[]>; // bracket id -> one cell per header, same order
};

/** For the next not-yet-decided knockout match, the team every bracket is backing.
 *  The "next" match is the first game (`games` arrives live → soonest-upcoming → finals) whose
 *  two teams match an official slot AND whose slot has no official winner yet. Decided games and
 *  later upcoming games are dropped — only the single current/up-next match is surfaced. */
export function buildLeaderboardPicks(
  slots: SlotParticipants[],
  games: Game[],
  brackets: { key: string; picks: Picks }[],
  winners: Record<number, string | null>,
): LeaderboardPicks {
  const next = games.find((g) => {
    const { slot } = gameSlotPick(slots, g, {}, winners);
    return slot != null && winners[slot] == null;
  });

  const cellsByKey: Record<string, GamePickCell[]> = {};
  for (const b of brackets) {
    if (!next) { cellsByKey[b.key] = []; continue; }
    const { yourPick } = gameSlotPick(slots, next, b.picks, winners);
    cellsByKey[b.key] = [yourPick ? { code: yourPick } : null];
  }

  const headers: GamePickHeader[] = next ? [{ teamA: next.teamA, teamB: next.teamB, state: next.state }] : [];
  return { headers, cellsByKey };
}
