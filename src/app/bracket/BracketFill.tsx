'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyPick, bracketComplete, contestantsForSlot, type Picks, type OfficialR32 } from '@/lib/bracket-picks';
import { teamName } from '@/lib/team-name';
import TeamFlag from '@/app/_components/TeamFlag';
import { saveBracket } from '@/app/actions/bracket-entry';
import BracketLayout from '@/app/_components/BracketLayout';
import { useT } from '@/app/_components/LangProvider';

export default function BracketFill({
  bracketId,
  officialR32,
  initialPicks,
  locked,
}: {
  bracketId: string;
  officialR32: OfficialR32;
  initialPicks: Picks;
  locked: boolean;
}) {
  const t = useT();
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
      const res = await saveBracket(bracketId, picks);
      if (res?.error) setError(res.error);
      else setOk(true);
    });
  }

  function teamBtn(slot: number, team: string | null) {
    const selected = team !== null && picks[slot] === team;
    return (
      <button
        type="button"
        className={`fm-btn${selected ? ' sel' : ''}`}
        disabled={locked || !team}
        onClick={() => pick(slot, team)}
      >
        <TeamFlag code={team} />
        <span className="fm-nm">{teamName(team)}</span>
      </button>
    );
  }

  function card(slot: number) {
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
    return (
      <div className="fm-match">
        {teamBtn(slot, teamA)}
        {teamBtn(slot, teamB)}
      </div>
    );
  }

  return (
    <div>
      <BracketLayout render={(slot) => card(slot)} />

      {!locked && (
        <div className="savebar">
          <button type="button" disabled={pending || !complete} onClick={save}>
            {pending ? t('bracket.saving') : complete ? t('bracket.save') : t('bracket.pickEvery', { made })}
          </button>
          {ok && <span className="banner ok" style={{ padding: '6px 12px' }}>{t('bracket.saved')}</span>}
          {error && <span className="banner error" style={{ padding: '6px 12px' }}>{error}</span>}
        </div>
      )}
      {locked && <p className="banner info" style={{ marginTop: 12 }}>{t('bracket.lockedFinal')}</p>}
    </div>
  );
}
