'use client';

import { useState, useTransition } from 'react';
import { setMatchWinner, refreshResults, setPot } from '@/app/actions/results';
import { teamName, teamColor } from '@/lib/team-name';

type SlotRow = { slot: number; round: string; teamA: string | null; teamB: string | null; winner: string | null };

export default function ResultsPanel({
  slots,
  potDollars,
}: {
  slots: SlotRow[];
  potDollars: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pot, setPotValue] = useState<string>(String(potDollars));

  function run(action: () => Promise<{ error?: string; updated?: number }>) {
    setMsg(null);
    start(async () => {
      const res = await action();
      if (res?.error) setMsg({ kind: 'error', text: res.error });
      else if (typeof res?.updated === 'number') setMsg({ kind: 'ok', text: `Updated ${res.updated} game(s) from the feed.` });
      else setMsg({ kind: 'ok', text: 'Saved.' });
    });
  }

  function winnerButton(slot: number, team: string | null, current: string | null) {
    const selected = team !== null && current === team;
    return (
      <button
        type="button"
        className={`btn-ghost btn-sm${selected ? ' is-on' : ''}`}
        disabled={pending || !team}
        onClick={() => run(() => setMatchWinner(slot, team))}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <span className="chip" style={{ background: teamColor(team), width: 9, height: 9 }} />
        {teamName(team)}
      </button>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" disabled={pending} onClick={() => run(refreshResults)}>
          {pending ? 'Working…' : 'Refresh from feed'}
        </button>
        <span style={{ width: 1, height: 22, background: 'var(--chalk)' }} />
        <label htmlFor="pot" style={{ margin: 0 }}>Pot ($)</label>
        <input id="pot" type="number" step="0.01" min="0" value={pot} onChange={(e) => setPotValue(e.target.value)} style={{ width: 110 }} />
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setPot(Number(pot)))}>Set pot</button>
      </div>

      {msg && <p className={`banner ${msg.kind === 'ok' ? 'ok' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</p>}

      <div style={{ display: 'grid', gap: 8 }}>
        {slots.map((s) => (
          <div key={s.slot} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted" style={{ width: 78, fontSize: '0.78rem' }}>{s.round} · {s.slot}</span>
            {winnerButton(s.slot, s.teamA, s.winner)}
            <span className="faint">vs</span>
            {winnerButton(s.slot, s.teamB, s.winner)}
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={pending || !s.winner}
              onClick={() => run(() => setMatchWinner(s.slot, null))}
              style={{ marginLeft: 4 }}
            >
              clear
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
