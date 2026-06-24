import { resolveCode } from '@/lib/team-resolve';
import { applyWinner } from '@/lib/official-winners';
import { slotsForRound } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32 } from '@/lib/bracket-picks';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';

export type FeedResult = { teamA: string; teamB: string; winner: string | null };

interface EspnCompetitor {
  homeAway?: string;
  team?: { displayName?: string };
  score?: string | number | null;
  winner?: boolean;
}

/** Map a raw ESPN scoreboard payload to resolved, finished knockout results. */
export function mapEspnKnockout(json: unknown): FeedResult[] {
  const root = json as { events?: unknown[] } | null;
  const events = Array.isArray(root?.events) ? root!.events : [];
  const out: FeedResult[] = [];
  for (const ev of events as Array<{ competitions?: unknown[] }>) {
    const comp = Array.isArray(ev?.competitions) ? (ev.competitions[0] as {
      status?: { type?: { completed?: boolean } };
      competitors?: EspnCompetitor[];
    }) : undefined;
    if (!comp?.status?.type?.completed) continue;
    const comps = comp.competitors ?? [];
    const home = comps.find((c) => c.homeAway === 'home');
    const away = comps.find((c) => c.homeAway === 'away');
    const a = resolveCode(home?.team?.displayName ?? '');
    const b = resolveCode(away?.team?.displayName ?? '');
    if (!a || !b) continue;
    const winnerComp = comps.find((c) => c.winner === true);
    const winner = winnerComp ? resolveCode(winnerComp.team?.displayName ?? '') : null;
    out.push({ teamA: a, teamB: b, winner });
  }
  return out;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/**
 * Build the official winners map from feed results by walking the bracket in
 * round order: each slot's current contestants (from already-decided feeders)
 * are matched to a feed result by unordered team pair.
 */
export function resolveOfficialWinners(officialR32: OfficialR32, feed: FeedResult[]): OfficialWinners {
  const byPair = new Map<string, FeedResult>();
  for (const f of feed) byPair.set(pairKey(f.teamA, f.teamB), f);

  let winners: OfficialWinners = {};
  const rounds = ['R32', 'R16', 'QF', 'SF', 'FINAL'] as const;
  for (const round of rounds) {
    for (const slot of slotsForRound(round)) {
      const { teamA, teamB } = contestantsForSlot(slot, officialR32, winnersToPicks(winners));
      if (!teamA || !teamB) continue;
      const match = byPair.get(pairKey(teamA, teamB));
      if (match && match.winner && (match.winner === teamA || match.winner === teamB)) {
        winners = applyWinner(officialR32, winners, slot, match.winner);
      }
    }
  }
  return winners;
}
