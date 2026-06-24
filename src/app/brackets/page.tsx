import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getBracketsIndex } from '@/app/actions/browse';

export const dynamic = 'force-dynamic';

export default async function BracketsPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const index = await getBracketsIndex();

  return (
    <main className="shell">
      <h1>Brackets</h1>
      {!index.locked ? (
        <div className="panel">
          <p className="muted">Everyone&apos;s brackets stay private until they lock (one hour before the first Round-of-32 kickoff). Check back after lock to see how everyone picked.</p>
        </div>
      ) : index.entries.length === 0 ? (
        <p className="muted">No brackets were submitted.</p>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr><th>#</th><th>Player</th><th style={{ textAlign: 'right' }}>Points</th></tr>
            </thead>
            <tbody>
              {index.entries.map((e, i) => (
                <tr key={e.username}>
                  <td className="muted">{i + 1}</td>
                  <td><Link href={`/brackets/${encodeURIComponent(e.username)}`}>{e.name}</Link></td>
                  <td style={{ textAlign: 'right' }}>{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
