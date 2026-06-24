import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import BracketTree from '@/app/_components/BracketTree';
import type { SlotView } from '@/lib/bracket-view';

export const dynamic = 'force-dynamic';

export default async function OfficialPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const { slots } = await getOfficialBracket();
  const decided = slots.filter((s) => s.winner).length;

  const view: SlotView[] = slots.map((s) => ({
    slot: s.slot,
    round: s.round,
    teamA: s.teamA,
    teamB: s.teamB,
    pick: null,
    officialWinner: s.winner,
    status: s.winner ? 'correct' : 'pending',
  }));

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 22 }}>
        <p className="eyebrow">The real thing</p>
        <h1>Official Bracket</h1>
        <p className="lead">
          The actual Round-of-32 draw and results as they come in. Teams that advance are marked in gold.
        </p>
      </header>

      <section className="panel reveal reveal-2">
        {slots.length === 0 ? (
          <p className="muted">
            The bracket isn&apos;t set yet — check back once the Round-of-32 matchups are in.
          </p>
        ) : (
          <>
            <div className="panel-head">
              <h2>Knockout tree</h2>
              <span className="pill">{decided} / {slots.length} decided</span>
            </div>
            <BracketTree slots={view} />
          </>
        )}
      </section>
    </main>
  );
}
