'use server';

import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { currentWinners } from '@/app/actions/results';
import { isLocked } from '@/lib/lock';
import { coercePicks } from '@/lib/picks-json';
import type { Picks } from '@/lib/bracket-picks';
import type { OfficialWinners } from '@/lib/scoring';

export type CompareBracket = { id: string; label: string; picks: Picks };
export type CompareData = {
  locked: boolean;
  winners: OfficialWinners;
  brackets: CompareBracket[];
};

/**
 * Every bracket's picks for head-to-head comparison. Gated on lock — picks stay
 * private until brackets lock (mirrors the browse page).
 */
export async function getCompareData(): Promise<CompareData> {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) return { locked: false, winners: {}, brackets: [] };

  const official = await getOfficialBracket();
  const locked = isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null);
  if (!locked) return { locked: false, winners: {}, brackets: [] };

  const [rows, winners] = await Promise.all([
    db.bracket.findMany({ where: { official: true }, select: { id: true, name: true, userId: true, picks: true } }),
    currentWinners(),
  ]);
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, username: true, firstName: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const brackets = rows.map((r) => {
    const u = byId.get(r.userId);
    const handle = u?.username ?? u?.name ?? 'Unknown';
    const who = u?.firstName ? `${handle} (${u.firstName})` : handle;
    return { id: r.id, label: `${who} — ${r.name}`, picks: coercePicks(r.picks) };
  });
  brackets.sort((a, b) => a.label.localeCompare(b.label));

  return { locked: true, winners, brackets };
}
