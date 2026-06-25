'use client';

import { useMemo, useState } from 'react';
import type { Round } from '@prisma/client';
import { compareBrackets, type H2HReport, type H2HSlot } from '@/lib/head-to-head';
import { flagClass } from '@/lib/team-flag';
import { teamName } from '@/lib/team-name';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';
import type { CompareData } from '@/app/actions/compare';

type T = (key: StringKey, vars?: Record<string, string | number>) => string;

const ROUND_KEY: Record<Round, StringKey> = {
  R32: 'round.r32', R16: 'round.r16', QF: 'round.qf', SF: 'round.sf', FINAL: 'round.final',
};

function Pick({ code }: { code: string }) {
  const fc = flagClass(code);
  return (
    <span className="cmp-pick">
      {fc ? <span className={`fi ${fc} cmp-flag`} role="img" aria-label={teamName(code)} /> : <span className="cmp-flag cmp-flag-tbd" aria-hidden />}
      <b>{code}</b>
    </span>
  );
}

function MatchCard({ g, a, b, t }: { g: H2HSlot; a: string; b: string; t: T }) {
  return (
    <li className="cmp-card">
      <div className="cmp-card-head">
        <span className="cmp-round">{t(ROUND_KEY[g.round])}</span>
        <span className="cmp-worth">{t('compare.points', { n: g.points })}</span>
      </div>
      <div className="cmp-need cmp-need-a">
        <span className="cmp-need-lab">{t('compare.youNeed', { name: a })}</span>
        <Pick code={g.aPick} />
      </div>
      <div className="cmp-need cmp-need-b">
        <span className="cmp-need-lab">{t('compare.youNeed', { name: b })}</span>
        <Pick code={g.bPick} />
      </div>
    </li>
  );
}

function Report({ report, t }: { report: H2HReport; t: T }) {
  const { a, b, aNow, bNow, gap, leader, trailer, settled, remaining, remainingValue, needNet, canCatch, identical } = report;
  const settledShown = settled.aWon + settled.bWon > 0;

  return (
    <section className="cmp-report">
      <p className="cmp-headline">
        {leader && trailer
          ? t('compare.leadBy', { leader, trailer, n: Math.abs(gap) })
          : t('compare.tied', { a, b })}
      </p>
      <p className="cmp-now">{t('compare.now', { a, an: aNow, b, bn: bNow })}</p>

      {trailer && remaining.length > 0 && (
        <p className="cmp-path">
          {canCatch
            ? t('compare.path', { trailer, need: needNet, value: remainingValue, total: remaining.length })
            : t('compare.pathImpossible', { trailer, need: needNet, value: remainingValue })}
        </p>
      )}

      {settledShown && (
        <p className="cmp-settled">{t('compare.settled', { a, an: settled.aWon, b, bn: settled.bWon })}</p>
      )}

      {identical ? (
        <p className="cmp-msg">{t('compare.identical')}</p>
      ) : (
        <>
          <p className="cmp-section-lab">{t('compare.remainingTitle')}</p>
          <ul className="cmp-list">
            {remaining.map((g) => <MatchCard key={g.slot} g={g} a={a} b={b} t={t} />)}
          </ul>
        </>
      )}
    </section>
  );
}

export default function CompareView({ data }: { data: CompareData }) {
  const t = useT();
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');

  const byId = useMemo(() => new Map(data.brackets.map((x) => [x.id, x])), [data.brackets]);
  const report = useMemo(() => {
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b || aId === bId) return null;
    return compareBrackets(a, b, data.winners);
  }, [byId, aId, bId, data.winners]);

  return (
    <>
      <header style={{ marginBottom: 22 }}>
        <p className="eyebrow">{t('compare.eyebrow')}</p>
        <h1>{t('compare.title1')} <span style={{ color: 'var(--gold)' }}>{t('compare.title2')}</span></h1>
        <p className="lead">{t('compare.intro')}</p>
      </header>

      {!data.locked ? (
        <div className="panel"><p className="muted">{t('compare.locked')}</p></div>
      ) : (
        <>
          <div className="cmp-pickers">
            <label className="cmp-picker">
              <span>{t('compare.pickA')}</span>
              <select value={aId} onChange={(e) => setAId(e.target.value)}>
                <option value="">{t('compare.choose')}</option>
                {data.brackets.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
            <span className="cmp-vs">{t('compare.vs')}</span>
            <label className="cmp-picker">
              <span>{t('compare.pickB')}</span>
              <select value={bId} onChange={(e) => setBId(e.target.value)}>
                <option value="">{t('compare.choose')}</option>
                {data.brackets.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
          </div>

          {aId && bId && aId === bId && <p className="cmp-msg">{t('compare.samePlayer')}</p>}
          {(!aId || !bId) && <p className="cmp-msg">{t('compare.pickPrompt')}</p>}
          {report && <Report report={report} t={t} />}
        </>
      )}
    </>
  );
}
