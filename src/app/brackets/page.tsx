import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getBracketsIndex } from '@/app/actions/browse';
import { BrowseTitle, IndexBody } from './BrowseText';

export const dynamic = 'force-dynamic';

export default async function BracketsPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const index = await getBracketsIndex();

  return (
    <main className="shell">
      <BrowseTitle />
      <IndexBody index={index} />
    </main>
  );
}
