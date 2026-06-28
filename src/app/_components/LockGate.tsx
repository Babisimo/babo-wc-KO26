'use client';

import { useEffect, useState } from 'react';
import Countdown from '@/app/_components/Countdown';
import NextGames from '@/app/_components/NextGames';
import type { getNextGames } from '@/app/actions/next-games';

type Data = Awaited<ReturnType<typeof getNextGames>>;

/**
 * Before lock: the "brackets lock in {time}" countdown. The instant the timer hits zero the
 * "Next up" games strip pops in live — no refresh. A 1s clock drives the swap client-side;
 * once locked it stops ticking and NextGames owns its own polling.
 */
export default function LockGate({ data }: { data: Data }) {
  const [now, setNow] = useState<number>(() => Date.now());
  const lockMs = data.lockTimeIso ? Date.parse(data.lockTimeIso) : NaN;
  const locked = Number.isFinite(lockMs) && now >= lockMs;

  useEffect(() => {
    if (locked) return; // already locked → no need to keep ticking
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  return locked
    ? <NextGames initial={data} />
    : <Countdown lockTimeIso={data.lockTimeIso} lockLabel={data.lockLabel} />;
}
