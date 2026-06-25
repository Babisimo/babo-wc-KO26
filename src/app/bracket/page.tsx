import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { listMyBrackets } from '@/app/actions/bracket-entry';
import MyBrackets from './MyBrackets';
import { ListHeader } from './BracketHeader';

export const dynamic = 'force-dynamic';

export default async function BracketPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const res = await listMyBrackets();
  const locked = res.lock?.locked ?? false;
  const drawFinal = res.lock?.drawFinal ?? false;

  return (
    <main className="shell">
      <ListHeader locked={locked} />
      <MyBrackets
        brackets={res.brackets ?? []}
        locked={locked}
        drawFinal={drawFinal}
        credits={res.credits ?? 0}
        officialUsed={res.officialUsed ?? 0}
      />
    </main>
  );
}
