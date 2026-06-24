import Link from 'next/link';
import { auth, type AppSession } from '@/lib/auth';
import { logout } from '@/app/actions/auth';

export default async function Nav() {
  const session = (await auth()) as AppSession | null;
  return (
    <nav className="topnav">
      <Link href="/" className="wordmark">WC26&nbsp;KO</Link>
      <span className="nav-spacer" />
      {session?.user ? (
        <>
          <Link href="/" className="navlink">Leaderboard</Link>
          <Link href="/official" className="navlink">Official</Link>
          <Link href="/bracket" className="navlink">My bracket</Link>
          <Link href="/brackets" className="navlink">Brackets</Link>
          {session.user.isAdmin && <Link href="/admin" className="navlink">Admin</Link>}
          <form action={logout} style={{ marginLeft: 6 }}>
            <button type="submit" className="btn-ghost btn-sm">Log out</button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className="navlink">Log in</Link>
          <Link href="/signup" className="btn btn-sm">Request account</Link>
        </>
      )}
    </nav>
  );
}
