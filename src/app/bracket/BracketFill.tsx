'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyPick, bracketComplete, contestantsForSlot, type Picks, type OfficialR32 } from '@/lib/bracket-picks';
import { stalePicks } from '@/lib/bracket-changes';
import { formatMatchDate } from '@/lib/match-date';
import { saveBracket } from '@/app/actions/bracket-entry';
import BracketLayout from '@/app/_components/BracketLayout';
import BracketCard from '@/app/_components/BracketCard';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';

export default function BracketFill({
  bracketId,
  officialR32,
  initialPicks,
  official,
  locked,
  dates,
}: {
  bracketId: string;
  officialR32: OfficialR32;
  initialPicks: Picks;
  official?: boolean;
  locked: boolean;
  dates?: Record<number, string | null>;
}) {
  const t = useT();
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [error, setError] = useState<StringKey | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const complete = useMemo(() => bracketComplete(picks), [picks]);
  const made = useMemo(() => Object.keys(picks).length, [picks]);
  const stale = useMemo(() => new Set(stalePicks(officialR32, picks)), [officialR32, picks]);

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
      if (res?.errorKey) setError(res.errorKey);
      else setOk(true);
    });
  }

  function card(slot: number) {
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
    return (
      <BracketCard
        teamA={teamA}
        teamB={teamB}
        highlight={picks[slot] ?? null}
        stale={stale.has(slot)}
        dateLabel={formatMatchDate(dates?.[slot])}
        isFinal={slot === 31}
        disabled={locked}
        onPick={(team) => pick(slot, team)}
      />
    );
  }

  return (
    <div>
      {official && <p className="banner info" style={{ marginBottom: 12 }}>{t('bracket.officialThis')}</p>}
      {stale.size > 0 && (
        <p className="banner error" style={{ marginBottom: 12 }}>{t('bracket.changesWarn', { n: stale.size })}</p>
      )}

      <BracketLayout render={(slot) => card(slot)} />

      {!locked && (
        <div className="savebar">
          <button type="button" disabled={pending} onClick={save}>
            {pending ? t('bracket.saving') : complete ? t('bracket.save') : t('bracket.savePartial')}
          </button>
          {!complete && <span className="muted">{t('bracket.pickEvery', { made })}</span>}
          {ok && <span className="banner ok" style={{ padding: '6px 12px' }}>{t('bracket.saved')}</span>}
          {error && <span className="banner error" style={{ padding: '6px 12px' }}>{t(error)}</span>}
        </div>
      )}
      {locked && <p className="banner info" style={{ marginTop: 12 }}>{t('bracket.lockedFinal')}</p>}
    </div>
  );
}
