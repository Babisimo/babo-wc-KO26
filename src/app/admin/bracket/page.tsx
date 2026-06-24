import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { TEAMS } from '@/lib/teams';
import { getOfficialBracket } from '@/app/actions/bracket';
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

  return (
    <main style={{ maxWidth: 860, margin: '24px auto', padding: 16 }}>
      <h1>Official bracket</h1>
      <section>
        <h2>Set Round-of-32 matchups</h2>
        <R32SkeletonForm teams={TEAMS} initial={initial} />
      </section>
      <section>
        <h2>Derived bracket</h2>
        {slots.length === 0 ? (
          <p>No bracket yet — set the R32 matchups above.</p>
        ) : (
          <ul>
            {slots.map((s) => (
              <li key={s.slot}>
                [{s.round} #{s.slot}] {s.teamA ?? '?'} vs {s.teamB ?? '?'}
                {s.winner ? ` → ${s.winner}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
      <ResultsPanel
        slots={slots.map((s) => ({
          slot: s.slot,
          round: s.round,
          teamA: s.teamA,
          teamB: s.teamB,
          winner: s.winner,
        }))}
        potDollars={((await db.poolConfig.findUnique({ where: { id: 'default' } }))?.potCents ?? 0) / 100}
      />
    </main>
  );
}
