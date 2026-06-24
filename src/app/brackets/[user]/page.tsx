import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getUserBracketView } from '@/app/actions/browse';
import BracketTree from '@/app/_components/BracketTree';

export const dynamic = 'force-dynamic';

export default async function UserBracketPage({ params }: { params: Promise<{ user: string }> }) {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const { user } = await params;
  const view = await getUserBracketView(decodeURIComponent(user));

  if (!view.name) {
    return (
      <main className="shell">
        <h1>Bracket</h1>
        <p className="muted">No such player.</p>
      </main>
    );
  }

  if (!view.visible) {
    return (
      <main className="shell">
        <h1>{view.name}</h1>
        <div className="panel">
          <p className="muted">This bracket is private until brackets lock (one hour before the first Round-of-32 kickoff).</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1>{view.name}</h1>
        <span className="pill">{view.total} pts{view.isOwner ? ' · your bracket' : ''}</span>
      </div>
      <BracketTree slots={view.slots} />
    </main>
  );
}
