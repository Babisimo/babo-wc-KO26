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
      <main style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
        <h1>Your bracket</h1>
        <p>The bracket isn&apos;t open yet — the Round-of-32 matchups haven&apos;t been set. Check back soon.</p>
      </main>
    );
  }

  const officialR32 = officialR32FromSlots(official.slots);

  return (
    <main style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
      <h1>Your bracket</h1>
      {view.submittedAt && !view.locked && <p style={{ opacity: 0.7 }}>Saved — you can keep editing until lock.</p>}
      <BracketFill officialR32={officialR32} initialPicks={view.picks} locked={view.locked} />
    </main>
  );
}
