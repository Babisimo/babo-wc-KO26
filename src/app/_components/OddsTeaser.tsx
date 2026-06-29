'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/app/_components/LangProvider';

const SEEN_KEY = 'wc-ko-odds-teaser-seen';

// Dismissible pop-up inviting the player to the /odds page. Shows once (until closed),
// then stays closed via localStorage. Close with ✕, the backdrop, or Esc.
export default function OddsTeaser() {
  const t = useT();
  const [show, setShow] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) setShow(true); } catch { /* no storage → don't show */ }
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  }, []);

  useEffect(() => {
    if (!show) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [show, dismiss]);

  if (!show) return null;

  return (
    <div className="oddsp-backdrop" onClick={dismiss}>
      <div className="oddsp" role="dialog" aria-modal="true" aria-label={t('home.oddsTeaserTitle')} onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="oddsp-close" onClick={dismiss} aria-label={t('home.oddsTeaserClose')}>✕</button>
        <p className="eyebrow">📊 {t('odds.title')}</p>
        <h2>{t('home.oddsTeaserTitle')}</h2>
        <p className="muted">{t('home.oddsTeaserLead')}</p>
        <div className="oddsp-actions">
          <Link href="/odds" className="btn" onClick={dismiss}>{t('home.oddsTeaserCta')}</Link>
        </div>
      </div>
    </div>
  );
}
