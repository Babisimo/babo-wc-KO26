'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { useT, useLang } from '@/app/_components/LangProvider';
import PoolPill from '@/app/_components/PoolPill';
import type { PoolHeaderStats } from '@/lib/pool-stats';

export default function Nav({
  signedIn,
  isAdmin,
  adminNotifications = 0,
  pool = null,
}: {
  signedIn: boolean;
  isAdmin: boolean;
  adminNotifications?: number;
  pool?: PoolHeaderStats | null;
}) {
  const t = useT();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Seed from the server-rendered count, then poll so admins see new requests
  // without navigating. Re-sync if the server prop changes on navigation.
  const [count, setCount] = useState(adminNotifications);
  useEffect(() => setCount(adminNotifications), [adminNotifications]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active && typeof data.count === 'number') setCount(data.count);
      } catch {
        /* transient network error — keep the last known count */
      }
    };
    const id = setInterval(tick, 15_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isAdmin]);

  const showBubble = isAdmin && count > 0;
  const bubbleLabel = t('nav.pendingApprovals', { n: count });
  const bubbleText = count > 99 ? '99+' : String(count);

  return (
    <nav className="topnav">
      {open && <button type="button" className="nav-backdrop" aria-label="Close menu" onClick={close} />}
      <Link href="/" className="wordmark" onClick={close}>WC26&nbsp;KO</Link>
      <span className="nav-spacer" />

      {/* Pinned to the bar at every screen size, like the EN/ES toggle. */}
      {signedIn && <Link href="/official" className="navlink nav-pinned" onClick={close}>{t('nav.official')}</Link>}

      {/* Who's in + pot, visible to everyone signed in; picks stay hidden until lock. */}
      {signedIn && pool && <PoolPill pool={pool} onNavigate={close} />}

      <div className={`nav-links${open ? ' open' : ''}`}>
        {signedIn ? (
          <>
            <Link href="/" className="navlink" onClick={close}>{t('nav.leaderboard')}</Link>
            <Link href="/bracket" className="navlink" onClick={close}>{t('nav.myBracket')}</Link>
            <Link href="/brackets" className="navlink" onClick={close}>{t('nav.brackets')}</Link>
            <Link href="/compare" className="navlink" onClick={close}>{t('nav.compare')}</Link>
            <Link href="/account" className="navlink" onClick={close}>{t('nav.account')}</Link>
            {isAdmin && (
              <Link href="/admin" className="navlink" onClick={close}>
                {t('nav.admin')}
                {showBubble && (
                  <span className="nav-bubble" aria-label={bubbleLabel}>{bubbleText}</span>
                )}
              </Link>
            )}
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
        {showBubble && (
          <span className="nav-bubble nav-bubble-corner" aria-label={bubbleLabel}>{bubbleText}</span>
        )}
      </button>
    </nav>
  );
}
