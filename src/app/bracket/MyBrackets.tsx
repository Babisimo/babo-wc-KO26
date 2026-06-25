'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBracket, type MyBracketRow } from '@/app/actions/bracket-entry';
import { useT } from '@/app/_components/LangProvider';

export default function MyBrackets({
  brackets,
  locked,
  credits,
  used,
}: {
  brackets: MyBracketRow[];
  locked: boolean;
  credits: number;
  used: number;
}) {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const atCap = used >= credits;

  function add() {
    setError(null);
    start(async () => {
      const res = await createBracket(name);
      if (res?.error) { setError(res.error); return; }
      setName('');
      if (res.id) router.push(`/bracket/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="panel reveal reveal-2">
      <div className="panel-head">
        <h2>{t('bracket.entries')}</h2>
        <span className="pill">{t('bracket.usedOf', { used, credits })}</span>
      </div>

      {brackets.length === 0 ? (
        <p className="muted">{t('bracket.none')}</p>
      ) : (
        <table>
          <thead><tr><th>{t('bracket.name')}</th><th></th></tr></thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/bracket/${b.id}`}>{b.name}</Link></td>
                <td><Link href={`/bracket/${b.id}`} className="btn btn-sm">{t('bracket.edit')}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!locked && !atCap && (
        <div className="savebar" style={{ marginTop: 14 }}>
          <input type="text" value={name} maxLength={32} placeholder={t('bracket.newPlaceholder')} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 240 }} />
          <button type="button" disabled={pending} onClick={add}>{pending ? t('bracket.working') : t('bracket.new')}</button>
        </div>
      )}
      {!locked && atCap && (
        <p className="muted" style={{ marginTop: 14 }}>{t('bracket.atCap')}</p>
      )}
      {error && <p className="banner error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
