import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { formatLockTimePT } from '@/lib/lock';
import HomeContent from './HomeContent';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  const [{ lockTimeIso }, board] = await Promise.all([getOfficialBracket(), getLeaderboard()]);
  const lockLabel = lockTimeIso ? formatLockTimePT(new Date(lockTimeIso)) : null;
  return (
    <HomeContent
      userName={session?.user?.name ?? null}
      signedIn={!!session?.user?.id}
      board={board}
      lockTimeIso={lockTimeIso}
      lockLabel={lockLabel}
    />
  );
}
