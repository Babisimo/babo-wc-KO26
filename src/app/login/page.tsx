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
    <main className="auth-card reveal">
      <div className="panel">
        <p className="eyebrow">WC26 Knockout</p>
        <h1 style={{ fontSize: '2rem' }}>Log in</h1>
        {justRegistered && (
          <p className="banner info" style={{ margin: '12px 0' }}>
            Account requested. An admin must approve it before you can log in.
          </p>
        )}
        <form onSubmit={onSubmit} className="field-list" style={{ marginTop: 16 }}>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="••••••••" required />
          </div>
          {error && <p className="banner error">{error}</p>}
          <button disabled={pending} type="submit" className="btn-block">{pending ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: '0.9rem' }}>
          Need an account? <Link href="/signup">Request one</Link>
        </p>
      </div>
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
