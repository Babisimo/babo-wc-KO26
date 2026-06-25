'use client';
import { useState } from 'react';
import Link from 'next/link';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';
import { useT } from '@/app/_components/LangProvider';
import type { BracketsIndex, UserBracketView } from '@/app/actions/browse';

export function BrowseTitle() {
  const t = useT();
  return <h1>{t('browse.title')}</h1>;
}

export function IndexBody({ index }: { index: BracketsIndex }) {
  const t = useT();
  if (!index.locked) return <div className="panel"><p className="muted">{t('browse.private')}</p></div>;
  if (index.entries.length === 0) return <p className="muted">{t('browse.none')}</p>;
  return (
    <div className="panel">
      <table>
        <thead><tr><th>#</th><th>{t('browse.player')}</th><th>{t('browse.count')}</th><th style={{ textAlign: 'right' }}>{t('browse.best')}</th></tr></thead>
        <tbody>
          {index.entries.map((e, i) => (
            <tr key={e.username}>
              <td className="muted">{i + 1}</td>
              <td><Link href={`/brackets/${encodeURIComponent(e.username)}`}>{e.name}</Link></td>
              <td className="muted">{e.count}</td>
              <td style={{ textAlign: 'right' }}>{e.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NoSuch() {
  const t = useT();
  return <p className="muted">{t('browse.noSuch')}</p>;
}

export function PrivateOne() {
  const t = useT();
  return (
    <div className="panel">
      <p className="muted">{t('browse.privateOne')}</p>
    </div>
  );
}

export function UserBody({ view }: { view: UserBracketView }) {
  const t = useT();
  const [sel, setSel] = useState(0);

  if (view.brackets.length === 0) {
    return <p className="muted">{t('browse.noApproved')}</p>;
  }

  const multi = view.brackets.length > 1;
  const b = view.brackets[sel] ?? view.brackets[0];
  const pts = (n: number) => (view.isOwner ? t('browse.ptsYours', { n }) : t('browse.pts', { n }));

  return (
    <>
      {multi && (
        <div className="bracket-switch">
          <label htmlFor="bracket-pick">{t('browse.pick')}</label>
          <select id="bracket-pick" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
            {view.brackets.map((bb, i) => (
              <option key={bb.id} value={i}>{bb.name} — {bb.total} pts</option>
            ))}
          </select>
        </div>
      )}
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h2>{b.name}</h2>
          <span className="pill">{pts(b.total)}</span>
        </div>
        <MarchMadnessBracket slots={b.slots} dates={view.dates} />
      </section>
    </>
  );
}
