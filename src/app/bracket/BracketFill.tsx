'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyPick, bracketComplete, contestantsForSlot, type Picks, type OfficialR32 } from '@/lib/bracket-picks';
import { teamName, teamColor } from '@/lib/team-name';
import { saveBracket } from '@/app/actions/bracket-entry';

// Same two-sided geometry as the read-only MarchMadnessBracket.
const LEFT_COLS = [
  { label: 'Round of 32', slots: [1, 2, 3, 4, 5, 6, 7, 8], cls: 'r32' },
  { label: 'Round of 16', slots: [17, 18, 19, 20], cls: '' },
  { label: 'Quarters', slots: [25, 26], cls: '' },
  { label: 'Semifinal', slots: [29], cls: '' },
];
const RIGHT_COLS = [
  { label: 'Semifinal', slots: [30], cls: '' },
  { label: 'Quarters', slots: [27, 28], cls: '' },
  { label: 'Round of 16', slots: [21, 22, 23, 24], cls: '' },
  { label: 'Round of 32', slots: [9, 10, 11, 12, 13, 14, 15, 16], cls: 'r32' },
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

  function teamBtn(slot: number, team: string | null) {
    const selected = team !== null && picks[slot] === team;
    return (
      <button
        type="button"
        className={`mm-btn${selected ? ' sel' : ''}`}
        disabled={locked || !team}
        onClick={() => pick(slot, team)}
      >
        <span className="chip" style={{ background: teamColor(team) }} />
        <span className="nm">{teamName(team)}</span>
      </button>
    );
  }

  function matchCard(slot: number) {
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
    return (
      <div key={slot} className="mm-match">
        {teamBtn(slot, teamA)}
        {teamBtn(slot, teamB)}
      </div>
    );
  }

  function column(col: { label: string; slots: number[]; cls: string }, keyPrefix: string) {
    return (
      <div className={`mm-col ${col.cls}`} key={keyPrefix + col.label}>
        <h4>{col.label}</h4>
        {col.slots.map((slot) => matchCard(slot))}
      </div>
    );
  }

  return (
    <div>
      <div className="mm">
        {LEFT_COLS.map((c) => column(c, 'L'))}
        <div className="mm-final">
          <h4>Final</h4>
          {matchCard(31)}
          <div className="trophy">🏆</div>
        </div>
        {RIGHT_COLS.map((c) => column(c, 'R'))}
      </div>

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
