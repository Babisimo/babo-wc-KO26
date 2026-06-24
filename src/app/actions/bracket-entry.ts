'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots, officialR32IsSet } from '@/lib/official-r32';
import { validateSubmission } from '@/lib/bracket-validate';
import { isLocked } from '@/lib/lock';
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import type { Picks } from '@/lib/bracket-picks';

export type BracketView = {
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

/** Coerce a stored JSON picks blob into a numeric-keyed Picks map. */
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

export async function getMyBracket(): Promise<{ error?: string; view?: BracketView }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };

  const official = await getOfficialBracket();
  const officialReady = officialR32IsSet(officialR32FromSlots(official.slots));
  const locked = isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null);

  const row = await db.bracket.findUnique({ where: { userId } });

  return {
    view: {
      picks: coercePicks(row?.picks),
      submittedAt: row?.submittedAt ? row.submittedAt.toISOString() : null,
      lockTimeIso: official.lockTimeIso,
      locked,
      officialReady,
    },
  };
}

export async function saveBracket(picks: Picks): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };

  const official = await getOfficialBracket();
  const locked = isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null);
  if (locked) return { error: 'Brackets are locked — no more edits.' };

  const officialR32 = officialR32FromSlots(official.slots);
  const check = validateSubmission(officialR32, picks);
  if (!check.ok) return { error: check.error };

  // Persist only the canonical slots 1..31 (validation guarantees each is present & legal).
  const normalized: Picks = {};
  for (let s = 1; s <= TOTAL_SLOTS; s++) normalized[s] = picks[s];

  await db.bracket.upsert({
    where: { userId },
    update: { picks: normalized, submittedAt: new Date() },
    create: { userId, picks: normalized, submittedAt: new Date() },
  });
  revalidatePath('/bracket');
  return {};
}
