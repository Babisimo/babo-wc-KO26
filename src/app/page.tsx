import { auth, type AppSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  return (
    <main style={{ padding: 24 }}>
      <h1>WC26 Knockout Bracket</h1>
      {session?.user ? (
        <p>Welcome, {session.user.name}. The bracket opens soon.</p>
      ) : (
        <p>Request an account to join the pool.</p>
      )}
    </main>
  );
}
