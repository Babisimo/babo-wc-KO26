import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { TEAMS } from '@/lib/teams';
import { getOfficialBracket, getLockState } from '@/app/actions/bracket';
import LockControl from './LockControl';
import R32SkeletonForm from './R32SkeletonForm';
import ResultsPanel from './ResultsPanel';
import RefreshResultsButton from './RefreshResultsButton';

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
  const lockState = await getLockState();
  const entry = ((await db.poolConfig.findUnique({ where: { id: 'default' } }))?.entryCents ?? 5000) / 100;

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 22 }}>
        <p className="eyebrow">Setup</p>
        <h1>Official Bracket</h1>
        <p className="lead">Set the Round-of-32 draw and kickoffs, then record results (or pull them from the feed).</p>
      </header>

      <section className="panel reveal" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Bracket lock</h2>
        <LockControl {...lockState} />
      </section>

      <section className="panel reveal" style={{ marginBottom: 18 }}>
        <RefreshResultsButton />
      </section>

      <section className="panel reveal reveal-2">
        <details className="adm-collapse">
          <summary className="panel-head adm-collapse-summary">
            <h2 style={{ margin: 0 }}>Round-of-32 matchups</h2>
            <span className="adm-collapse-chev" aria-hidden>▸</span>
          </summary>
          <div style={{ marginTop: 14 }}>
            <R32SkeletonForm teams={TEAMS} initial={initial} />
          </div>
        </details>
      </section>

      <section className="panel reveal reveal-3" style={{ marginTop: 18 }}>
        <details className="adm-collapse">
          <summary className="panel-head adm-collapse-summary">
            <h2 style={{ margin: 0 }}>Results &amp; pot</h2>
            <span className="adm-collapse-chev" aria-hidden>▸</span>
          </summary>
          <div style={{ marginTop: 14 }}>
            <p className="banner warn" style={{ marginBottom: 14 }}>
              Manual override — only use this when games aren&apos;t updating automatically. For normal
              updates use <strong>Refresh results</strong> at the top of the page.
            </p>
            <ResultsPanel
              slots={slots.map((s) => ({ slot: s.slot, round: s.round, teamA: s.teamA, teamB: s.teamB, winner: s.winner }))}
              entryDollars={entry}
            />
          </div>
        </details>
      </section>
    </main>
  );
}
