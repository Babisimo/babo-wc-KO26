import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import { mapEspnKnockout, resolveOfficialWinners } from '@/lib/results-feed';
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import type { OfficialWinners } from '@/lib/scoring';
import { buildResultDeltaOps } from '@/app/actions/results-delta';

const ESPN_KO_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260628-20260720';

/**
 * Pull the latest results from the ESPN feed and persist any newly-decided slots
 * (with movement + ResultEvent drama, in one transaction). Shared by the admin
 * "Refresh results" button and the unattended cron route, so it does NOT gate on
 * an admin session — callers enforce their own auth (admin action / CRON_SECRET).
 * Admin-set winners are seeded + locked so the feed can't contradict them.
 */
export async function runResultsRefresh(): Promise<{ error?: string; updated?: number }> {
  let json: unknown;
  try {
    const res = await fetch(ESPN_KO_URL, { cache: 'no-store' });
    if (!res.ok) return { error: `Feed returned ${res.status}.` };
    json = await res.json();
  } catch {
    return { error: 'Could not reach the results feed.' };
  }

  const official = await getOfficialBracket();
  const officialR32 = officialR32FromSlots(official.slots);
  const feed = mapEspnKnockout(json);

  const rows = await db.match.findMany({ select: { slot: true, winnerSource: true, actualWinner: true } });
  const adminSlot = new Set(rows.filter((r) => r.winnerSource === 'ADMIN').map((r) => r.slot));
  const existing: OfficialWinners = {};
  const adminSeed: OfficialWinners = {};
  for (const r of rows) {
    existing[r.slot] = r.actualWinner;
    if (r.winnerSource === 'ADMIN') adminSeed[r.slot] = r.actualWinner;
  }

  // Seed from admin winners and lock those slots so the feed can't contradict the admin subtree.
  const resolved = resolveOfficialWinners(officialR32, feed, adminSeed, adminSlot);

  const changes: { slot: number; next: string | null }[] = [];
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    if (adminSlot.has(s)) continue;
    const next = resolved[s] ?? null;
    if ((existing[s] ?? null) === next) continue;
    changes.push({ slot: s, next });
  }

  const after: OfficialWinners = { ...existing };
  for (const c of changes) after[c.slot] = c.next;
  const deltaOps = await buildResultDeltaOps(existing, after);
  if (changes.length > 0 || deltaOps.length > 0) {
    await db.$transaction([
      ...changes.map((c) =>
        db.match.update({ where: { slot: c.slot }, data: { actualWinner: c.next, winnerSource: c.next === null ? null : 'FEED' } }),
      ),
      ...deltaOps,
    ]);
  }

  revalidatePath('/admin/bracket');
  revalidatePath('/');
  return { updated: changes.length };
}
