'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/app/_components/LangProvider';
import TeamFlag from '@/app/_components/TeamFlag';
import { teamName } from '@/lib/team-name';
import { formatRemaining } from '@/lib/format-remaining';
import type { GameRow } from '@/app/actions/next-games';

type Data = { games: GameRow[]; lockNote: string | null };

export default function NextGames({ initial }: { initial: Data }) {
  const t = useT();
  const [data, setData] = useState<Data>(initial);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/next-games', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch { /* keep last-known on transient errors */ }
    }, 30000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, []);

  return (
    <section className="nextup reveal">
      <p className="eyebrow">{t('home.nextUp')}</p>
      {data.games.length === 0 ? (
        <p className="muted">{t('home.noGames')}</p>
      ) : (
        <ul className="nextup-list">
          {data.games.map((g) => (
            <li key={`${g.teamA}-${g.teamB}`} className={`nextup-game state-${g.state}`}>
              <span className="ng-team"><TeamFlag code={g.teamA} /> {teamName(g.teamA)}</span>
              <span className="ng-mid">
                {g.state === 'pre'
                  ? <span className="ng-when">{t('home.kickoffIn', { when: formatRemaining(Math.max(0, Date.parse(g.kickoffIso) - now)) })}</span>
                  : <span className="ng-score">{g.scoreA ?? 0}–{g.scoreB ?? 0}{g.state === 'in' ? <em className="ng-live"> {t('home.live')}</em> : <em className="ng-final"> {t('home.final')}</em>}</span>}
              </span>
              <span className="ng-team ng-team-b">{teamName(g.teamB)} <TeamFlag code={g.teamB} /></span>
              {g.yourPick && (
                <span className={`ng-pick result-${g.result}`}>
                  {t('home.yourPick')}: {teamName(g.yourPick)}
                  {g.result === 'won' && ' ✓'}
                  {g.result === 'busted' && ' ✗'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.lockNote && <p className="nextup-lock muted">{t('home.picksLockAt', { when: data.lockNote })}</p>}
    </section>
  );
}
