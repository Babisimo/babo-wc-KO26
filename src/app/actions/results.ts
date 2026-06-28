'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/app/actions/admin';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import { contestantsForSlot } from '@/lib/bracket-picks';
import { applyWinner } from '@/lib/official-winners';
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';
import { buildResultDeltaOps } from '@/app/actions/results-delta';
import { runResultsRefresh } from '@/lib/results-refresh';

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
  const deltaOps = await buildResultDeltaOps(before, after);
  if (persistOps.length > 0 || deltaOps.length > 0) {
    await db.$transaction([...persistOps, ...deltaOps]);
  }

  revalidatePath('/admin/bracket');
  revalidatePath('/');
  return {};
}

export async function refreshResults(): Promise<{ error?: string; updated?: number }> {
  await requireAdmin();
  return runResultsRefresh();
}

/** Set the per-bracket entry price (dollars). The pot is this times the official brackets entered. */
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
