'use client';

import Link from 'next/link';
import Countdown from '@/app/_components/Countdown';
import StageTracker from '@/app/_components/StageTracker';
import { useT } from '@/app/_components/LangProvider';
import type { LeaderboardData } from '@/app/actions/leaderboard';

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function HomeContent({
  userName,
  signedIn,
  board,
  lockTimeIso,
  lockLabel,
}: {
  userName: string | null;
  signedIn: boolean;
  board: LeaderboardData;
  lockTimeIso: string | null;
  lockLabel: string | null;
}) {
  const t = useT();
  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 26 }}>
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1>{t('home.title')}</h1>
        <p className="lead">
          {userName ? t('home.welcome', { name: userName }) : t('home.intro')}
        </p>

        {!signedIn && (
          <section className="cta reveal" style={{ marginTop: 18 }}>
            <div className="cta-text">
              <p className="eyebrow">{t('home.ctaEyebrow')}</p>
              <h2>{t('home.ctaTitle')}</h2>
              <p className="muted">{t('home.ctaLead')}</p>
            </div>
            <div className="cta-actions">
              <Link href="/login" className="btn">{t('nav.login')}</Link>
              <Link href="/signup" className="btn btn-ghost">{t('nav.requestAccount')}</Link>
            </div>
          </section>
        )}

        {signedIn && (
          <section className="cta reveal" style={{ marginTop: 18 }}>
            <div className="cta-text">
              <p className="eyebrow">{t('home.playEyebrow')}</p>
              <h2>{t('home.playTitle')}</h2>
              <p className="muted">{t('home.playLead')}</p>
            </div>
            <div className="cta-actions">
              <Link href="/bracket" className="btn">{t('home.playCta')}</Link>
            </div>
          </section>
        )}

        <Countdown lockTimeIso={lockTimeIso} lockLabel={lockLabel} />
      </header>

      <StageTracker stage={board.stage} />

      {signedIn && (
      <section className="panel reveal reveal-2">
        <div className="panel-head">
          <h2>{t('home.leaderboard')}</h2>
          <span className="pill gold">
            {t('home.pot', { amount: dollars(board.potCents) })}
            {board.winnerKeys.length > 0 && board.shareCents > 0 && (
              <> · {board.winnerKeys.length === 1
                ? t('home.leaderTakes', { amount: dollars(board.shareCents) })
                : t('home.split', { n: board.winnerKeys.length, amount: dollars(board.shareCents) })}</>
            )}
          </span>
        </div>
        {board.entries.length === 0 ? (
          <p className="muted">{t('home.empty')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 56 }}>{t('home.rank')}</th>
                <th>{t('home.player')}</th>
                <th className="num">{t('home.points')}</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((e) => {
                const winner = board.winnerKeys.includes(e.key);
                return (
                  <tr key={e.key} className={e.username ? 'row-link' : undefined}>
                    <td><span className={`rank${e.rank <= 3 ? ` r${e.rank}` : ''}`}>{e.rank}</span></td>
                    <td>
                      {e.username ? (
                        <Link href={`/brackets/${encodeURIComponent(e.username)}`} className="lb-name">{e.name}</Link>
                      ) : (
                        e.name
                      )}
                      {winner && <span className="pill gold btn-sm" style={{ marginLeft: 8, padding: '2px 9px' }}>{t('home.leaderBadge')}</span>}
                    </td>
                    <td className="num"><span className="score">{e.total}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      )}
    </main>
  );
}
