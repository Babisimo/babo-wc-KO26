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
    return <p>Brackets are not open yet.</p>;
  }

  const lockMs = new Date(lockTimeIso).getTime();
  const remaining = lockMs - now;

  if (remaining <= 0) {
    return <p><strong>Brackets are locked.</strong></p>;
  }

  return (
    <p>
      Brackets lock in <strong>{formatRemaining(remaining)}</strong>
      {lockLabel ? <> — {lockLabel}</> : null}
    </p>
  );
}
