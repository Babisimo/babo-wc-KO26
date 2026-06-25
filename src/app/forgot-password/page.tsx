'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, type RequestResetState } from '@/app/actions/password-reset';
import { useT } from '@/app/_components/LangProvider';

export default function ForgotPasswordPage() {
  const t = useT();
  const [state, formAction, pending] = useActionState<RequestResetState, FormData>(
    requestPasswordReset,
    undefined,
  );

  return (
    <main className="auth-card reveal">
      <div className="panel">
        <p className="eyebrow">{t('forgot.eyebrow')}</p>
        <h1 style={{ fontSize: '2rem' }}>{t('forgot.title')}</h1>

        {state?.sent ? (
          <p className="banner info" style={{ marginTop: 16 }}>{t('forgot.sent')}</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: '0.92rem', marginTop: 8 }}>{t('forgot.lead')}</p>
            <form action={formAction} className="field-list" style={{ marginTop: 16 }}>
              <div>
                <label htmlFor="email">{t('auth.email')}</label>
                <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="username" required />
              </div>
              <button disabled={pending} type="submit" className="btn-block">
                {pending ? t('forgot.sending') : t('forgot.send')}
              </button>
            </form>
          </>
        )}

        <p className="muted" style={{ marginTop: 16, fontSize: '0.9rem' }}>
          {t('forgot.remembered')} <Link href="/login">{t('forgot.back')}</Link>
        </p>
      </div>
    </main>
  );
}
