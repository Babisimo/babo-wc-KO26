'use server';

import { revalidatePath } from 'next/cache';
import type { Round } from '@prisma/client';
import { db } from '@/lib/db';
import { requireAdmin } from '@/app/actions/admin';
import { TEAMS } from '@/lib/teams';
import { validateR32Skeleton, type R32Entry } from '@/lib/r32-skeleton';
import {
  TOTAL_SLOTS,
  roundForSlot,
  participantsForSlot,
  type SlotResult,
} from '@/lib/bracket-structure';
import { computeLockTime } from '@/lib/lock';

export type { R32Entry };

export async function setR32Skeleton(entries: R32Entry[]): Promise<{ error?: string }> {
  await requireAdmin();
  const known = new Set(TEAMS.map((t) => t.code));
  const check = validateR32Skeleton(entries, known);
  if (!check.ok) return { error: check.error };

  // Upsert the 16 R32 matchups.
  for (const e of entries) {
    await db.match.upsert({
      where: { slot: e.slot },
      update: {
        round: 'R32',
        teamA: e.teamA,
        teamB: e.teamB,
        kickoff: e.kickoff ? new Date(e.kickoff) : null,
      },
      create: {
        slot: e.slot,
        round: 'R32',
        teamA: e.teamA,
        teamB: e.teamB,
        kickoff: e.kickoff ? new Date(e.kickoff) : null,
      },
    });
  }

  // Ensure the later-round slots (17..31) exist with the right round.
  for (let slot = 17; slot <= TOTAL_SLOTS; slot++) {
    const round = roundForSlot(slot);
    await db.match.upsert({
      where: { slot },
      update: { round },
      create: { slot, round },
    });
  }

  revalidatePath('/admin/bracket');
  revalidatePath('/');
  return {};
}

export type OfficialSlot = {
  slot: number;
  round: Round;
  teamA: string | null;
  teamB: string | null;
  winner: string | null;
  kickoff: string | null;
};

export async function getOfficialBracket(): Promise<{
  slots: OfficialSlot[];
  lockTimeIso: string | null;
}> {
  const rows = await db.match.findMany({ orderBy: { slot: 'asc' } });

  const bySlot: Record<number, SlotResult> = {};
  for (const r of rows) {
    bySlot[r.slot] = { teamA: r.teamA, teamB: r.teamB, winner: r.actualWinner };
  }

  const slots: OfficialSlot[] = [];
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const row = rows.find((r) => r.slot === slot);
    if (!row) continue;
    const { teamA, teamB } = participantsForSlot(slot, bySlot);
    slots.push({
      slot,
      round: row.round,
      teamA,
      teamB,
      winner: row.actualWinner,
      kickoff: row.kickoff ? row.kickoff.toISOString() : null,
    });
  }

  const r32Kickoffs = rows
    .filter((r) => r.round === 'R32')
    .map((r) => r.kickoff);
  const lockTime = computeLockTime(r32Kickoffs);

  return { slots, lockTimeIso: lockTime ? lockTime.toISOString() : null };
}
