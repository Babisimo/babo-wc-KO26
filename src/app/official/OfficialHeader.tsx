'use client';
import { useT } from '@/app/_components/LangProvider';

export default function OfficialHeader({ variant }: { variant: 'real' | 'projected' }) {
  const t = useT();
  return (
    <header className="reveal" style={{ marginBottom: 22 }}>
      <p className="eyebrow">{variant === 'real' ? t('official.eyebrowReal') : t('official.eyebrowRoad')}</p>
      <h1>{t('official.title')}</h1>
      <p className="lead">{variant === 'real' ? t('official.leadReal') : t('official.leadProjected')}</p>
    </header>
  );
}
