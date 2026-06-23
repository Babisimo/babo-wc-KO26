import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { approveUser, rejectUser, setAdmin, removeUser } from '@/app/actions/admin';
import { ActionButton } from './UserRow';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) redirect('/');

  const pending = await db.user.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  const all = await db.user.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: 16 }}>
      <h1>Admin</h1>

      <section>
        <h2>Pending approval ({pending.length})</h2>
        {pending.length === 0 && <p>No one waiting.</p>}
        <ul>
          {pending.map((u) => (
            <li key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{u.email} (@{u.username})</span>
              <ActionButton label="Approve" action={approveUser.bind(null, u.id)} />
              <ActionButton label="Reject" action={rejectUser.bind(null, u.id)} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>All users ({all.length})</h2>
        <ul>
          {all.map((u) => (
            <li key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>
                {u.email} — {u.status} {u.isAdmin ? '· admin' : ''}
              </span>
              <ActionButton
                label={u.isAdmin ? 'Remove admin' : 'Make admin'}
                action={setAdmin.bind(null, u.id, !u.isAdmin)}
              />
              <ActionButton label="Remove" action={removeUser.bind(null, u.id)} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
