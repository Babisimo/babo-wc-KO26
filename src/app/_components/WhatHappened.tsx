'use client';

import { useT } from '@/app/_components/LangProvider';
import { teamName } from '@/lib/team-name';

export type ResultEventView = { winner: string; loser: string; bustedCount: number; newLeader: string | null };

/** One-line drama note about the most recent finished game. Renders nothing when there's none. */
export default function WhatHappened({ event }: { event: ResultEventView | null }) {
  const t = useT();
  if (!event) return null;
  return (
    <p className="whathappened reveal" role="status">
      {t('home.bustedLine', { winner: teamName(event.winner), loser: teamName(event.loser), n: event.bustedCount })}
      {event.newLeader && <> · {t('home.takesFirst', { leader: event.newLeader })}</>}
    </p>
  );
}
