import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { getNextGames } from '@/app/actions/next-games';
import { myStanding } from '@/lib/standing';
import HomeContent from './HomeContent';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id ?? null;
  const [board, nextGames] = await Promise.all([getLeaderboard(), getNextGames()]);

  let standing: { rank: number; total: number } | null = null;
  if (userId && board.stage.started) {
    const myKeys = (await db.bracket.findMany({ where: { userId, official: true }, select: { id: true } })).map((b) => b.id);
    standing = myStanding(board.entries, myKeys);
  }

  return (
    <HomeContent
      signedIn={!!userId}
      board={board}
      nextGames={nextGames}
      standing={standing}
    />
  );
}
