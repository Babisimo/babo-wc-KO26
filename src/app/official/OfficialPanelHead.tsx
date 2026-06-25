'use client';
import { useT } from '@/app/_components/LangProvider';

export function OfficialPanelHead({ decided, total }: { decided: number; total: number }) {
  const t = useT();
  return (
    <div className="panel-head">
      <h2>{t('official.tree')}</h2>
      <span className="pill">{t('official.decided', { n: decided, total })}</span>
    </div>
  );
}

export function OfficialNotReady() {
  const t = useT();
  return <p className="muted">{t('official.notReady')}</p>;
}

export function OfficialNotAvailable() {
  const t = useT();
  return <p className="muted">{t('official.notAvailable')}</p>;
}
