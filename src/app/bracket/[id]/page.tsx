import { redirect, notFound } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getBracket } from '@/app/actions/bracket-entry';
import { getOfficialBracket } from '@/app/actions/bracket';
import BracketFill from '../BracketFill';
import { EditHeader } from '../BracketHeader';

export const dynamic = 'force-dynamic';

export default async function EditBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const [{ view, error }, official] = await Promise.all([getBracket(id), getOfficialBracket()]);
  if (error || !view) notFound();

  // Kickoff dates per slot (informational only); the matchups come from the effective R32.
  const dates: Record<number, string | null> = {};
  for (const s of official.slots) dates[s.slot] = s.kickoff;

  return (
    <main className="shell">
      <EditHeader id={view.id} name={view.name} locked={view.locked} />
      <div className="panel reveal reveal-2" style={{ padding: 14 }}>
        <BracketFill
          bracketId={view.id}
          officialR32={view.effectiveR32}
          initialPicks={view.picks}
          official={view.official}
          locked={view.locked}
          dates={dates}
        />
      </div>
    </main>
  );
}
