'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { renameBracket } from '@/app/actions/bracket-entry';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';

/**
 * Renders `children` (the bracket name as shown — a link, an h1, etc.) with a pencil that
 * swaps it for an inline editor. Hidden once locked. On save it calls renameBracket and
 * refreshes so the new name shows everywhere.
 */
export default function RenameControl({
  id,
  name,
  locked,
  children,
}: {
  id: string;
  name: string;
  locked: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<StringKey | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await renameBracket(id, value);
      if (res?.errorKey) { setError(res.errorKey); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setValue(name);
    setError(null);
    setEditing(false);
  }

  if (locked) return <>{children}</>;

  if (!editing) {
    return (
      <>
        {children}
        <button
          type="button"
          className="btn-ghost btn-sm"
          style={{ marginLeft: 8 }}
          aria-label={t('bracket.rename')}
          title={t('bracket.rename')}
          onClick={() => { setValue(name); setEditing(true); }}
        >
          ✎
        </button>
      </>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text"
        value={value}
        maxLength={32}
        autoFocus
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        style={{ maxWidth: 240 }}
      />
      <button type="button" className="btn btn-sm" disabled={pending} onClick={save}>
        {pending ? t('bracket.working') : t('bracket.renameSave')}
      </button>
      <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={cancel}>
        {t('bracket.renameCancel')}
      </button>
      {error && <span className="banner error" style={{ padding: '2px 8px', fontSize: 12 }}>{t(error)}</span>}
    </span>
  );
}
