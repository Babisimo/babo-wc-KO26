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
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>WC26 Knockout Bracket</h1>
      {session?.user ? (
        <p>Welcome, {session.user.name}.</p>
      ) : (
        <p>Request an account to join the pool.</p>
      )}
      <Countdown lockTimeIso={lockTimeIso} lockLabel={lockLabel} />

      <section style={{ marginTop: 24 }}>
        <h2>Leaderboard</h2>
        <p style={{ opacity: 0.7 }}>
          Pot: {dollars(board.potCents)}
          {board.winnerKeys.length > 0 && board.shareCents > 0 && (
            <> &mdash; {board.winnerKeys.length === 1 ? 'leader takes' : `${board.winnerKeys.length} leaders split`} {dollars(board.shareCents)} each</>
          )}
        </p>
        {board.entries.length === 0 ? (
          <p>No brackets submitted yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>#</th><th style={{ textAlign: 'left' }}>Player</th><th style={{ textAlign: 'right' }}>Points</th></tr>
            </thead>
            <tbody>
              {board.entries.map((e) => (
                <tr key={e.key} style={{ borderTop: '1px solid #ffffff22' }}>
                  <td>{e.rank}</td>
                  <td>{e.name}{board.winnerKeys.includes(e.key) ? ' 🏆' : ''}</td>
                  <td style={{ textAlign: 'right' }}>{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
