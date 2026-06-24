'use server';

import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import { isLocked } from '@/lib/lock';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';
import { canViewUserBracket } from '@/lib/bracket-visibility';
import { coercePicks } from '@/lib/picks-json';

async function lockedNow(): Promise<{ locked: boolean; lockTimeIso: string | null }> {
  const official = await getOfficialBracket();
  return {
    locked: isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null),
    lockTimeIso: official.lockTimeIso,
  };
}

export type BracketsIndex = {
  locked: boolean;
  entries: { username: string; name: string; total: number; count: number }[];
};

export async function getBracketsIndex(): Promise<BracketsIndex> {
  const { locked } = await lockedNow();
  if (!locked) return { locked: false, entries: [] };

  const [brackets, winners] = await Promise.all([
    db.bracket.findMany({ where: { status: 'APPROVED' }, select: { userId: true, picks: true } }),
    currentWinners(),
  ]);
  const users = await db.user.findMany({
    where: { id: { in: brackets.map((b) => b.userId) } },
    select: { id: true, name: true, username: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  // Group approved brackets by user: best score + how many.
  const perUser = new Map<string, { username: string; name: string; total: number; count: number }>();
  for (const b of brackets) {
    const u = byId.get(b.userId);
    const username = u?.username ?? '';
    if (!username) continue;
    const total = scoreBracket(coercePicks(b.picks), winners);
    const cur = perUser.get(b.userId);
    if (!cur) {
      perUser.set(b.userId, { username, name: u?.username ?? u?.name ?? 'Unknown', total, count: 1 });
    } else {
      cur.total = Math.max(cur.total, total);
      cur.count += 1;
    }
  }

  const entries = [...perUser.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { locked: true, entries };
}

export type UserBracketView = {
  visible: boolean;
  locked: boolean;
  isOwner: boolean;
  name: string | null;
  brackets: { id: string; name: string; total: number; slots: SlotView[] }[];
};

export async function getUserBracketView(username: string): Promise<UserBracketView> {
  const session = (await auth()) as AppSession | null;
  const viewerId = session?.user?.id ?? null;
  const { locked } = await lockedNow();

  const target = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: { id: true, name: true, username: true },
  });
  if (!target) {
    return { visible: false, locked, isOwner: false, name: null, brackets: [] };
  }

  const isOwner = viewerId === target.id;
  if (!canViewUserBracket({ isOwner, locked })) {
    return { visible: false, locked, isOwner, name: target.username ?? target.name, brackets: [] };
  }

  const [rows, winners, official] = await Promise.all([
    db.bracket.findMany({
      where: { userId: target.id, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, picks: true },
    }),
    currentWinners(),
    getOfficialBracket(),
  ]);
  const officialR32 = officialR32FromSlots(official.slots);

  return {
    visible: true,
    locked,
    isOwner,
    name: target.username ?? target.name,
    brackets: rows.map((r) => {
      const picks = coercePicks(r.picks);
      return { id: r.id, name: r.name, total: scoreBracket(picks, winners), slots: buildBracketView(officialR32, picks, winners) };
    }),
  };
}
