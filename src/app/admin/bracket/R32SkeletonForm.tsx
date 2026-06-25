'use client';

import { useState, useEffect, useTransition } from 'react';
import { setR32Skeleton, type R32Entry } from '@/app/actions/bracket';
import { isoToLocalInput, localInputToIso } from '@/lib/datetime-local';

type Team = { code: string; name: string };

type Row = { teamA: string; teamB: string; kickoff: string };

export default function R32SkeletonForm({
  teams,
  initial,
}: {
  teams: Team[];
  initial: { teamA: string; teamB: string; kickoffIso: string }[]; // length 16, slot i+1
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.map((r) => ({ teamA: r.teamA, teamB: r.teamB, kickoff: '' }))
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    setRows((prev) =>
      prev.map((r, i) => ({ ...r, kickoff: isoToLocalInput(initial[i].kickoffIso) }))
    );
    // Seed local datetime values once on mount (browser timezone); `initial` is a
    // stable prefill from the server and intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      kickoff: localInputToIso(r.kickoff),
    }));
    start(async () => {
      const res = await setR32Skeleton(entries);
      if (res?.error) setError(res.error);
      else setOk(true);
    });
  }

  return (
    <div>
      <table className="adm-table">
        <thead>
          <tr><th>R32</th><th>Team A</th><th>Team B</th><th>Kickoff (local)</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td data-label="Game">{i + 1}</td>
              <td data-label="Team A">
                <select value={r.teamA} onChange={(e) => update(i, { teamA: e.target.value })}>
                  <option value="">—</option>
                  {teams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </td>
              <td data-label="Team B">
                <select value={r.teamB} onChange={(e) => update(i, { teamB: e.target.value })}>
                  <option value="">—</option>
                  {teams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </td>
              <td data-label="Kickoff">
                <input
                  type="datetime-local"
                  value={r.kickoff}
                  onChange={(e) => update(i, { kickoff: e.target.value })}
                  style={{ width: '100%', maxWidth: 240 }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="savebar" style={{ position: 'static', background: 'none', paddingBottom: 0 }}>
        <button disabled={pending} onClick={submit}>{pending ? 'Saving…' : 'Save Round-of-32'}</button>
        {ok && <span className="banner ok" style={{ padding: '6px 12px' }}>Saved ✓</span>}
        {error && <span className="banner error" style={{ padding: '6px 12px' }}>{error}</span>}
      </div>
    </div>
  );
}
