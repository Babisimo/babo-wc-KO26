'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLockOverride, clearLockOverride } from '@/app/actions/bracket';
import { isoToLocalInput, localInputToIso } from '@/lib/datetime-local';
import { formatLockTimePT } from '@/lib/lock';

export default function LockControl({
  overrideIso,
  scheduledIso,
  effectiveIso,
  locked,
}: {
  overrideIso: string | null;
  scheduledIso: string | null;
  effectiveIso: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<string>(() => isoToLocalInput(effectiveIso ?? ''));
  const [error, setError] = useState<string | null>(null);

  // Re-sync the input when the server state changes (e.g. after "Use schedule" clears the
  // override) so a later "Set lock time" can't re-apply a just-cleared value.
  useEffect(() => { setLocal(isoToLocalInput(effectiveIso ?? '')); }, [effectiveIso]);

  const fmt = (iso: string | null) => (iso ? formatLockTimePT(new Date(iso)) : '—');

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function save() {
    const iso = localInputToIso(local);
    if (!iso) { setError('Pick a date and time first.'); return; }
    run(() => setLockOverride(iso));
  }

  return (
    <div>
      <p className="lead" style={{ margin: '0 0 8px' }}>
        Lock: <strong>{fmt(effectiveIso)}</strong>{' '}
        <span className="pill">{locked ? 'Locked now' : 'Open now'}</span>{' '}
        <span className="muted">({overrideIso ? 'manual override' : 'on schedule'})</span>
      </p>
      {overrideIso && (
        <p className="muted" style={{ margin: '0 0 10px' }}>
          Schedule would be {fmt(scheduledIso)} (first kickoff − lead).
        </p>
      )}
      <div className="savebar" style={{ position: 'static', background: 'none', paddingBottom: 0, gap: 10, flexWrap: 'wrap' }}>
        <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} style={{ maxWidth: 240 }} />
        <button type="button" disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Set lock time'}</button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setLockOverride(new Date().toISOString()))}>
          Lock now
        </button>
        {overrideIso && (
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => clearLockOverride())}>
            Use schedule
          </button>
        )}
      </div>
      {error && <span className="banner error" role="alert" style={{ display: 'inline-block', marginTop: 10, padding: '6px 12px' }}>{error}</span>}
    </div>
  );
}
