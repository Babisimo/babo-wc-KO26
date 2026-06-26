'use client';

import { useState, useTransition } from 'react';
import { refreshResults } from '@/app/actions/results';

/** Prominent top-of-page action: pull the latest knockout results from the feed. */
export default function RefreshResultsButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const res = await refreshResults();
      if (res?.error) setMsg({ kind: 'error', text: res.error });
      else setMsg({ kind: 'ok', text: `Updated ${res.updated ?? 0} game(s) from the feed.` });
    });
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" disabled={pending} onClick={run}>
        {pending ? 'Refreshing…' : 'Refresh results'}
      </button>
      <span className="muted" style={{ fontSize: '0.84rem' }}>Pull the latest results from the live feed.</span>
      {msg && (
        <span className={`banner ${msg.kind === 'ok' ? 'ok' : 'error'}`} style={{ padding: '6px 12px' }}>{msg.text}</span>
      )}
    </div>
  );
}
