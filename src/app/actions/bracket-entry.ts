'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getProjectedR32 } from '@/app/actions/projection';
import { officialR32FromSlots, officialR32IsSet } from '@/lib/official-r32';
import { mergeEffectiveR32 } from '@/lib/effective-r32';
import { stalePicks } from '@/lib/bracket-changes';
import { validateDraft, validateSubmission } from '@/lib/bracket-validate';
import { isLocked } from '@/lib/lock';
import { normalizeBracketName } from '@/lib/bracket-name';
import { canMarkOfficial } from '@/lib/bracket-credits';
import type { OfficialR32, Picks } from '@/lib/bracket-picks';
import type { StringKey } from '@/lib/i18n';

export type MyBracketRow = {
  id: string;
  name: string;
  official: boolean;
  complete: boolean;
  staleCount: number;
  submittedAt: string | null;
};
export type LockInfo = { locked: boolean; lockTimeIso: string | null; drawFinal: boolean };
export type BracketView = {
  id: string;
  name: string;
  picks: Picks;
  official: boolean;
  effectiveR32: OfficialR32;
  confirmedR32: Record<number, boolean>;
  staleSlots: number[];
  submittedAt: string | null;
  lockTimeIso: string | null;
  locked: boolean;
  drawFinal: boolean;
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

/**
 * The R32 a user actually fills against: the official draw where set, otherwise the live
 * as-it-stands projection, so brackets can be started before the draw is final. `drawFinal`
 * is true once the official R32 is fully set (all 16 slots), which is also what scoring needs.
 */
async function getEffectiveR32(): Promise<{ r32: OfficialR32; confirmed: Record<number, boolean>; drawFinal: boolean; lockTimeIso: string | null }> {
  const [official, projection] = await Promise.all([getOfficialBracket(), getProjectedR32()]);
  const officialR32 = officialR32FromSlots(official.slots);
  const { r32, confirmed } = mergeEffectiveR32(officialR32, projection.projected, projection.confirmed);
  return {
    r32,
    confirmed,
    drawFinal: officialR32IsSet(officialR32),
    lockTimeIso: official.lockTimeIso,
  };
}

function lockedNow(lockTimeIso: string | null): boolean {
  return isLocked(new Date(), lockTimeIso ? new Date(lockTimeIso) : null);
}

async function lockInfo(): Promise<LockInfo> {
  const eff = await getEffectiveR32();
  return { locked: lockedNow(eff.lockTimeIso), lockTimeIso: eff.lockTimeIso, drawFinal: eff.drawFinal };
}

// A few players may be granted a late pass (User.bypassLock) so they can still enter/edit after
// the global lock; everyone else stays frozen. Targeted via the admin-set flag, not hard-coded.
async function userBypassesLock(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { bypassLock: true } });
  return user?.bypassLock ?? false;
}

export async function listMyBrackets(): Promise<{ error?: string; brackets?: MyBracketRow[]; lock?: LockInfo; credits?: number; officialUsed?: number }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const eff = await getEffectiveR32();
  const lock: LockInfo = { locked: lockedNow(eff.lockTimeIso), lockTimeIso: eff.lockTimeIso, drawFinal: eff.drawFinal };
  const [rows, user] = await Promise.all([
    db.bracket.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, official: true, picks: true, submittedAt: true } }),
    db.user.findUnique({ where: { id: userId }, select: { credits: true } }),
  ]);
  const brackets: MyBracketRow[] = rows.map((r) => {
    const picks = coercePicks(r.picks);
    return {
      id: r.id,
      name: r.name,
      official: r.official,
      complete: validateSubmission(eff.r32, picks).ok,
      staleCount: stalePicks(eff.r32, picks).length,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    };
  });
  return {
    brackets,
    lock,
    credits: user?.credits ?? 0,
    officialUsed: rows.filter((r) => r.official).length,
  };
}

export async function createBracket(name: string): Promise<{ errorKey?: StringKey; id?: string }> {
  const userId = await requireUserId();
  if (!userId) return { errorKey: 'bracket.err.notSignedIn' };

  // Drafts are free and unlimited — even after lock. Players can keep building brackets; they
  // just can't enter one (mark it official) once locked. No credit is spent here. A credit is
  // only committed when the user designates a bracket official (setBracketOfficial).
  const used = await db.bracket.count({ where: { userId } });
  const cleanName = normalizeBracketName(name, used + 1);
  const created = await db.bracket.create({ data: { userId, name: cleanName, picks: {} }, select: { id: true } });
  revalidatePath('/bracket');
  return { id: created.id };
}

export async function renameBracket(id: string, name: string): Promise<{ errorKey?: StringKey; name?: string }> {
  const userId = await requireUserId();
  if (!userId) return { errorKey: 'bracket.err.notSignedIn' };
  const row = await db.bracket.findUnique({ where: { id }, select: { userId: true, official: true } });
  if (!row || row.userId !== userId) return { errorKey: 'bracket.err.notFound' };

  // Official brackets freeze (name included) at lock; drafts can always be renamed.
  if (row.official) {
    const lock = await lockInfo();
    if (lock.locked && !(await userBypassesLock(userId))) return { errorKey: 'bracket.err.lockedRename' };
  }

  // Blank/invalid input falls back to "Bracket {n}", mirroring create.
  const used = await db.bracket.count({ where: { userId } });
  const cleanName = normalizeBracketName(name, used);
  await db.bracket.update({ where: { id }, data: { name: cleanName } });
  revalidatePath('/bracket');
  revalidatePath(`/bracket/${id}`);
  return { name: cleanName };
}

export async function setBracketOfficial(id: string, official: boolean): Promise<{ errorKey?: StringKey }> {
  const userId = await requireUserId();
  if (!userId) return { errorKey: 'bracket.err.notSignedIn' };
  const row = await db.bracket.findUnique({ where: { id }, select: { userId: true } });
  if (!row || row.userId !== userId) return { errorKey: 'bracket.err.notFound' };

  const lock = await lockInfo();
  if (lock.locked && !(await userBypassesLock(userId))) return { errorKey: 'bracket.err.lockedOfficial' };

  if (official) {
    const [otherOfficial, user] = await Promise.all([
      db.bracket.count({ where: { userId, official: true, NOT: { id } } }),
      db.user.findUnique({ where: { id: userId }, select: { credits: true } }),
    ]);
    if (!canMarkOfficial(otherOfficial, user?.credits ?? 0)) {
      return { errorKey: 'bracket.official.atCap' };
    }
  }

  await db.bracket.update({ where: { id }, data: { official } });
  revalidatePath('/bracket');
  return {};
}

export async function getBracket(id: string): Promise<{ error?: string; view?: BracketView }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const row = await db.bracket.findUnique({ where: { id } });
  if (!row || row.userId !== userId) return { error: 'Bracket not found.' };
  const eff = await getEffectiveR32();
  const picks = coercePicks(row.picks);
  return {
    view: {
      id: row.id,
      name: row.name,
      picks,
      official: row.official,
      effectiveR32: eff.r32,
      confirmedR32: eff.confirmed,
      staleSlots: stalePicks(eff.r32, picks),
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      lockTimeIso: eff.lockTimeIso,
      // Drafts stay editable after lock; only official (entered) brackets freeze.
      locked: lockedNow(eff.lockTimeIso) && row.official,
      drawFinal: eff.drawFinal,
    },
  };
}

export async function saveBracket(id: string, picks: Picks): Promise<{ errorKey?: StringKey }> {
  const userId = await requireUserId();
  if (!userId) return { errorKey: 'bracket.err.notSignedIn' };
  const row = await db.bracket.findUnique({ where: { id }, select: { userId: true, official: true } });
  if (!row || row.userId !== userId) return { errorKey: 'bracket.err.notFound' };

  const eff = await getEffectiveR32();
  // Official (entered) brackets freeze at lock for scoring integrity; drafts stay editable.
  if (row.official && lockedNow(eff.lockTimeIso) && !(await userBypassesLock(userId))) return { errorKey: 'bracket.err.lockedEdit' };

  // Drafts may be incomplete; only the picks that are present must be valid contestants.
  const check = validateDraft(eff.r32, picks);
  if (!check.ok) return { errorKey: 'bracket.err.invalid' };

  // Store only the picks actually made (sparse) so unfilled slots stay open.
  const clean: Picks = {};
  for (const [k, v] of Object.entries(picks)) {
    if (typeof v === 'string' && v) clean[Number(k)] = v;
  }

  await db.bracket.update({ where: { id }, data: { picks: clean, submittedAt: new Date() } });
  revalidatePath('/bracket');
  return {};
}
