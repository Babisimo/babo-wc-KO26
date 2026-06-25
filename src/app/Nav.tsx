'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { useT, useLang } from '@/app/_components/LangProvider';

export default function Nav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav className="topnav">
      {open && <button type="button" className="nav-backdrop" aria-label="Close menu" onClick={close} />}
      <Link href="/" className="wordmark" onClick={close}>WC26&nbsp;KO</Link>
      <span className="nav-spacer" />

      {/* Pinned to the bar at every screen size, like the EN/ES toggle. */}
      {signedIn && <Link href="/official" className="navlink nav-pinned" onClick={close}>{t('nav.official')}</Link>}

      <div className={`nav-links${open ? ' open' : ''}`}>
        {signedIn ? (
          <>
            <Link href="/" className="navlink" onClick={close}>{t('nav.leaderboard')}</Link>
            <Link href="/bracket" className="navlink" onClick={close}>{t('nav.myBracket')}</Link>
            <Link href="/brackets" className="navlink" onClick={close}>{t('nav.brackets')}</Link>
            <Link href="/compare" className="navlink" onClick={close}>{t('nav.compare')}</Link>
            <Link href="/account" className="navlink" onClick={close}>{t('nav.account')}</Link>
            {isAdmin && <Link href="/admin" className="navlink" onClick={close}>{t('nav.admin')}</Link>}
            <form action={logout}>
              <button type="submit" className="btn-ghost btn-sm btn-block">{t('nav.logout')}</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="navlink" onClick={close}>{t('nav.login')}</Link>
            <Link href="/signup" className="btn btn-sm" onClick={close}>{t('nav.requestAccount')}</Link>
          </>
        )}
      </div>

      {/* EN/ES toggle stays on the header bar at every screen size. */}
      <div className="fm-toggle nav-lang" role="group" aria-label="Language">
        <button type="button" className={`seg${lang === 'en' ? ' active' : ''}`} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>{t('nav.langEn')}</button>
        <button type="button" className={`seg${lang === 'es' ? ' active' : ''}`} aria-pressed={lang === 'es'} onClick={() => setLang('es')}>{t('nav.langEs')}</button>
      </div>

      <button
        type="button"
        className={`nav-burger${open ? ' open' : ''}`}
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>
    </nav>
  );
}
