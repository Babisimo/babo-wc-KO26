'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyPick, bracketComplete, contestantsForSlot, type Picks, type OfficialR32 } from '@/lib/bracket-picks';
import { slotsForRound } from '@/lib/bracket-structure';
import { teamName, teamColor } from '@/lib/team-name';
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
  const made = useMemo(() => Object.keys(picks).length, [picks]);

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
        className={`fill-team${selected ? ' sel' : ''}`}
        disabled={locked || !team}
        onClick={() => pick(slot, team)}
      >
        <span className="chip" style={{ background: teamColor(team) }} />
        <span>{teamName(team)}</span>
      </button>
    );
  }

  return (
    <div>
      {ROUNDS.map(({ round, label }) => (
        <section key={round} className="fill-round">
          <h3>{label}</h3>
          {slotsForRound(round).map((slot) => {
            const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
            return (
              <div key={slot} className="fill-match">
                <span className="fill-no">{slot}</span>
                {teamButton(slot, teamA)}
                {teamButton(slot, teamB)}
              </div>
            );
          })}
        </section>
      ))}

      {!locked && (
        <div className="savebar">
          <button type="button" disabled={pending || !complete} onClick={save}>
            {pending ? 'Saving…' : complete ? 'Save bracket' : `Pick every game (${made}/31)`}
          </button>
          {ok && <span className="banner ok" style={{ padding: '6px 12px' }}>Bracket saved ✓</span>}
          {error && <span className="banner error" style={{ padding: '6px 12px' }}>{error}</span>}
        </div>
      )}
      {locked && <p className="banner info" style={{ marginTop: 12 }}>Brackets are locked — picks are final.</p>}
    </div>
  );
}
