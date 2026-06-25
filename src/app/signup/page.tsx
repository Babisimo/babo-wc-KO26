'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signup, type SignupState } from '@/app/actions/auth';
import { useT } from '@/app/_components/LangProvider';

export default function SignupPage() {
  const t = useT();
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
        <p className="eyebrow">{t('auth.eyebrow')}</p>
        <h1 style={{ fontSize: '2rem' }}>{t('auth.requestTitle')}</h1>
        <p className="muted" style={{ fontSize: '0.92rem' }}>
          {t('auth.requestBlurb')}
        </p>
        <form action={formAction} className="field-list" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="firstName">{t('auth.firstName')}</label>
              <input id="firstName" name="firstName" placeholder="Lionel" autoComplete="given-name" required />
            </div>
            <div>
              <label htmlFor="lastName">{t('auth.lastName')}</label>
              <input id="lastName" name="lastName" placeholder="Messi" autoComplete="family-name" required />
            </div>
          </div>
          <div>
            <label htmlFor="username">{t('auth.username')}</label>
            {/* autoComplete="off": this is a NEW display name, not the login id.
                Tagging it "username" makes Google autofill paste the saved email here. */}
            <input id="username" name="username" placeholder="pele_10" autoComplete="off" required />
          </div>
          <div>
            <label htmlFor="email">{t('auth.email')}</label>
            {/* "username" (not "email") so the password manager fills the login id
                here and saves email+new password as one credential. */}
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="username" required />
          </div>
          <div>
            <label htmlFor="password">{t('auth.password')}</label>
            <input id="password" name="password" type="password" placeholder={t('auth.passwordHint')} autoComplete="new-password" required />
          </div>
          {state?.errorKey && <p className="banner error">{t(state.errorKey)}</p>}
          <button disabled={pending} type="submit" className="btn-block">{pending ? t('auth.submitting') : t('auth.requestAccount')}</button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: '0.9rem' }}>
          {t('auth.haveAccount')} <Link href="/login">{t('auth.login')}</Link>
        </p>
      </div>
    </main>
  );
}
