'use client';

import { useEffect, useState } from 'react';
import { formatRemaining } from '@/lib/format-remaining';
import { useT } from '@/app/_components/LangProvider';

export default function Countdown({
  lockTimeIso,
  lockLabel,
}: {
  lockTimeIso: string | null;
  lockLabel: string | null;
}) {
  const t = useT();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!lockTimeIso) {
    return (
      <div className="countdown">
        <span className="cd-label">{t('countdown.statusLabel')}</span>
        <span className="cd-time" style={{ fontSize: '1.4rem' }}>{t('countdown.notOpen')}</span>
        <span className="cd-when">{t('countdown.waiting')}</span>
      </div>
    );
  }

  const lockMs = new Date(lockTimeIso).getTime();
  const remaining = lockMs - now;

  if (remaining <= 0) {
    return (
      <div className="countdown">
        <span className="cd-label">{t('countdown.lockedLabel')}</span>
        <span className="cd-time">{t('countdown.locked')}</span>
        <span className="cd-when">{t('countdown.lockedWhen')}</span>
      </div>
    );
  }

  return (
    <div className="countdown">
      <span className="cd-label">{t('countdown.lockIn')}</span>
      <span className="cd-time">{formatRemaining(remaining)}</span>
      {lockLabel ? <span className="cd-when">{t('countdown.locksAt', { when: lockLabel })}</span> : null}
    </div>
  );
}
