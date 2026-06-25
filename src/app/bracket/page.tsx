import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { listMyBrackets } from '@/app/actions/bracket-entry';
import MyBrackets from './MyBrackets';

export const dynamic = 'force-dynamic';

export default async function BracketPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const res = await listMyBrackets();
  const lock = res.lock;

  if (!lock || !lock.officialReady) {
    return (
      <main className="shell">
        <p className="eyebrow">Your picks</p>
        <h1>Your brackets</h1>
        <div className="panel" style={{ marginTop: 16 }}>
          <p className="muted">The bracket isn&apos;t open yet — the Round-of-32 matchups haven&apos;t been set. Check back soon.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Your picks</p>
        <h1>Your brackets</h1>
        <p className="lead">
          Each bracket uses one credit ($50) and counts as soon as you create it. Need another? Ask the admin to add a credit.
          {lock.locked && ' Brackets are locked.'}
        </p>
      </header>
      <MyBrackets brackets={res.brackets ?? []} locked={lock.locked} credits={res.credits ?? 0} used={res.used ?? 0} />
    </main>
  );
}
