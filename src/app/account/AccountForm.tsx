'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  changeUsername,
  changePassword,
  type ChangeUsernameState,
  type ChangePasswordState,
} from '@/app/actions/auth';
import { usernameChangesRemaining, MAX_USERNAME_CHANGES } from '@/lib/profile';
import { useT } from '@/app/_components/LangProvider';

export default function AccountForm({
  username,
  usernameChangeCount,
}: {
  username: string | null;
  usernameChangeCount: number;
}) {
  const t = useT();
  const router = useRouter();
  const remaining = usernameChangesRemaining(usernameChangeCount);

  const [unState, unAction, unPending] = useActionState<ChangeUsernameState, FormData>(changeUsername, undefined);
  const [pwState, pwAction, pwPending] = useActionState<ChangePasswordState, FormData>(changePassword, undefined);

  // Refresh the server page after a username change so the handle and remaining count update.
  useEffect(() => {
    if (unState?.ok) router.refresh();
  }, [unState, router]);

  return (
    <main className="shell narrow">
      <header className="reveal" style={{ marginBottom: 20 }}>
        <p className="eyebrow">{t('account.eyebrow')}</p>
        <h1>{t('account.usernameTitle')}</h1>
      </header>

      <section className="panel reveal">
        <p className="muted" style={{ marginTop: 0 }}>
          {username ? <strong style={{ color: 'var(--line)' }}>@{username}</strong> : t('account.handleNone')}
          {' · '}
          {t('account.changesLeft', { n: remaining, max: MAX_USERNAME_CHANGES })}
        </p>

        {unState?.ok && <p className="banner ok">{t('account.usernameUpdated')}</p>}
        {unState?.errorKey && <p className="banner error">{t(unState.errorKey)}</p>}

        {remaining > 0 ? (
          <form action={unAction} className="field-list" style={{ marginTop: 14 }}>
            <div>
              <label htmlFor="username">{t('account.newUsername')}</label>
              <input id="username" name="username" type="text" placeholder={t('account.newUsername')} autoComplete="username" required />
            </div>
            <button disabled={unPending} type="submit" className="btn-block">
              {unPending ? t('account.saving') : t('account.updateUsername')}
            </button>
          </form>
        ) : (
          <p className="banner info" style={{ marginTop: 14 }}>{t('account.err.usedAll')}</p>
        )}
      </section>

      <section className="panel reveal reveal-2" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 4 }}>{t('account.passwordTitle')}</h2>

        {pwState?.ok && <p className="banner ok">{t('account.passwordUpdated')}</p>}
        {pwState?.errorKey && <p className="banner error">{t(pwState.errorKey)}</p>}

        <form action={pwAction} className="field-list" style={{ marginTop: 14 }}>
          <div>
            <label htmlFor="currentPassword">{t('account.currentPassword')}</label>
            <input id="currentPassword" name="currentPassword" type="password" placeholder={t('account.currentPassword')} autoComplete="current-password" required />
          </div>
          <div>
            <label htmlFor="newPassword">{t('auth.password')}</label>
            <input id="newPassword" name="newPassword" type="password" placeholder={t('reset.newPlaceholder')} autoComplete="new-password" required />
          </div>
          <div>
            <label htmlFor="confirmPassword">{t('reset.confirmPlaceholder')}</label>
            <input id="confirmPassword" name="confirmPassword" type="password" placeholder={t('reset.confirmPlaceholder')} autoComplete="new-password" required />
          </div>
          <button disabled={pwPending} type="submit" className="btn-block">
            {pwPending ? t('account.saving') : t('account.updatePassword')}
          </button>
        </form>
      </section>
    </main>
  );
}
