import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { approveUser, rejectUser, setAdmin, removeUser, grantCredits } from '@/app/actions/admin';
import { ActionButton } from './UserRow';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) redirect('/');

  const pending = await db.user.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  const all = await db.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, firstName: true, lastName: true, email: true, isAdmin: true, status: true, credits: true },
  });
  const admins = all.filter((u) => u.isAdmin);
  const members = all.filter((u) => !u.isAdmin);

  const memberRow = (u: (typeof all)[number]) => (
    <tr key={u.id}>
      <td data-label="Username">@{u.username}</td>
      <td data-label="First">{u.firstName}</td>
      <td data-label="Last">{u.lastName}</td>
      <td data-label="Email" className="muted" style={{ fontSize: '0.84rem' }}>{u.email}</td>
      <td data-label="Credits">
        <div className="row-actions">
          <ActionButton label="−1" action={grantCredits.bind(null, u.id, -1)} />
          <span className="pill">{u.credits}</span>
          <ActionButton label="+1" action={grantCredits.bind(null, u.id, 1)} />
        </div>
      </td>
      <td data-label="">
        <div className="row-actions">
          <ActionButton label={u.isAdmin ? 'Remove admin' : 'Make admin'} action={setAdmin.bind(null, u.id, !u.isAdmin)} />
          <ActionButton label="Remove" action={removeUser.bind(null, u.id)} />
        </div>
      </td>
    </tr>
  );

  const memberCols = (
    <thead><tr><th>Username</th><th>First</th><th>Last</th><th>Email</th><th>Credits</th><th></th></tr></thead>
  );

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 22 }}>
        <p className="eyebrow">Control room</p>
        <h1>Admin</h1>
        <p className="lead">Approve members, build the official bracket, and manage results.</p>
        <Link href="/admin/bracket" className="btn btn-sm">Official bracket &amp; results →</Link>
      </header>

      <section className="panel reveal reveal-2">
        <div className="panel-head">
          <h2>Pending approval</h2>
          <span className="pill">{pending.length} waiting</span>
        </div>
        {pending.length === 0 ? (
          <p className="muted">No one waiting.</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Email</th><th>Username</th><th></th></tr></thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id}>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Username" className="muted">@{u.username}</td>
                  <td data-label="">
                    <div className="row-actions">
                      <ActionButton label="Approve" variant="primary" action={approveUser.bind(null, u.id)} />
                      <ActionButton label="Reject" action={rejectUser.bind(null, u.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel reveal reveal-4" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h2>Admins</h2>
          <span className="pill">{admins.length} total</span>
        </div>
        {admins.length === 0 ? (
          <p className="muted">No admins.</p>
        ) : (
          <table className="adm-table">
            {memberCols}
            <tbody>{admins.map(memberRow)}</tbody>
          </table>
        )}
      </section>

      <section className="panel reveal reveal-4" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h2>Members</h2>
          <span className="pill">{members.length} total</span>
        </div>
        {members.length === 0 ? (
          <p className="muted">No members yet.</p>
        ) : (
          <table className="adm-table">
            {memberCols}
            <tbody>{members.map(memberRow)}</tbody>
          </table>
        )}
      </section>
    </main>
  );
}
