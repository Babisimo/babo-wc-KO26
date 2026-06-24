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
  entries: { username: string; name: string; total: number }[];
};

export async function getBracketsIndex(): Promise<BracketsIndex> {
  const { locked } = await lockedNow();
  if (!locked) return { locked: false, entries: [] };

  const [brackets, winners] = await Promise.all([
    db.bracket.findMany({ select: { userId: true, picks: true } }),
    currentWinners(),
  ]);
  const users = await db.user.findMany({
    where: { id: { in: brackets.map((b) => b.userId) } },
    select: { id: true, name: true, username: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const entries = brackets
    .map((b) => {
      const u = byId.get(b.userId);
      return {
        username: u?.username ?? '',
        name: u?.username ?? u?.name ?? 'Unknown',
        total: scoreBracket(coercePicks(b.picks), winners),
      };
    })
    .filter((e) => e.username !== '')
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return { locked: true, entries };
}

export type UserBracketView = {
  visible: boolean;
  locked: boolean;
  isOwner: boolean;
  name: string | null;
  total: number;
  slots: SlotView[];
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
    return { visible: false, locked, isOwner: false, name: null, total: 0, slots: [] };
  }

  const isOwner = viewerId === target.id;
  if (!canViewUserBracket({ isOwner, locked })) {
    return { visible: false, locked, isOwner, name: target.username ?? target.name, total: 0, slots: [] };
  }

  const [bracket, winners, official] = await Promise.all([
    db.bracket.findFirst({ where: { userId: target.id }, select: { picks: true } }),
    currentWinners(),
    getOfficialBracket(),
  ]);
  const picks = coercePicks(bracket?.picks);
  const officialR32 = officialR32FromSlots(official.slots);

  return {
    visible: true,
    locked,
    isOwner,
    name: target.username ?? target.name,
    total: scoreBracket(picks, winners),
    slots: buildBracketView(officialR32, picks, winners),
  };
}
