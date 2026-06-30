'use server';

import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import { isLocked } from '@/lib/lock';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';
import { eliminations } from '@/lib/eliminations';
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

function displayName(u: { name: string | null; username: string | null; firstName: string | null }): string {
  const handle = u.username ?? u.name ?? 'Unknown';
  return u.firstName ? `${handle} (${u.firstName})` : handle;
}

export async function getBracketsIndex(): Promise<BracketsIndex> {
  const { locked } = await lockedNow();

  // Before lock, reveal who's in and how many brackets each holds (= their credits), so the
  // roster lines up with the header pill. Picks/scores stay hidden until lock.
  if (!locked) {
    const users = await db.user.findMany({
      where: { credits: { gt: 0 } },
      select: { name: true, username: true, firstName: true, credits: true },
    });
    const entries = users
      .filter((u) => u.username)
      .map((u) => ({ username: u.username as string, name: displayName(u), total: 0, count: u.credits }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { locked: false, entries };
  }

  // After lock, the board is the official brackets, grouped by user: best score + how many.
  const [brackets, winners] = await Promise.all([
    db.bracket.findMany({ where: { official: true }, select: { userId: true, picks: true } }),
    currentWinners(),
  ]);
  const users = await db.user.findMany({
    where: { id: { in: brackets.map((b) => b.userId) } },
    select: { id: true, name: true, username: true, firstName: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const perUser = new Map<string, { username: string; name: string; total: number; count: number }>();
  for (const b of brackets) {
    const u = byId.get(b.userId);
    if (!u || !u.username) continue;
    const username = u.username;
    const total = scoreBracket(coercePicks(b.picks), winners);
    const cur = perUser.get(b.userId);
    if (!cur) {
      perUser.set(b.userId, { username, name: displayName(u), total, count: 1 });
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
  dates: Record<number, string | null>;
  eliminatedBy: Record<string, string>;
  brackets: { id: string; name: string; total: number; slots: SlotView[] }[];
};

export async function getUserBracketView(username: string): Promise<UserBracketView> {
  const session = (await auth()) as AppSession | null;
  const viewerId = session?.user?.id ?? null;
  const { locked } = await lockedNow();

  const target = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: { id: true, name: true, username: true, firstName: true },
  });
  if (!target) {
    return { visible: false, locked, isOwner: false, name: null, dates: {}, eliminatedBy: {}, brackets: [] };
  }

  const isOwner = viewerId === target.id;
  if (!canViewUserBracket({ isOwner, locked })) {
    return { visible: false, locked, isOwner, name: target.username ?? target.name, dates: {}, eliminatedBy: {}, brackets: [] };
  }

  const [rows, winners, official] = await Promise.all([
    db.bracket.findMany({
      where: { userId: target.id, official: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, picks: true },
    }),
    currentWinners(),
    getOfficialBracket(),
  ]);
  const officialR32 = officialR32FromSlots(official.slots);

  const targetHandle = target.username ?? target.name;
  const targetDisplay = target.firstName ? `${targetHandle} (${target.firstName})` : targetHandle;

  const dates: Record<number, string | null> = {};
  for (const s of official.slots) dates[s.slot] = s.kickoff;
  const eliminatedBy = eliminations(officialR32, winners);

  return {
    visible: true,
    locked,
    isOwner,
    name: targetDisplay,
    dates,
    eliminatedBy,
    brackets: rows.map((r) => {
      const picks = coercePicks(r.picks);
      return { id: r.id, name: r.name, total: scoreBracket(picks, winners), slots: buildBracketView(officialR32, picks, winners) };
    }),
  };
}
