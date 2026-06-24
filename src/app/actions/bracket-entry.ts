'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots, officialR32IsSet } from '@/lib/official-r32';
import { validateSubmission } from '@/lib/bracket-validate';
import { isLocked } from '@/lib/lock';
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { normalizeBracketName, statusForNewBracket } from '@/lib/bracket-name';
import type { Picks } from '@/lib/bracket-picks';

export type BracketStatusStr = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MyBracketRow = { id: string; name: string; status: BracketStatusStr; submittedAt: string | null };
export type LockInfo = { locked: boolean; lockTimeIso: string | null; officialReady: boolean };
export type BracketView = {
  id: string;
  name: string;
  status: BracketStatusStr;
  picks: Picks;
  submittedAt: string | null;
  lockTimeIso: string | null;
  locked: boolean;
  officialReady: boolean;
};

async function requireUserId(): Promise<string | null> {
  const session = (await auth()) as AppSession | null;
  return session?.user?.id ?? null;
}

function coercePicks(raw: unknown): Picks {
  const out: Picks = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const slot = Number(k);
      if (Number.isInteger(slot) && typeof v === 'string') out[slot] = v;
    }
  }
  return out;
}

async function lockInfo(): Promise<LockInfo> {
  const official = await getOfficialBracket();
  return {
    locked: isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null),
    lockTimeIso: official.lockTimeIso,
    officialReady: officialR32IsSet(officialR32FromSlots(official.slots)),
  };
}

export async function listMyBrackets(): Promise<{ error?: string; brackets?: MyBracketRow[]; lock?: LockInfo }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const lock = await lockInfo();
  const rows = await db.bracket.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, status: true, submittedAt: true },
  });
  return {
    brackets: rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status as BracketStatusStr,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    })),
    lock,
  };
}

export async function createBracket(name: string): Promise<{ error?: string; id?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const lock = await lockInfo();
  if (!lock.officialReady) return { error: 'The bracket isn’t open yet.' };
  if (lock.locked) return { error: 'Brackets are locked — no new entries.' };

  const existingCount = await db.bracket.count({ where: { userId } });
  const status = statusForNewBracket(existingCount);
  const cleanName = normalizeBracketName(name, existingCount + 1);

  const created = await db.bracket.create({
    data: { userId, name: cleanName, status, picks: {} },
    select: { id: true },
  });
  revalidatePath('/bracket');
  return { id: created.id };
}

export async function getBracket(id: string): Promise<{ error?: string; view?: BracketView }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const row = await db.bracket.findUnique({ where: { id } });
  if (!row || row.userId !== userId) return { error: 'Bracket not found.' };
  const lock = await lockInfo();
  return {
    view: {
      id: row.id,
      name: row.name,
      status: row.status as BracketStatusStr,
      picks: coercePicks(row.picks),
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      lockTimeIso: lock.lockTimeIso,
      locked: lock.locked,
      officialReady: lock.officialReady,
    },
  };
}

export async function saveBracket(id: string, picks: Picks): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const row = await db.bracket.findUnique({ where: { id }, select: { userId: true } });
  if (!row || row.userId !== userId) return { error: 'Bracket not found.' };

  const official = await getOfficialBracket();
  const locked = isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null);
  if (locked) return { error: 'Brackets are locked — no more edits.' };

  const officialR32 = officialR32FromSlots(official.slots);
  const check = validateSubmission(officialR32, picks);
  if (!check.ok) return { error: check.error };

  const normalized: Picks = {};
  for (let s = 1; s <= TOTAL_SLOTS; s++) normalized[s] = picks[s];

  await db.bracket.update({ where: { id }, data: { picks: normalized, submittedAt: new Date() } });
  revalidatePath('/bracket');
  return {};
}

export async function deleteBracket(id: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const row = await db.bracket.findUnique({ where: { id }, select: { userId: true, status: true } });
  if (!row || row.userId !== userId) return { error: 'Bracket not found.' };
  if (row.status === 'APPROVED') return { error: 'Approved brackets can’t be deleted.' };
  await db.bracket.delete({ where: { id } });
  revalidatePath('/bracket');
  return {};
}
