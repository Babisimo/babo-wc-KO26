'use client';

import { flagClass } from '@/lib/team-flag';
import { teamName } from '@/lib/team-name';
import { useT } from '@/app/_components/LangProvider';

function Flag({ code }: { code: string | null }) {
  const fc = flagClass(code);
  if (!fc) return <span className="bcard-flag bcard-flag-tbd" aria-hidden />;
  return <span className={`fi ${fc} bcard-flag`} role="img" aria-label={teamName(code)} />;
}

export type BracketCardProps = {
  teamA: string | null;
  teamB: string | null;
  /** Code to emphasize — the official winner (read-only) or the user's pick (interactive). */
  highlight?: string | null;
  /** Ring color for read-only scored views. */
  status?: 'correct' | 'wrong' | 'pending';
  /** Flag a card whose saved pick no longer matches its current matchup — needs review. */
  stale?: boolean;
  dateLabel?: string | null;
  isFinal?: boolean;
  disabled?: boolean;
  /** When provided, the two halves become tappable pick buttons. */
  onPick?: (team: string) => void;
  /** Global eliminated-team -> eliminator map; strikes matching teams and shows a badge. */
  eliminatedBy?: Record<string, string>;
};

export default function BracketCard({
  teamA,
  teamB,
  highlight,
  status,
  stale,
  dateLabel,
  isFinal,
  disabled,
  onPick,
  eliminatedBy,
}: BracketCardProps) {
  const interactive = typeof onPick === 'function';
  const t = useT();

  function side(code: string | null) {
    const sel = code != null && code === highlight;
    const elimBy = code != null ? (eliminatedBy?.[code] ?? null) : null;
    const cls = `bcard-team${sel ? ' sel' : ''}${elimBy ? ' elim' : ''}`;
    const body = (
      <>
        <Flag code={code} />
        {/* compact code in the dense tree; CSS swaps to the full name in the big mobile tab cards */}
        <span className="bcard-code">{code ?? 'TBD'}</span>
        <span className="bcard-name">{code ? teamName(code) : 'TBD'}</span>
        {elimBy && (
          <span
            className="bcard-elimby"
            title={t('bracket.eliminatedBy', { team: code!, by: elimBy })}
            aria-label={t('bracket.eliminatedBy', { team: code!, by: elimBy })}
          >
            <span aria-hidden>▸</span>
            <span className={`fi ${flagClass(elimBy) ?? ''} bcard-elimby-flag`} aria-hidden />
            {elimBy}
          </span>
        )}
      </>
    );
    if (interactive) {
      return (
        <button
          type="button"
          className={cls}
          disabled={disabled || code == null}
          onClick={() => code && onPick!(code)}
        >
          {body}
        </button>
      );
    }
    return <div className={cls}>{body}</div>;
  }

  const statusCls = status === 'correct' ? ' correct' : status === 'wrong' ? ' wrong' : '';
  return (
    <div className={`bcard${isFinal ? ' final' : ''}${statusCls}${stale ? ' stale' : ''}`}>
      <div className="bcard-teams">
        {side(teamA)}
        {side(teamB)}
      </div>
      {dateLabel && <div className="bcard-date">{dateLabel}</div>}
    </div>
  );
}
