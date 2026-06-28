'use server';

import { mapEspnStandings } from '@/lib/standings-feed';
import { seedR32 } from '@/lib/wc26-seeding';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';
import type { OfficialR32 } from '@/lib/bracket-picks';
import { TEAMS } from '@/lib/teams';
import { resolveCode } from '@/lib/team-resolve';
import { mapEspnSchedule, reconcileSeedWithFixtures, fixtureMismatches, type FixturePair } from '@/lib/r32-fixtures';

const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
// The WC2026 Round-of-32 window (UTC). Fixtures appear here once the draw is set.
const R32_DATES = ['20260628', '20260629', '20260630', '20260701', '20260702', '20260703', '20260704'];

const KNOWN = new Set(TEAMS.map((t) => t.code));
const resolveTeam = (abbr?: string, name?: string): string | null => {
  if (abbr && KNOWN.has(abbr)) return abbr;
  const r = resolveCode(name ?? abbr ?? '');
  return r && KNOWN.has(r) ? r : null;
};

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Real R32 fixtures from ESPN's schedule, deduped; empty when the draw isn't scheduled yet. */
async function getScheduledFixtures(): Promise<FixturePair[]> {
  const payloads = await Promise.all(R32_DATES.map((d) => getJson(`${ESPN_SCOREBOARD}?dates=${d}`)));
  const all: FixturePair[] = [];
  const seen = new Set<string>();
  for (const json of payloads) {
    if (!json) continue;
    for (const f of mapEspnSchedule(json, resolveTeam)) {
      const key = [f.teamA, f.teamB].sort().join('+');
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(f);
    }
  }
  return all;
}

/**
 * The live R32 seed (projected + confirmed) from current standings, reconciled with the
 * real ESPN fixtures once they're published. Before the draw is scheduled this is just the
 * standings-derived heuristic; after, the best-third-place slots are corrected to reality.
 */
async function getLiveSeed(): Promise<{ available: boolean; projected: OfficialR32; confirmed: OfficialR32 }> {
  const standingsJson = await getJson(ESPN_STANDINGS);
  if (!standingsJson) return { available: false, projected: {}, confirmed: {} };
  const groups = mapEspnStandings(standingsJson);
  if (groups.length === 0) return { available: false, projected: {}, confirmed: {} };

  const seed = seedR32(groups);

  const fixtures = await getScheduledFixtures();
  if (fixtures.length === 0) return { available: true, ...seed };

  const thirds = new Set<string>();
  for (const g of groups) for (const t of g.teams) if (t.rank === 3 && t.code) thirds.add(t.code);
  const isThird = (c: string) => thirds.has(c);

  // Guard: surface any slot where the heuristic disagrees with the real draw.
  const mismatches = fixtureMismatches(seed.projected, fixtures, isThird);
  if (mismatches.length > 0) {
    console.warn('[projection] R32 heuristic corrected from real fixtures:', JSON.stringify(mismatches));
  }

  return { available: true, ...reconcileSeedWithFixtures(seed, fixtures, isThird) };
}

export async function getProjectedBracket(): Promise<{ available: boolean; asItStands: SlotView[]; confirmed: SlotView[] }> {
  const { available, projected, confirmed } = await getLiveSeed();
  if (!available) return { available: false, asItStands: [], confirmed: [] };
  return {
    available: true,
    asItStands: buildBracketView(projected, {}, {}),
    // each confirmed team appears in its slot, even if the opponent isn't decided yet
    confirmed: buildBracketView(confirmed, {}, {}),
  };
}

/**
 * Raw R32 maps used to build the "effective R32" users fill against early:
 *  - `projected`: as-it-stands best guess for all 16 slots
 *  - `confirmed`: only teams locked by completed groups (others null)
 * Both empty when ESPN is unavailable, so the caller falls back to the official draw.
 */
export async function getProjectedR32(): Promise<{ projected: OfficialR32; confirmed: OfficialR32 }> {
  const { available, projected, confirmed } = await getLiveSeed();
  if (!available) return { projected: {}, confirmed: {} };
  return { projected, confirmed };
}
