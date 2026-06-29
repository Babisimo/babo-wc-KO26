import { TEAMS } from '@/lib/teams';
import { resolveCode } from '@/lib/team-resolve';
import { mapScoreboardGames, pickGames, type Game } from '@/lib/next-games';

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
// Knockout window (UTC). One request covers the whole range.
const DATES = '20260628-20260720';

const KNOWN = new Set(TEAMS.map((t) => t.code));
const resolveTeam = (abbr?: string, name?: string): string | null => {
  if (abbr && KNOWN.has(abbr)) return abbr;
  const r = resolveCode(name ?? abbr ?? '');
  return r && KNOWN.has(r) ? r : null;
};

/** Fetch the ESPN knockout scoreboard and surface the games worth showing
 *  (live → soonest upcoming → most-recent finals, up to 3). Returns [] on any failure.
 *  Shared by the "Next up" strip and the leaderboard pick chips. */
export async function fetchSurfacedGames(): Promise<Game[]> {
  try {
    const res = await fetch(`${SCOREBOARD}?dates=${DATES}`, { next: { revalidate: 15 } });
    if (!res.ok) return [];
    return pickGames(mapScoreboardGames(await res.json(), resolveTeam));
  } catch {
    return []; // feed unreachable → empty; callers degrade gracefully
  }
}
