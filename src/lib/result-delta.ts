import { scoreBracket } from '@/lib/scoring';
import { rankEntries } from '@/lib/leaderboard-rank';
import { TOTAL_SLOTS } from '@/lib/bracket-structure';

export type WinnerMap = Record<number, string | null>;
export type SlotTeams = Record<number, { teamA: string | null; teamB: string | null }>;
export type DeltaBracket = { display: string; rankName: string; picks: Record<number, string> };
export type ResultEventData = { slot: number; winner: string; loser: string; bustedCount: number };

/** Display name of the rank-1 bracket's owner under a given winner map (null if no brackets). */
function leaderDisplay(brackets: DeltaBracket[], winners: WinnerMap): string | null {
  if (brackets.length === 0) return null;
  const ranked = rankEntries(
    brackets.map((b) => ({ key: b.rankName, name: b.rankName, total: scoreBracket(b.picks, winners) })),
  );
  const topName = ranked[0].name;
  return brackets.find((b) => b.rankName === topName)?.display ?? null;
}

/**
 * What changed between two winner maps: a ResultEvent per newly-decided slot (winner appeared),
 * plus the new leader's display when the top of the board flipped.
 */
export function resultDelta(
  oldW: WinnerMap,
  newW: WinnerMap,
  slots: SlotTeams,
  brackets: DeltaBracket[],
): { events: ResultEventData[]; newLeader: string | null } {
  const events: ResultEventData[] = [];
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const before = oldW[slot] ?? null;
    const after = newW[slot] ?? null;
    if (before || !after) continue; // only no-winner → winner
    const teams = slots[slot] ?? { teamA: null, teamB: null };
    const loser = (teams.teamA === after ? teams.teamB : teams.teamA) ?? '';
    const bustedCount = loser ? brackets.filter((b) => b.picks[slot] === loser).length : 0;
    events.push({ slot, winner: after, loser, bustedCount });
  }

  const before = leaderDisplay(brackets, oldW);
  const after = leaderDisplay(brackets, newW);
  const newLeader = after && after !== before ? after : null;

  return { events, newLeader };
}
