'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Countdown from '@/app/_components/Countdown';
import NextGames from '@/app/_components/NextGames';
import type { getNextGames } from '@/app/actions/next-games';

type Data = Awaited<ReturnType<typeof getNextGames>>;

/**
 * Before lock: the "brackets lock in {time}" countdown, plus any `preLock` content (e.g. the
 * "create your own bracket" card). The instant the timer hits zero the "Next up" games strip
 * pops in live — no refresh — and the countdown + preLock content are stripped. A 1s clock
 * drives the swap client-side; once locked it stops ticking and NextGames owns its own polling.
 */
export default function LockGate({ data, preLock }: { data: Data; preLock?: ReactNode }) {
  const [now, setNow] = useState<number>(() => Date.now());
  const lockMs = data.lockTimeIso ? Date.parse(data.lockTimeIso) : NaN;
  const locked = Number.isFinite(lockMs) && now >= lockMs;

  useEffect(() => {
    if (locked) return; // already locked → no need to keep ticking
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  if (locked) return <NextGames initial={data} />;
  return (
    <>
      <Countdown lockTimeIso={data.lockTimeIso} lockLabel={data.lockLabel} />
      {preLock}
    </>
  );
}
