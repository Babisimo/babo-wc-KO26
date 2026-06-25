'use client';

import Countdown from '@/app/_components/Countdown';
import { useT } from '@/app/_components/LangProvider';
import type { LeaderboardData } from '@/app/actions/leaderboard';

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function HomeContent({
  userName,
  board,
  lockTimeIso,
  lockLabel,
}: {
  userName: string | null;
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
        <Countdown lockTimeIso={lockTimeIso} lockLabel={lockLabel} />
      </header>

      <section className="panel reveal reveal-2">
        <div className="panel-head">
          <h2>{t('home.leaderboard')}</h2>
          <span className="pill gold">
            {t('home.pot', { amount: dollars(board.potCents) })}
            <span className="muted" style={{ fontWeight: 500 }}>· {board.players} × {dollars(board.entryCents)}</span>
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
                  <tr key={e.key}>
                    <td><span className={`rank${e.rank <= 3 ? ` r${e.rank}` : ''}`}>{e.rank}</span></td>
                    <td>
                      {e.name}
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
    </main>
  );
}
