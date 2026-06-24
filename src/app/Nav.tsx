import Link from 'next/link';
import { auth, type AppSession } from '@/lib/auth';
import { logout } from '@/app/actions/auth';

export default async function Nav() {
  const session = (await auth()) as AppSession | null;
  return (
    <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ffffff22' }}>
      <Link href="/" style={{ fontWeight: 700 }}>WC26 KO</Link>
      <span style={{ flex: 1 }} />
      {session?.user ? (
        <>
          <Link href="/bracket">My bracket</Link>
          {session.user.isAdmin && <Link href="/admin">Admin</Link>}
          <form action={logout}>
            <button type="submit">Log out</button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login">Log in</Link>
          <Link href="/signup">Request account</Link>
        </>
      )}
    </nav>
  );
}
