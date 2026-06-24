import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getMyBracket } from '@/app/actions/bracket-entry';
import { officialR32FromSlots } from '@/lib/official-r32';
import BracketFill from './BracketFill';

export const dynamic = 'force-dynamic';

export default async function BracketPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const [official, mine] = await Promise.all([getOfficialBracket(), getMyBracket()]);
  const view = mine.view;

  if (!view || !view.officialReady) {
    return (
      <main className="shell">
        <p className="eyebrow">Your picks</p>
        <h1>Your bracket</h1>
        <div className="panel" style={{ marginTop: 16 }}>
          <p className="muted">
            The bracket isn&apos;t open yet — the Round-of-32 matchups haven&apos;t been set. Check back soon.
          </p>
        </div>
      </main>
    );
  }

  const officialR32 = officialR32FromSlots(official.slots);

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Your picks</p>
        <h1>Your bracket</h1>
        <p className="lead">
          Click a team to advance it through every round to the Final.
          {view.submittedAt && !view.locked && ' Saved — keep editing until lock.'}
          {view.locked && ' Brackets are locked.'}
        </p>
      </header>
      <div className="panel reveal reveal-2" style={{ padding: 14 }}>
        <BracketFill officialR32={officialR32} initialPicks={view.picks} locked={view.locked} />
      </div>
    </main>
  );
}
