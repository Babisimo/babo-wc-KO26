import { redirect, notFound } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getBracket } from '@/app/actions/bracket-entry';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import BracketFill from '../BracketFill';

export const dynamic = 'force-dynamic';

export default async function EditBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const [{ view, error }, official] = await Promise.all([getBracket(id), getOfficialBracket()]);
  if (error || !view) notFound();

  const officialR32 = officialR32FromSlots(official.slots);

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Your picks · {view.name}</p>
        <h1>{view.name}</h1>
        <p className="lead">
          Click a team to advance it through every round to the Final.
          {view.locked && ' Brackets are locked.'}
        </p>
      </header>
      <div className="panel reveal reveal-2" style={{ padding: 14 }}>
        <BracketFill bracketId={view.id} officialR32={officialR32} initialPicks={view.picks} locked={view.locked} />
      </div>
    </main>
  );
}
