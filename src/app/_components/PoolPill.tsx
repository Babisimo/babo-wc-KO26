'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useT } from '@/app/_components/LangProvider';
import type { PoolHeaderStats } from '@/lib/pool-stats';

function dollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/**
 * Header pill: stable, credits-based pot with a filled-vs-paid count, and a tap/hover
 * breakdown that explains where the pot comes from and links to the full roster.
 */
export default function PoolPill({ pool, onNavigate }: { pool: PoolHeaderStats; onNavigate?: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const amount = dollars(pool.potCents);
  const entry = dollars(pool.entryCents);
  const label = t('nav.pool', { amount, filled: pool.filled, entries: pool.bracketsIn });
  const aria = t('nav.poolAria', { amount, filled: pool.filled, entries: pool.bracketsIn });

  return (
    <div
      className="nav-pool nav-pinned"
      style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="nav-pool-btn"
        aria-expanded={open}
        aria-label={aria}
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
      >
        <span className="pill gold">{label}</span>
      </button>
      {open && (
        <div
          className="panel nav-pool-pop"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 50,
            minWidth: 220,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: 'left',
            background: 'rgba(8, 26, 16, 0.97)',
            backdropFilter: 'blur(12px) saturate(1.2)',
            boxShadow: '0 8px 24px rgba(0,0,0,.45)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>{t('nav.poolBreakdown', { entries: pool.bracketsIn, entry, amount })}</p>
          <p className="muted" style={{ margin: '4px 0 0' }}>{t('nav.poolFilled', { filled: pool.filled, entries: pool.bracketsIn })}</p>
          <Link href="/brackets" onClick={() => { setOpen(false); onNavigate?.(); }}>{t('nav.poolView')} →</Link>
        </div>
      )}
    </div>
  );
}
