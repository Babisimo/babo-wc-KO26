'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBracket, deleteBracket, type MyBracketRow } from '@/app/actions/bracket-entry';

function badge(status: MyBracketRow['status']) {
  const cls = status === 'APPROVED' ? 'ok' : status === 'REJECTED' ? 'bad' : 'warn';
  return <span className={`badge ${cls}`}>{status.toLowerCase()}</span>;
}

export default function MyBrackets({ brackets, locked }: { brackets: MyBracketRow[]; locked: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      const res = await createBracket(name);
      if (res?.error) { setError(res.error); return; }
      setName('');
      if (res.id) router.push(`/bracket/${res.id}`);
      else router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const res = await deleteBracket(id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="panel reveal reveal-2">
      {brackets.length === 0 ? (
        <p className="muted">No brackets yet — create your first below.</p>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/bracket/${b.id}`}>{b.name}</Link></td>
                <td>{badge(b.status)}</td>
                <td>
                  <div className="row-actions">
                    <Link href={`/bracket/${b.id}`} className="btn btn-sm">Edit</Link>
                    {b.status !== 'APPROVED' && !locked && (
                      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => remove(b.id)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!locked && (
        <div className="savebar" style={{ marginTop: 14 }}>
          <input
            type="text"
            value={name}
            maxLength={32}
            placeholder="New bracket name (optional)"
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button type="button" disabled={pending} onClick={add}>{pending ? 'Working…' : '+ New bracket'}</button>
        </div>
      )}
      {error && <p className="banner error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
