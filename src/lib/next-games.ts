export type GameState = 'pre' | 'in' | 'post';
export type Game = {
  teamA: string; teamB: string; kickoffIso: string;
  state: GameState; scoreA: number | null; scoreB: number | null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Parse an ESPN scoreboard payload into resolved games. `resolve` maps a competitor's
 *  (abbreviation, displayName) to an internal code or null (placeholder/unknown → skipped). */
export function mapScoreboardGames(
  json: unknown,
  resolve: (abbr?: string, name?: string) => string | null,
): Game[] {
  const events = Array.isArray((json as { events?: unknown[] })?.events) ? (json as { events: unknown[] }).events : [];
  const out: Game[] = [];
  const seen = new Set<string>();
  for (const ev of events as Array<{ date?: string; competitions?: Array<{ status?: { type?: { state?: string } }; competitors?: Array<{ team?: { abbreviation?: string; displayName?: string }; score?: unknown }> }> }>) {
    const comp = ev?.competitions?.[0];
    const cs = comp?.competitors ?? [];
    if (cs.length !== 2) continue;
    const a = resolve(cs[0]?.team?.abbreviation, cs[0]?.team?.displayName);
    const b = resolve(cs[1]?.team?.abbreviation, cs[1]?.team?.displayName);
    if (!a || !b) continue;
    const key = [a, b].sort().join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    const st = comp?.status?.type?.state;
    const state: GameState = st === 'in' ? 'in' : st === 'post' ? 'post' : 'pre';
    out.push({
      teamA: a, teamB: b, kickoffIso: ev?.date ?? '', state,
      scoreA: state === 'pre' ? null : num(cs[0]?.score),
      scoreB: state === 'pre' ? null : num(cs[1]?.score),
    });
  }
  return out;
}

const ms = (iso: string): number => {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
};

/** Up to `limit` games to surface: live first, then soonest upcoming, then most-recent finals. */
export function pickGames(games: Game[], limit = 3): Game[] {
  const live = games.filter((g) => g.state === 'in');
  const upcoming = games.filter((g) => g.state === 'pre').sort((a, b) => ms(a.kickoffIso) - ms(b.kickoffIso));
  const finals = games.filter((g) => g.state === 'post').sort((a, b) => ms(b.kickoffIso) - ms(a.kickoffIso));
  return [...live, ...upcoming, ...finals].slice(0, limit);
}

/** How the pool's brackets are split between the two teams of one slot.
 *  `a`/`b` are fractions (0..1) of the brackets that picked teamA/teamB to advance;
 *  `voters` is how many brackets picked either side (others left it blank). */
export type PoolSplit = { a: number; b: number; voters: number };

export function poolSplit(
  allPicks: Record<number, string>[],
  slot: number,
  teamA: string,
  teamB: string,
): PoolSplit {
  let a = 0, b = 0;
  for (const picks of allPicks) {
    const p = picks[slot];
    if (p === teamA) a++;
    else if (p === teamB) b++;
  }
  const voters = a + b;
  return { a: voters ? a / voters : 0, b: voters ? b / voters : 0, voters };
}
