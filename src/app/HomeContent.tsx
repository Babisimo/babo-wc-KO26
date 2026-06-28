'use client';

import Link from 'next/link';
import ChampionBanner from '@/app/_components/ChampionBanner';
import LockGate from '@/app/_components/LockGate';
import { useT } from '@/app/_components/LangProvider';
import type { LeaderboardData } from '@/app/actions/leaderboard';
import type { getNextGames } from '@/app/actions/next-games';

function dollars(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }

type NextGamesData = Awaited<ReturnType<typeof getNextGames>>;

export default function HomeContent({
  signedIn, board, nextGames, standing,
}: {
  signedIn: boolean;
  board: LeaderboardData;
  nextGames: NextGamesData;
  standing: { rank: number; total: number } | null;
}) {
  const t = useT();
  return (
    <main className="shell">
      <ChampionBanner champions={board.champions} />
      <header className="reveal" style={{ marginBottom: 18 }}>
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1>{t('home.title')}</h1>
        {standing && (
          <p className="lead">{t('home.youStanding', { rank: standing.rank, points: standing.total })}</p>
        )}
      </header>

      <LockGate
        data={nextGames}
        preLock={signedIn ? (
          <section className="cta reveal" style={{ marginBottom: 18 }}>
            <div className="cta-text">
              <p className="eyebrow">{t('home.playEyebrow')}</p>
              <h2>{t('home.playTitle')}</h2>
              <p className="muted">{t('home.playLead')}</p>
            </div>
            <div className="cta-actions">
              <Link href="/bracket" className="btn">{t('home.playCta')}</Link>
            </div>
          </section>
        ) : undefined}
      />

      {!signedIn && (
        <section className="cta reveal" style={{ marginTop: 4, marginBottom: 18 }}>
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
              <thead><tr>
                <th style={{ width: 56 }}>{t('home.rank')}</th>
                <th>{t('home.player')}</th>
                <th className="num">{t('home.points')}</th>
              </tr></thead>
              <tbody>
                {board.entries.map((e) => {
                  const winner = board.winnerKeys.includes(e.key);
                  return (
                    <tr key={e.key} className={e.username ? 'row-link' : undefined}>
                      <td><span className={`rank${e.rank <= 3 ? ` r${e.rank}` : ''}`}>{e.rank}</span></td>
                      <td>
                        {e.username
                          ? <Link href={`/brackets/${encodeURIComponent(e.username)}`} className="lb-name">{e.name}</Link>
                          : e.name}
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
