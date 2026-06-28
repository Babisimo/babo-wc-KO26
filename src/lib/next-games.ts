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
