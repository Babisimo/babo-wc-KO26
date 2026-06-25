'use server';

import { mapEspnStandings } from '@/lib/standings-feed';
import { seedR32 } from '@/lib/wc26-seeding';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';

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

  const { projected, confirmed } = seedR32(groups);

  return {
    available: true,
    asItStands: buildBracketView(projected, {}, {}),
    // each confirmed team appears in its slot, even if the opponent isn't decided yet
    confirmed: buildBracketView(confirmed, {}, {}),
  };
}
