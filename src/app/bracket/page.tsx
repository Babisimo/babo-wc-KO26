import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { listMyBrackets } from '@/app/actions/bracket-entry';
import MyBrackets from './MyBrackets';
import { NotOpen, ListHeader } from './BracketHeader';

export const dynamic = 'force-dynamic';

export default async function BracketPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const res = await listMyBrackets();
  const lock = res.lock;

  if (!lock || !lock.officialReady) {
    return <NotOpen />;
  }

  return (
    <main className="shell">
      <ListHeader locked={lock.locked} />
      <MyBrackets brackets={res.brackets ?? []} locked={lock.locked} credits={res.credits ?? 0} used={res.used ?? 0} />
    </main>
  );
}
