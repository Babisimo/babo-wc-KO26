'use client';

import Link from 'next/link';
import { useT } from '@/app/_components/LangProvider';

export default function OddsTeaser() {
  const t = useT();
  return (
    <section className="cta reveal" style={{ marginBottom: 18 }}>
      <div className="cta-text">
        <p className="eyebrow">📊 {t('odds.title')}</p>
        <h2>{t('home.oddsTeaserTitle')}</h2>
        <p className="muted">{t('home.oddsTeaserLead')}</p>
      </div>
      <div className="cta-actions">
        <Link href="/odds" className="btn">{t('home.oddsTeaserCta')}</Link>
      </div>
    </section>
  );
}
