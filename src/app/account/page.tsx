import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import AccountForm from './AccountForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, usernameChangeCount: true },
  });
  if (!me) redirect('/login');

  return <AccountForm username={me.username} usernameChangeCount={me.usernameChangeCount} />;
}
