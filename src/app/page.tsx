import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { formatLockTimePT } from '@/lib/lock';
import Countdown from '@/app/_components/Countdown';

export const dynamic = 'force-dynamic';

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  const [{ lockTimeIso }, board] = await Promise.all([getOfficialBracket(), getLeaderboard()]);
  const lockLabel = lockTimeIso ? formatLockTimePT(new Date(lockTimeIso)) : null;

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 26 }}>
        <p className="eyebrow">World Cup 2026 · Knockout Pool</p>
        <h1>Knockout Bracket</h1>
        <p className="lead">
          {session?.user
            ? `Welcome back, ${session.user.name}. Fill your bracket before lock and climb the board.`
            : 'Predict every knockout game from the Round of 32 to the Final. Request an account to join the pool.'}
        </p>
        <Countdown lockTimeIso={lockTimeIso} lockLabel={lockLabel} />
      </header>

      <section className="panel reveal reveal-2">
        <div className="panel-head">
          <h2>Leaderboard</h2>
          <span className="pill gold">
            Pot {dollars(board.potCents)}
            {board.winnerKeys.length > 0 && board.shareCents > 0 && (
              <> · {board.winnerKeys.length === 1 ? 'leader takes' : `${board.winnerKeys.length}-way split`} {dollars(board.shareCents)}</>
            )}
          </span>
        </div>
        {board.entries.length === 0 ? (
          <p className="muted">No brackets submitted yet — be the first.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 56 }}>Rank</th>
                <th>Player</th>
                <th className="num">Points</th>
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
                      {winner && <span className="pill gold btn-sm" style={{ marginLeft: 8, padding: '2px 9px' }}>🏆 leader</span>}
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
