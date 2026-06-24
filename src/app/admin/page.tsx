import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { approveUser, rejectUser, setAdmin, removeUser, approveBracket, rejectBracket } from '@/app/actions/admin';
import { ActionButton } from './UserRow';

export const dynamic = 'force-dynamic';

function statusBadge(status: string) {
  const cls = status === 'APPROVED' ? 'ok' : status === 'REJECTED' ? 'bad' : 'warn';
  return <span className={`badge ${cls}`}>{status.toLowerCase()}</span>;
}

export default async function AdminPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) redirect('/');

  const pending = await db.user.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  const all = await db.user.findMany({ orderBy: { createdAt: 'asc' } });

  const pendingBrackets = await db.bracket.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, userId: true },
  });
  const bracketOwners = await db.user.findMany({
    where: { id: { in: pendingBrackets.map((b) => b.userId) } },
    select: { id: true, name: true, username: true },
  });
  const ownerById = new Map(bracketOwners.map((u) => [u.id, u]));

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
          <table>
            <thead><tr><th>Email</th><th>Username</th><th></th></tr></thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td className="muted">@{u.username}</td>
                  <td>
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

      <section className="panel reveal reveal-3" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h2>Bracket entries awaiting approval</h2>
          <span className="pill">{pendingBrackets.length} waiting</span>
        </div>
        {pendingBrackets.length === 0 ? (
          <p className="muted">No extra brackets waiting.</p>
        ) : (
          <table>
            <thead><tr><th>Player</th><th>Bracket</th><th></th></tr></thead>
            <tbody>
              {pendingBrackets.map((b) => {
                const u = ownerById.get(b.userId);
                return (
                  <tr key={b.id}>
                    <td>{u?.username ?? u?.name ?? 'Unknown'}</td>
                    <td className="muted">{b.name}</td>
                    <td>
                      <div className="row-actions">
                        <ActionButton label="Approve" variant="primary" action={approveBracket.bind(null, b.id)} />
                        <ActionButton label="Reject" action={rejectBracket.bind(null, b.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel reveal reveal-4" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h2>All members</h2>
          <span className="pill">{all.length} total</span>
        </div>
        <table>
          <thead><tr><th>Member</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {all.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.name}{u.isAdmin && <span className="badge warn" style={{ marginLeft: 8 }}>admin</span>}</div>
                  <div className="muted" style={{ fontSize: '0.84rem' }}>{u.email}</div>
                </td>
                <td>{statusBadge(u.status)}</td>
                <td>
                  <div className="row-actions">
                    <ActionButton label={u.isAdmin ? 'Remove admin' : 'Make admin'} action={setAdmin.bind(null, u.id, !u.isAdmin)} />
                    <ActionButton label="Remove" action={removeUser.bind(null, u.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
