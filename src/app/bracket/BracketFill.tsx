'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyPick, bracketComplete, contestantsForSlot, type Picks, type OfficialR32 } from '@/lib/bracket-picks';
import { slotsForRound } from '@/lib/bracket-structure';
import type { Round } from '@prisma/client';
import { saveBracket } from '@/app/actions/bracket-entry';

const ROUNDS: { round: Round; label: string }[] = [
  { round: 'R32', label: 'Round of 32' },
  { round: 'R16', label: 'Round of 16' },
  { round: 'QF', label: 'Quarterfinals' },
  { round: 'SF', label: 'Semifinals' },
  { round: 'FINAL', label: 'Final' },
];

export default function BracketFill({
  officialR32,
  initialPicks,
  locked,
}: {
  officialR32: OfficialR32;
  initialPicks: Picks;
  locked: boolean;
}) {
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const complete = useMemo(() => bracketComplete(picks), [picks]);

  function pick(slot: number, team: string | null) {
    if (locked || !team) return;
    setOk(false);
    setError(null);
    setPicks((prev) => applyPick(officialR32, prev, slot, team));
  }

  function save() {
    setError(null);
    setOk(false);
    start(async () => {
      const res = await saveBracket(picks);
      if (res?.error) setError(res.error);
      else setOk(true);
    });
  }

  function teamButton(slot: number, team: string | null) {
    const selected = team !== null && picks[slot] === team;
    return (
      <button
        type="button"
        disabled={locked || !team}
        onClick={() => pick(slot, team)}
        style={{
          minWidth: 90,
          padding: '4px 8px',
          fontWeight: selected ? 700 : 400,
          background: selected ? 'var(--accent)' : 'transparent',
          color: selected ? '#06210f' : 'var(--line)',
          border: '1px solid #ffffff33',
          borderRadius: 6,
        }}
      >
        {team ?? '—'}
      </button>
    );
  }

  return (
    <div>
      {ROUNDS.map(({ round, label }) => (
        <section key={round} style={{ marginBottom: 16 }}>
          <h3>{label}</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {slotsForRound(round).map((slot) => {
              const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
              return (
                <div key={slot} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ opacity: 0.6, width: 28 }}>#{slot}</span>
                  {teamButton(slot, teamA)}
                  <span style={{ opacity: 0.5 }}>vs</span>
                  {teamButton(slot, teamB)}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {error && <p style={{ color: '#ff8080' }}>{error}</p>}
      {ok && <p style={{ color: 'var(--accent)' }}>Bracket saved.</p>}
      {!locked && (
        <button type="button" disabled={pending || !complete} onClick={save}>
          {pending ? 'Saving…' : complete ? 'Save bracket' : 'Pick every game to save'}
        </button>
      )}
      {locked && <p><strong>Brackets are locked.</strong></p>}
    </div>
  );
}
