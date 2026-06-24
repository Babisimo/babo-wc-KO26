import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { formatLockTimePT } from '@/lib/lock';
import Countdown from '@/app/_components/Countdown';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  const { lockTimeIso } = await getOfficialBracket();
  const lockLabel = lockTimeIso ? formatLockTimePT(new Date(lockTimeIso)) : null;

  return (
    <main style={{ padding: 24 }}>
      <h1>WC26 Knockout Bracket</h1>
      {session?.user ? (
        <p>Welcome, {session.user.name}.</p>
      ) : (
        <p>Request an account to join the pool.</p>
      )}
      <Countdown lockTimeIso={lockTimeIso} lockLabel={lockLabel} />
    </main>
  );
}
