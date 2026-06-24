'use server';

import { db } from '@/lib/db';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { rankEntries, potSplit, type RankedEntry } from '@/lib/leaderboard-rank';
import type { Picks } from '@/lib/bracket-picks';

export type LeaderboardData = {
  entries: RankedEntry[];
  potCents: number;
  entryCents: number;
  players: number;
  winnerKeys: string[];
  shareCents: number;
};

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

export async function getLeaderboard(): Promise<LeaderboardData> {
  const [brackets, winners, config] = await Promise.all([
    db.bracket.findMany({ select: { userId: true, picks: true } }),
    currentWinners(),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);

  const userIds = brackets.map((b) => b.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, username: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.username ?? u.name]));

  const scored = brackets.map((b) => ({
    key: b.userId,
    name: nameById.get(b.userId) ?? 'Unknown',
    total: scoreBracket(coercePicks(b.picks), winners),
  }));

  const entries = rankEntries(scored);
  // Pot is the entry price times the number of players (one bracket = one paid entry).
  const entryCents = config?.entryCents ?? 5000;
  const players = brackets.length;
  const potCents = entryCents * players;
  const { winners: winEntries, shareCents } = potSplit(entries, potCents);

  return {
    entries,
    potCents,
    entryCents,
    players,
    winnerKeys: winEntries.map((w) => w.key),
    shareCents,
  };
}
