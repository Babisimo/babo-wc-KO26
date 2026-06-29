'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/app/_components/LangProvider';
import TeamFlag from '@/app/_components/TeamFlag';
import { teamName, teamColor } from '@/lib/team-name';
import { formatRemaining } from '@/lib/format-remaining';
import type { GameRow } from '@/app/actions/next-games';
import type { StringKey } from '@/lib/i18n';

type T = (key: StringKey, vars?: Record<string, string | number>) => string;
type Data = { games: GameRow[]; lockNote: string | null };

// One head-to-head bar: two team-colored segments + the win % at each end.
function OddsBar({ label, teamA, teamB, a, b, t }: {
  label: string; teamA: string; teamB: string; a: number; b: number; t: T;
}) {
  const colorA = teamColor(teamA), colorB = teamColor(teamB);
  const pa = Math.round(a * 100);
  const pb = 100 - pa; // ends always read as 100 together
  return (
    <div className="ngo" aria-label={t('home.oddsAria', { label, a: teamName(teamA), pa, b: teamName(teamB), pb })}>
      <span className="ngo-label">{label}</span>
      <b className="ngo-pct" style={{ color: colorA }}>{pa}%</b>
      <span className="ngo-bar" aria-hidden>
        <i style={{ width: `${a * 100}%`, background: colorA }} />
        <i style={{ width: `${b * 100}%`, background: colorB }} />
      </span>
      <b className="ngo-pct ngo-pct-r" style={{ color: colorB }}>{pb}%</b>
    </div>
  );
}

export default function NextGames({ initial }: { initial: Data }) {
  const t = useT() as T;
  const [data, setData] = useState<Data>(initial);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const res = await fetch('/api/next-games', { cache: 'no-store' });
        if (res.ok && alive) setData(await res.json());
      } catch { /* keep last-known on transient errors */ }
    };
    refresh(); // immediate: a strip that just popped in at lock shows current games right away
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(refresh, 30000);
    return () => { alive = false; clearInterval(tick); clearInterval(poll); };
  }, []);

  return (
    <section className="nextup reveal">
      <p className="eyebrow">{t('home.nextUp')}</p>
      {data.games.length === 0 ? (
        <p className="muted">{t('home.noGames')}</p>
      ) : (
        <ul className="nextup-list" aria-live="polite">
          {data.games.map((g) => (
            <li key={`${g.teamA}-${g.teamB}`} className={`nextup-game state-${g.state}`}>
              <span className="ng-team"><TeamFlag code={g.teamA} /> {teamName(g.teamA)}</span>
              <span className="ng-mid">
                {g.state === 'pre'
                  ? <span className="ng-when">{t('home.kickoffIn', { when: formatRemaining(Math.max(0, Date.parse(g.kickoffIso) - now)) })}</span>
                  : <span className="ng-score">{g.scoreA ?? 0}–{g.scoreB ?? 0}{g.state === 'in' ? <em className="ng-live"> {t('home.live')}</em> : <em className="ng-final"> {t('home.final')}</em>}</span>}
              </span>
              <span className="ng-team ng-team-b">{teamName(g.teamB)} <TeamFlag code={g.teamB} /></span>

              {(g.pool || g.odds) && (
                <div className="ng-odds">
                  {g.pool && <OddsBar label={t('home.oddsBracket')} teamA={g.teamA} teamB={g.teamB} a={g.pool.a} b={g.pool.b} t={t} />}
                  {g.odds && <OddsBar label={t('home.oddsBooks')} teamA={g.teamA} teamB={g.teamB} a={g.odds.probA} b={g.odds.probB} t={t} />}
                </div>
              )}

              {g.yourPick && (
                <span className={`ng-pick result-${g.result}`}>
                  {t('home.yourPick')}: {teamName(g.yourPick)}
                  {g.result === 'won' && (<><span className="sr-only"> {t('home.pickWon')}</span><span aria-hidden="true"> ✓</span></>)}
                  {g.result === 'busted' && (<><span className="sr-only"> {t('home.pickBusted')}</span><span aria-hidden="true"> ✗</span></>)}
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
