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

  const { projected, confirmed } = seedR32(groups);

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
  let json: unknown;
  try {
    const res = await fetch(ESPN_STANDINGS, { cache: 'no-store' });
    if (!res.ok) return { projected: {}, confirmed: {} };
    json = await res.json();
  } catch {
    return { projected: {}, confirmed: {} };
  }

  const groups = mapEspnStandings(json);
  if (groups.length === 0) return { projected: {}, confirmed: {} };

  return seedR32(groups);
}
