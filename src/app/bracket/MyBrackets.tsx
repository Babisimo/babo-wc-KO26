'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBracket, setBracketOfficial, type MyBracketRow } from '@/app/actions/bracket-entry';
import RenameControl from './RenameControl';
import BracketExportButton from './BracketExportButton';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';

export default function MyBrackets({
  brackets,
  locked,
  drawFinal,
  credits,
  officialUsed,
}: {
  brackets: MyBracketRow[];
  locked: boolean;
  drawFinal: boolean;
  credits: number;
  officialUsed: number;
}) {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState('');
  const [error, setError] = useState<StringKey | null>(null);
  const [pending, start] = useTransition();
  const officialAtCap = officialUsed >= credits;

  function add() {
    setError(null);
    start(async () => {
      const res = await createBracket(name);
      if (res?.errorKey) { setError(res.errorKey); return; }
      setName('');
      if (res.id) router.push(`/bracket/${res.id}`);
      else router.refresh();
    });
  }

  function toggleOfficial(id: string, next: boolean) {
    setError(null);
    start(async () => {
      const res = await setBracketOfficial(id, next);
      if (res?.errorKey) { setError(res.errorKey); return; }
      router.refresh();
    });
  }

  return (
    <div className="panel reveal reveal-2">
      <div className="panel-head">
        <h2>{t('bracket.entries')}</h2>
        <span className="pill">{t('bracket.officialOf', { used: officialUsed, credits })}</span>
      </div>

      {!locked && !drawFinal && (
        <p className="banner info" style={{ marginBottom: 12 }}>{t('bracket.drawPending')}</p>
      )}

      {brackets.length === 0 ? (
        <p className="muted">{t('bracket.none')}</p>
      ) : (
        <table>
          <thead><tr><th>{t('bracket.name')}</th><th></th><th></th></tr></thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id}>
                <td>
                  <RenameControl id={b.id} name={b.name} locked={locked}>
                    <Link href={`/bracket/${b.id}`}>{b.name}</Link>
                  </RenameControl>
                  {b.official && <span className="pill" style={{ marginLeft: 8 }}>{t('bracket.officialBadge')}</span>}
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    {b.complete ? t('bracket.statusComplete') : t('bracket.statusPartial')}
                  </span>
                  {b.staleCount > 0 && (
                    <span className="banner error" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}>
                      {t('bracket.changesBadge', { n: b.staleCount })}
                    </span>
                  )}
                </td>
                <td>
                  <Link href={`/bracket/${b.id}`} className="btn btn-sm">{t('bracket.edit')}</Link>
                  {' '}
                  <BracketExportButton id={b.id} name={b.name} complete={b.complete} />
                </td>
                <td>
                  {!locked && (
                    b.official ? (
                      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => toggleOfficial(b.id, false)}>
                        {t('bracket.unmarkOfficial')}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm" disabled={pending || officialAtCap} onClick={() => toggleOfficial(b.id, true)}>
                        {t('bracket.makeOfficial')}
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!locked && (
        <div className="savebar" style={{ marginTop: 14 }}>
          <input type="text" value={name} maxLength={32} placeholder={t('bracket.newPlaceholder')} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 240 }} />
          <button type="button" disabled={pending} onClick={add}>{pending ? t('bracket.working') : t('bracket.new')}</button>
        </div>
      )}
      {error && <p className="banner error" style={{ marginTop: 12 }}>{t(error)}</p>}
    </div>
  );
}
