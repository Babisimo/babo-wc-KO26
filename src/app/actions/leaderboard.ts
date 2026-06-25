'use server';

import { db } from '@/lib/db';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { rankEntries, potSplit, type RankedEntry } from '@/lib/leaderboard-rank';
import { computeStage, type Stage } from '@/lib/tournament-stage';
import type { Picks } from '@/lib/bracket-picks';

export type LeaderboardData = {
  entries: RankedEntry[];
  potCents: number;
  entryCents: number;
  players: number;
  winnerKeys: string[];
  shareCents: number;
  stage: Stage;
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
    db.bracket.findMany({
      where: { official: true }, // only designated, paid entries count in the pool
      select: { id: true, userId: true, name: true, picks: true },
    }),
    currentWinners(),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);

  const userIds = brackets.map((b) => b.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, username: true, firstName: true },
  });
  const userById = new Map(users.map((u) => {
    const handle = u.username ?? u.name;
    return [u.id, { display: u.firstName ? `${handle} (${u.firstName})` : handle, username: u.username }];
  }));

  // One leaderboard row per bracket, keyed by bracket id.
  const scored = brackets.map((b) => {
    const u = userById.get(b.userId);
    return {
      key: b.id,
      name: `${u?.display ?? 'Unknown'} — ${b.name}`,
      username: u?.username ?? null,
      total: scoreBracket(coercePicks(b.picks), winners),
    };
  });

  const entries = rankEntries(scored);
  const entryCents = config?.entryCents ?? 5000;
  const players = brackets.length; // all brackets = paid entries
  const potCents = entryCents * players;
  const { winners: winEntries, shareCents } = potSplit(entries, potCents);

  return {
    entries,
    potCents,
    entryCents,
    players,
    winnerKeys: winEntries.map((w) => w.key),
    shareCents,
    stage: computeStage(winners),
  };
}
