'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/app/actions/admin';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import { contestantsForSlot } from '@/lib/bracket-picks';
import { applyWinner } from '@/lib/official-winners';
import { mapEspnKnockout, resolveOfficialWinners } from '@/lib/results-feed';
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';

const ESPN_KO_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260628-20260720';

/** Read Match.actualWinner rows into a slot -> code map. */
export async function currentWinners(): Promise<OfficialWinners> {
  const rows = await db.match.findMany({ select: { slot: true, actualWinner: true } });
  const w: OfficialWinners = {};
  for (const r of rows) w[r.slot] = r.actualWinner;
  return w;
}

export async function setMatchWinner(slot: number, winner: string | null): Promise<{ error?: string }> {
  await requireAdmin();
  if (!Number.isInteger(slot) || slot < 1 || slot > TOTAL_SLOTS) {
    return { error: 'Invalid slot.' };
  }

  const official = await getOfficialBracket();
  const officialR32 = officialR32FromSlots(official.slots);
  const before = await currentWinners();

  if (winner !== null) {
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, winnersToPicks(before));
    if (winner !== teamA && winner !== teamB) {
      return { error: 'That team is not in this game yet.' };
    }
  }

  const after = applyWinner(officialR32, before, slot, winner);

  // Persist every slot whose winner changed, in a single transaction.
  const persistOps: ReturnType<typeof db.match.update>[] = [];
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    const wb = before[s] ?? null;
    const wa = after[s] ?? null;
    if (wb === wa) continue;
    if (s === slot) {
      persistOps.push(
        db.match.update({
          where: { slot: s },
          data: { actualWinner: winner, winnerSource: winner === null ? null : 'ADMIN' },
        }),
      );
    } else {
      // downstream slot got cleared by the cascade
      persistOps.push(
        db.match.update({
          where: { slot: s },
          data: { actualWinner: null, winnerSource: null },
        }),
      );
    }
  }
  if (persistOps.length > 0) {
    await db.$transaction(persistOps);
  }

  revalidatePath('/admin/bracket');
  revalidatePath('/');
  return {};
}

export async function refreshResults(): Promise<{ error?: string; updated?: number }> {
  await requireAdmin();

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

  if (changes.length > 0) {
    await db.$transaction(
      changes.map((c) =>
        db.match.update({
          where: { slot: c.slot },
          data: { actualWinner: c.next, winnerSource: c.next === null ? null : 'FEED' },
        }),
      ),
    );
  }

  revalidatePath('/admin/bracket');
  revalidatePath('/');
  return { updated: changes.length };
}

/** Set the per-player entry price (dollars). The pot is this times the number of players. */
export async function setEntryPrice(dollars: number): Promise<{ error?: string }> {
  await requireAdmin();
  if (!Number.isFinite(dollars) || dollars < 0) return { error: 'Enter a valid amount.' };
  const entryCents = Math.round(dollars * 100);
  await db.poolConfig.upsert({
    where: { id: 'default' },
    update: { entryCents },
    create: { id: 'default', entryCents },
  });
  revalidatePath('/');
  revalidatePath('/admin/bracket');
  return {};
}
