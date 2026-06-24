import { resolveCode } from '@/lib/team-resolve';
import type { GroupStanding, StandingRow } from '@/lib/wc26-seeding';

interface EspnEntry { team?: { displayName?: string }; stats?: Array<{ name?: string; value?: number }> }
interface EspnGroup { name?: string; standings?: { entries?: EspnEntry[] } }

function statVal(entry: EspnEntry, name: string): number {
  return entry.stats?.find((s) => s.name === name)?.value ?? 0;
}

/** Map an ESPN soccer standings payload into the seeding engine's input. */
export function mapEspnStandings(json: unknown): GroupStanding[] {
  const root = json as { children?: unknown[] } | null;
  const children = Array.isArray(root?.children) ? root!.children : [];
  const out: GroupStanding[] = [];
  for (const child of children as EspnGroup[]) {
    const m = /Group\s+([A-L])/i.exec(child?.name ?? '');
    if (!m) continue;
    const entries = child.standings?.entries ?? [];
    const teams: StandingRow[] = entries.map((e) => ({
      code: resolveCode(e.team?.displayName ?? ''),
      rank: statVal(e, 'rank'),
      points: statVal(e, 'points'),
      gd: statVal(e, 'pointDifferential'),
      gf: statVal(e, 'pointsFor'),
    }));
    teams.sort((a, b) => a.rank - b.rank);
    const complete = entries.length > 0 && entries.every((e) => statVal(e, 'gamesPlayed') === 3);
    out.push({ group: m[1].toUpperCase(), complete, teams });
  }
  return out;
}
