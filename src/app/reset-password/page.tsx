'use client';

import { Suspense, useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPassword, type ResetPasswordState } from '@/app/actions/password-reset';
import { useT } from '@/app/_components/LangProvider';

function ResetForm() {
  const t = useT();
  const token = useSearchParams().get('token') ?? '';
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    undefined,
  );

  return (
    <main className="auth-card reveal">
      <div className="panel">
        <p className="eyebrow">{t('reset.eyebrow')}</p>
        <h1 style={{ fontSize: '2rem' }}>{t('reset.title')}</h1>

        {!token ? (
          <p className="banner error" style={{ marginTop: 16 }}>{t('reset.missing')}</p>
        ) : state?.ok ? (
          <p className="banner ok" style={{ marginTop: 16 }}>
            {t('reset.done')} <Link href="/login">{t('auth.login')}</Link>
          </p>
        ) : (
          <>
            {state?.errorKey && <p className="banner error" style={{ marginTop: 16 }}>{t(state.errorKey)}</p>}
            <form action={formAction} className="field-list" style={{ marginTop: 16 }}>
              <input type="hidden" name="token" value={token} />
              <div>
                <label htmlFor="newPassword">{t('auth.password')}</label>
                <input id="newPassword" name="newPassword" type="password" placeholder={t('reset.newPlaceholder')} autoComplete="new-password" required />
              </div>
              <div>
                <label htmlFor="confirmPassword">{t('reset.confirmPlaceholder')}</label>
                <input id="confirmPassword" name="confirmPassword" type="password" placeholder={t('reset.confirmPlaceholder')} autoComplete="new-password" required />
              </div>
              <button disabled={pending} type="submit" className="btn-block">
                {pending ? t('reset.saving') : t('reset.save')}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
