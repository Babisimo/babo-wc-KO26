import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { getNextGames } from '@/app/actions/next-games';
import { myStanding, movement } from '@/lib/standing';
import { isLocked } from '@/lib/lock';
import HomeContent from './HomeContent';
import type { ResultEventView } from '@/app/_components/WhatHappened';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id ?? null;
  const [board, nextGames] = await Promise.all([getLeaderboard(), getNextGames()]);

  let standing: { rank: number; total: number } | null = null;
  let move: { dir: 'up' | 'down' | 'same' | 'none'; places: number } = { dir: 'none', places: 0 };
  if (userId && board.stage.started) {
    const myBrackets = await db.bracket.findMany({ where: { userId, official: true }, select: { id: true, previousRank: true } });
    const myKeys = myBrackets.map((b) => b.id);
    standing = myStanding(board.entries, myKeys);
    if (standing) {
      const topKey = board.entries.filter((e) => myKeys.includes(e.key)).reduce((a, b) => (b.rank < a.rank ? b : a)).key;
      const prev = myBrackets.find((b) => b.id === topKey)?.previousRank ?? null;
      move = movement(prev, standing.rank);
    }
  }

  const latest = await db.resultEvent.findFirst({ orderBy: { createdAt: 'desc' } });
  const event: ResultEventView | null = latest
    ? { winner: latest.winner, loser: latest.loser, bustedCount: latest.bustedCount, newLeader: latest.newLeader }
    : null;

  const locked = isLocked(new Date(), nextGames.lockTimeIso ? new Date(nextGames.lockTimeIso) : null);

  return (
    <HomeContent
      signedIn={!!userId}
      board={board}
      nextGames={nextGames}
      standing={standing}
      move={move}
      event={event}
      locked={locked}
    />
  );
}
