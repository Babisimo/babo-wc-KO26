'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get('registered') === '1';
  const [error, setError] = useState<StringKey | null>(null);
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
      setError('auth.invalid');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="auth-card reveal">
      <div className="panel">
        <p className="eyebrow">{t('auth.eyebrow')}</p>
        <h1 style={{ fontSize: '2rem' }}>{t('auth.login')}</h1>
        {justRegistered && (
          <p className="banner info" style={{ margin: '12px 0' }}>
            {t('auth.requested')}
          </p>
        )}
        <form onSubmit={onSubmit} className="field-list" style={{ marginTop: 16 }}>
          <div>
            <label htmlFor="email">{t('auth.email')}</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="username" required />
          </div>
          <div>
            <label htmlFor="password">{t('auth.password')}</label>
            <input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
          </div>
          {error && <p className="banner error">{t(error)}</p>}
          <button disabled={pending} type="submit" className="btn-block">{pending ? t('auth.loggingIn') : t('auth.login')}</button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: '0.9rem' }}>
          {t('auth.needAccount')} <Link href="/signup">{t('auth.requestOne')}</Link>
        </p>
        <p className="muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>
          <Link href="/forgot-password">{t('auth.forgot')}</Link>
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
