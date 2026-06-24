import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getUserBracketView } from '@/app/actions/browse';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';

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
      <h1>{view.name}</h1>
      {view.brackets.length === 0 ? (
        <p className="muted">No approved brackets.</p>
      ) : (
        view.brackets.map((b) => (
          <section key={b.id} className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <h2>{b.name}</h2>
              <span className="pill">{b.total} pts{view.isOwner ? ' · yours' : ''}</span>
            </div>
            <MarchMadnessBracket slots={b.slots} />
          </section>
        ))
      )}
    </main>
  );
}
