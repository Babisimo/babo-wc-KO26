'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signup, type SignupState } from '@/app/actions/auth';

export default function SignupPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: SignupState, fd: FormData) => {
      const res = await signup(prev, fd);
      if (res === undefined) router.push('/login?registered=1');
      return res;
    },
    undefined,
  );

  return (
    <main className="auth-card reveal">
      <div className="panel">
        <p className="eyebrow">WC26 Knockout</p>
        <h1 style={{ fontSize: '2rem' }}>Request an account</h1>
        <p className="muted" style={{ fontSize: '0.92rem' }}>
          This is an invite-quality pool — new accounts need admin approval before you can log in.
        </p>
        <form action={formAction} className="field-list" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="firstName">First name</label>
              <input id="firstName" name="firstName" placeholder="Lionel" required />
            </div>
            <div>
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" name="lastName" placeholder="Messi" required />
            </div>
          </div>
          <div>
            <label htmlFor="username">Username</label>
            <input id="username" name="username" placeholder="pele_10" required />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="At least 8 characters" required />
          </div>
          {state?.error && <p className="banner error">{state.error}</p>}
          <button disabled={pending} type="submit" className="btn-block">{pending ? 'Submitting…' : 'Request account'}</button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: '0.9rem' }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
