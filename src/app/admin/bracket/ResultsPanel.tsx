'use client';

import { useState, useTransition } from 'react';
import { setMatchWinner, refreshResults, setPot } from '@/app/actions/results';

type SlotRow = { slot: number; round: string; teamA: string | null; teamB: string | null; winner: string | null };

export default function ResultsPanel({
  slots,
  potDollars,
}: {
  slots: SlotRow[];
  potDollars: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [pot, setPotValue] = useState<string>(String(potDollars));

  function run(action: () => Promise<{ error?: string; updated?: number }>) {
    setMsg(null);
    start(async () => {
      const res = await action();
      if (res?.error) setMsg(res.error);
      else if (typeof res?.updated === 'number') setMsg(`Updated ${res.updated} game(s) from feed.`);
      else setMsg('Saved.');
    });
  }

  function winnerButton(slot: number, team: string | null, current: string | null) {
    const selected = team !== null && current === team;
    return (
      <button
        type="button"
        disabled={pending || !team}
        onClick={() => run(() => setMatchWinner(slot, team))}
        style={{
          minWidth: 80,
          fontWeight: selected ? 700 : 400,
          background: selected ? 'var(--accent)' : 'transparent',
          color: selected ? '#06210f' : 'var(--line)',
          border: '1px solid #ffffff33',
          borderRadius: 6,
          padding: '4px 8px',
        }}
      >
        {team ?? '—'}
      </button>
    );
  }

  return (
    <section>
      <h2>Results</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button type="button" disabled={pending} onClick={() => run(refreshResults)}>
          {pending ? 'Working…' : 'Refresh from feed'}
        </button>
        <input
          type="number"
          step="0.01"
          min="0"
          value={pot}
          onChange={(e) => setPotValue(e.target.value)}
          style={{ width: 120 }}
        />
        <button type="button" disabled={pending} onClick={() => run(() => setPot(Number(pot)))}>
          Set pot ($)
        </button>
      </div>
      {msg && <p style={{ color: 'var(--accent)' }}>{msg}</p>}
      <div style={{ display: 'grid', gap: 6 }}>
        {slots.map((s) => (
          <div key={s.slot} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ opacity: 0.6, width: 70 }}>{s.round} #{s.slot}</span>
            {winnerButton(s.slot, s.teamA, s.winner)}
            <span style={{ opacity: 0.5 }}>vs</span>
            {winnerButton(s.slot, s.teamB, s.winner)}
            <button
              type="button"
              disabled={pending || !s.winner}
              onClick={() => run(() => setMatchWinner(s.slot, null))}
              style={{ marginLeft: 8, opacity: 0.7 }}
            >
              clear
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
