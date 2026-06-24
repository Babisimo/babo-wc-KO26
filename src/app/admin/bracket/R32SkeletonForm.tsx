'use client';

import { useState, useTransition } from 'react';
import { setR32Skeleton, type R32Entry } from '@/app/actions/bracket';

type Team = { code: string; name: string };

type Row = { teamA: string; teamB: string; kickoff: string };

export default function R32SkeletonForm({
  teams,
  initial,
}: {
  teams: Team[];
  initial: Row[]; // length 16, slot i+1
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit() {
    setError(null);
    setOk(false);
    const entries: R32Entry[] = rows.map((r, i) => ({
      slot: i + 1,
      teamA: r.teamA,
      teamB: r.teamB,
      kickoff: r.kickoff ? new Date(r.kickoff).toISOString() : null,
    }));
    start(async () => {
      const res = await setR32Skeleton(entries);
      if (res?.error) setError(res.error);
      else setOk(true);
    });
  }

  return (
    <div>
      <table>
        <thead>
          <tr><th>R32</th><th>Team A</th><th>Team B</th><th>Kickoff (local)</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <select value={r.teamA} onChange={(e) => update(i, { teamA: e.target.value })}>
                  <option value="">—</option>
                  {teams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </td>
              <td>
                <select value={r.teamB} onChange={(e) => update(i, { teamB: e.target.value })}>
                  <option value="">—</option>
                  {teams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </td>
              <td>
                <input
                  type="datetime-local"
                  value={r.kickoff}
                  onChange={(e) => update(i, { kickoff: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p style={{ color: '#ff8080' }}>{error}</p>}
      {ok && <p style={{ color: 'var(--accent)' }}>Saved.</p>}
      <button disabled={pending} onClick={submit}>{pending ? 'Saving…' : 'Save R32 skeleton'}</button>
    </div>
  );
}
