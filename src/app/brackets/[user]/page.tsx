import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getUserBracketView } from '@/app/actions/browse';
import { BrowseTitle, NoSuch, PrivateOne, UserBody } from '../BrowseText';

export const dynamic = 'force-dynamic';

export default async function UserBracketPage({ params }: { params: Promise<{ user: string }> }) {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const { user } = await params;
  const view = await getUserBracketView(decodeURIComponent(user));

  if (!view.name) {
    return (
      <main className="shell">
        <BrowseTitle />
        <NoSuch />
      </main>
    );
  }

  if (!view.visible) {
    return (
      <main className="shell">
        <h1>{view.name}</h1>
        <PrivateOne />
      </main>
    );
  }

  return (
    <main className="shell">
      <h1>{view.name}</h1>
      <UserBody view={view} />
    </main>
  );
}
