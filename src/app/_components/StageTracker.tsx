'use client';

import type { Round } from '@prisma/client';
import { teamName } from '@/lib/team-name';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';
import type { Stage } from '@/lib/tournament-stage';

const FULL: Record<Round, StringKey> = {
  R32: 'round.r32', R16: 'round.r16', QF: 'round.qf', SF: 'round.sf', FINAL: 'round.final',
};
const SHORT: Record<Round, StringKey> = {
  R32: 'round.r32Short', R16: 'round.r16Short', QF: 'round.qfShort', SF: 'round.sfShort', FINAL: 'round.finalShort',
};

export default function StageTracker({ stage }: { stage: Stage }) {
  const t = useT();

  const headline = stage.champion
    ? t('stage.champion', { team: teamName(stage.champion) })
    : !stage.started
      ? t('stage.notStarted')
      : t('stage.now', { round: t(FULL[stage.current ?? 'R32']) });

  return (
    <div className="stage reveal">
      <div className="stage-head">
        <span className="eyebrow">{t('stage.eyebrow')}</span>
        <span className="stage-now">{headline}</span>
      </div>
      <ol className="stage-steps">
        {stage.rounds.map((r) => (
          <li key={r.round} className={`stage-step ${r.status}`}>
            <span className="stage-dot" aria-hidden />
            <span className="stage-name">{t(SHORT[r.round])}</span>
            <span className="stage-count">{r.status === 'upcoming' ? '' : `${r.decided}/${r.total}`}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
