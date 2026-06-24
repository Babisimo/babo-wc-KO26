'use client';

import { useEffect, useState } from 'react';
import { formatRemaining } from '@/lib/format-remaining';

export default function Countdown({
  lockTimeIso,
  lockLabel,
}: {
  lockTimeIso: string | null;
  lockLabel: string | null;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!lockTimeIso) {
    return (
      <div className="countdown">
        <span className="cd-label">Bracket status</span>
        <span className="cd-time" style={{ fontSize: '1.4rem' }}>Not open yet</span>
        <span className="cd-when">Waiting on the Round-of-32 matchups.</span>
      </div>
    );
  }

  const lockMs = new Date(lockTimeIso).getTime();
  const remaining = lockMs - now;

  if (remaining <= 0) {
    return (
      <div className="countdown">
        <span className="cd-label">Brackets locked</span>
        <span className="cd-time">Locked</span>
        <span className="cd-when">Picks are final — results decide the rest.</span>
      </div>
    );
  }

  return (
    <div className="countdown">
      <span className="cd-label">Brackets lock in</span>
      <span className="cd-time">{formatRemaining(remaining)}</span>
      {lockLabel ? <span className="cd-when">Locks {lockLabel}</span> : null}
    </div>
  );
}
