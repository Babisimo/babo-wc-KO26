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
    <main style={{ maxWidth: 380, margin: '48px auto', padding: 16 }}>
      <h1>Request an account</h1>
      <p style={{ opacity: 0.8 }}>New accounts require admin approval before you can log in.</p>
      <form action={formAction} style={{ display: 'grid', gap: 10 }}>
        <input name="firstName" placeholder="First name" required />
        <input name="lastName" placeholder="Last name" required />
        <input name="username" placeholder="Username" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password (8+ chars)" required />
        {state?.error && <p style={{ color: '#ff8080' }}>{state.error}</p>}
        <button disabled={pending} type="submit">{pending ? 'Submitting…' : 'Request account'}</button>
      </form>
      <p style={{ marginTop: 12 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
