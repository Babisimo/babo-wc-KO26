'use client';

import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { useT, useLang } from '@/app/_components/LangProvider';

export default function Nav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const t = useT();
  const { lang, setLang } = useLang();

  return (
    <nav className="topnav">
      <Link href="/" className="wordmark">WC26&nbsp;KO</Link>
      <span className="nav-spacer" />

      {signedIn ? (
        <>
          <Link href="/" className="navlink">{t('nav.leaderboard')}</Link>
          <Link href="/official" className="navlink">{t('nav.official')}</Link>
          <Link href="/bracket" className="navlink">{t('nav.myBracket')}</Link>
          <Link href="/brackets" className="navlink">{t('nav.brackets')}</Link>
          {isAdmin && <Link href="/admin" className="navlink">{t('nav.admin')}</Link>}
          <form action={logout} style={{ marginLeft: 6 }}>
            <button type="submit" className="btn-ghost btn-sm">{t('nav.logout')}</button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className="navlink">{t('nav.login')}</Link>
          <Link href="/signup" className="btn btn-sm">{t('nav.requestAccount')}</Link>
        </>
      )}

      <div className="fm-toggle" role="group" aria-label="Language" style={{ marginLeft: 8 }}>
        <button type="button" className={`seg${lang === 'en' ? ' active' : ''}`} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>{t('nav.langEn')}</button>
        <button type="button" className={`seg${lang === 'es' ? ' active' : ''}`} aria-pressed={lang === 'es'} onClick={() => setLang('es')}>{t('nav.langEs')}</button>
      </div>
    </nav>
  );
}
