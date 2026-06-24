'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get('registered') === '1';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn('credentials', {
      email: String(fd.get('email') ?? ''),
      password: String(fd.get('password') ?? ''),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError('Invalid email or password, or your account is awaiting approval.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 380, margin: '48px auto', padding: 16 }}>
      <h1>Log in</h1>
      {justRegistered && (
        <p style={{ color: 'var(--accent)' }}>
          Account requested. An admin must approve it before you can log in.
        </p>
      )}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        {error && <p style={{ color: '#ff8080' }}>{error}</p>}
        <button disabled={pending} type="submit">{pending ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p style={{ marginTop: 12 }}>
        Need an account? <Link href="/signup">Request one</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
