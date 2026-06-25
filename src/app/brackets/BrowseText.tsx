'use client';
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
  return (
    <>
      {view.brackets.length === 0 ? (
        <p className="muted">{t('browse.noApproved')}</p>
      ) : (
        view.brackets.map((b) => (
          <section key={b.id} className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <h2>{b.name}</h2>
              <span className="pill">{view.isOwner ? t('browse.ptsYours', { n: b.total }) : t('browse.pts', { n: b.total })}</span>
            </div>
            <MarchMadnessBracket slots={b.slots} />
          </section>
        ))
      )}
    </>
  );
}
