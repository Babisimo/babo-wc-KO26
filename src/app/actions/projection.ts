'use server';

import { mapEspnStandings } from '@/lib/standings-feed';
import { seedR32 } from '@/lib/wc26-seeding';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';
import type { OfficialR32 } from '@/lib/bracket-picks';

const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';

function empty() {
  return { available: false, asItStands: [] as SlotView[], confirmed: [] as SlotView[] };
}

export async function getProjectedBracket(): Promise<{ available: boolean; asItStands: SlotView[]; confirmed: SlotView[] }> {
  let json: unknown;
  try {
    const res = await fetch(ESPN_STANDINGS, { cache: 'no-store' });
    if (!res.ok) return empty();
    json = await res.json();
  } catch {
    return empty();
  }

  const groups = mapEspnStandings(json);
  if (groups.length === 0) return empty();

  const { projected, confirmedSlots } = seedR32(groups);

  // confirmed view: same field, but null out any slot not yet mathematically final
  const confirmedR32: OfficialR32 = {};
  for (let s = 1; s <= 16; s++) {
    confirmedR32[s] = confirmedSlots.has(s)
      ? projected[s]
      : { teamA: null, teamB: null };
  }

  return {
    available: true,
    asItStands: buildBracketView(projected, {}, {}),
    confirmed: buildBracketView(confirmedR32, {}, {}),
  };
}
