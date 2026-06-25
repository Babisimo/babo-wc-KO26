import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getCompareData } from '@/app/actions/compare';
import CompareView from './CompareView';

export const dynamic = 'force-dynamic';

export default async function ComparePage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const data = await getCompareData();
  return (
    <main className="shell">
      <CompareView data={data} />
    </main>
  );
}
