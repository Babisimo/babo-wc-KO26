import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { TEAMS } from '@/lib/teams';
import { getOfficialBracket } from '@/app/actions/bracket';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';
import type { SlotView } from '@/lib/bracket-view';
import R32SkeletonForm from './R32SkeletonForm';
import ResultsPanel from './ResultsPanel';

export const dynamic = 'force-dynamic';

export default async function AdminBracketPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) redirect('/');

  const r32 = await db.match.findMany({ where: { round: 'R32' }, orderBy: { slot: 'asc' } });
  const initial = Array.from({ length: 16 }, (_, i) => {
    const row = r32.find((m) => m.slot === i + 1);
    return {
      teamA: row?.teamA ?? '',
      teamB: row?.teamB ?? '',
      kickoffIso: row?.kickoff ? row.kickoff.toISOString() : '',
    };
  });

  const { slots } = await getOfficialBracket();
  const entry = ((await db.poolConfig.findUnique({ where: { id: 'default' } }))?.entryCents ?? 5000) / 100;

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
        <p className="eyebrow">Setup</p>
        <h1>Official Bracket</h1>
        <p className="lead">Set the Round-of-32 draw and kickoffs, then record results (or pull them from the feed).</p>
      </header>

      <section className="panel reveal reveal-2">
        <h2 style={{ marginBottom: 14 }}>Round-of-32 matchups</h2>
        <R32SkeletonForm teams={TEAMS} initial={initial} />
      </section>

      <section className="panel reveal reveal-3" style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 14 }}>Results &amp; pot</h2>
        <ResultsPanel
          slots={slots.map((s) => ({ slot: s.slot, round: s.round, teamA: s.teamA, teamB: s.teamB, winner: s.winner }))}
          entryDollars={entry}
        />
      </section>

      <section className="panel reveal reveal-3" style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 14 }}>Bracket preview</h2>
        {slots.length === 0 ? (
          <p className="muted">No bracket yet — set the Round-of-32 matchups above.</p>
        ) : (
          <MarchMadnessBracket slots={view} />
        )}
      </section>
    </main>
  );
}
