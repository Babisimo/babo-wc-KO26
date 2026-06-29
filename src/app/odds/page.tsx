'use client';

import { useEffect, useState } from 'react';
import { useT, useLang } from '@/app/_components/LangProvider';
import TeamFlag from '@/app/_components/TeamFlag';
import { teamName, teamColor } from '@/lib/team-name';
import type { OddsReport, BracketOdds, NeedGame } from '@/lib/bracket-odds';
import type { StringKey } from '@/lib/i18n';

type T = (key: StringKey, vars?: Record<string, string | number>) => string;

function ago(t: T, updatedAt: string, now: number): string {
  const ms = now - Date.parse(updatedAt);
  if (!Number.isFinite(ms) || ms < 45_000) return t('odds.justNow');
  const min = Math.round(ms / 60_000);
  if (min < 60) return t('odds.minsAgo', { n: min });
  return t('odds.hoursAgo', { n: Math.round(min / 60) });
}

const pct = (n: number) => (n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(1) : n > 0 ? n.toFixed(2) : '0');

function NeedChip({ g, t }: { g: NeedGame; t: T }) {
  return (
    <span className="need-chip" title={`${t('odds.needsLabel')} · ${Math.round(g.prob * 100)}% · +${g.points}`}>
      <TeamFlag code={g.team} /> {teamName(g.team)}
      <small>{Math.round(g.prob * 100)}%</small>
    </span>
  );
}

function BracketCard({ b, rank, open, onToggle, t }: {
  b: BracketOdds; rank: number; open: boolean; onToggle: () => void; t: T;
}) {
  const color = teamColor(b.champion);
  return (
    <li className={`oc ${open ? 'open' : ''} ${rank === 1 ? 'oc-lead' : ''}`}>
      <button className="oc-head" onClick={onToggle} aria-expanded={open}>
        <span className="oc-rank">{rank === 1 ? '👑' : rank}</span>
        <span className="oc-id">
          <span className="oc-name">{b.bracketName}</span>
          <span className="oc-owner">{b.owner}</span>
          {b.champion && (
            <span className="oc-sub"><TeamFlag code={b.champion} /> {t('odds.backing', { team: teamName(b.champion) })}</span>
          )}
        </span>
        <span className="oc-track"><i style={{ width: `${Math.min(100, b.winPct)}%`, background: color }} /></span>
        <span className="oc-win"><b style={{ color }}>{pct(b.winPct)}%</b><small>{t('odds.toWin')}</small></span>
        <span className="oc-chev" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="oc-body">
          <div className="oc-stats">
            <span><b>{b.now}</b><small>{t('odds.statNow')}</small></span>
            <span><b>{b.exp}</b><small>{t('odds.statExp')}</small></span>
            <span><b>{pct(b.solePct)}%</b><small>{t('odds.statSole')}</small></span>
          </div>
          {b.needs.length > 0 && (
            <>
              <p className="oc-lab">{t('odds.needsLabel')}</p>
              <div className="need-row">{b.needs.map((g) => <NeedChip key={g.slot} g={g} t={t} />)}</div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function TeamOddsList({ data, t }: { data: OddsReport; t: T }) {
  if (data.teams.length === 0) return null;
  return (
    <section className="team-odds">
      <p className="oc-lab">{t('odds.teamOdds')}</p>
      <ul className="to-list">
        {data.teams.slice(0, 12).map((tm) => (
          <li key={tm.code} className="to-row">
            <span className="to-team"><TeamFlag code={tm.code} /> {teamName(tm.code)}</span>
            <span className="to-bar"><i style={{ width: `${Math.min(100, tm.titlePct)}%`, background: teamColor(tm.code) }} /></span>
            <b className="to-pct">{pct(tm.titlePct)}%</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function OddsPage() {
  const t = useT() as T;
  const { lang } = useLang();
  const [data, setData] = useState<OddsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  async function load() {
    try {
      const res = await fetch('/api/odds', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 2 * 60 * 1000); // live as games finish
    const tick = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, []);

  if (error) {
    return (
      <main className="shell">
        <div className="state"><div className="big" style={{ color: 'var(--crimson)' }}>{t('odds.errTitle')}</div>
        <p className="muted">{t('odds.errBody', { error })}</p></div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="shell">
        <div className="state"><div className="spin" /><div className="big">{t('odds.loading')}</div></div>
      </main>
    );
  }

  void lang; // formatting hook reserved for future locale-aware numbers
  return (
    <main className="shell">
      <header className="reveal odds-head">
        <p className="eyebrow">{t('odds.eyebrow')}</p>
        <h1>{t('odds.title')}</h1>
        <p className="lead">{t('odds.intro')}</p>
        <div className="meta">
          <span className="odds-chip"><span className="odds-chip-dot" /> {t('odds.decided', { decided: data.decided, total: data.total })}</span>
          <span className="odds-chip">{t('odds.left', { n: data.remaining })}</span>
          <span className="odds-chip dim">{t('odds.updated', { ago: ago(t, data.updatedAt, now) })}</span>
        </div>
      </header>

      {data.locked ? (
        data.brackets.length === 0
          ? <p className="muted">{t('odds.empty')}</p>
          : <ol className="oc-list">
              {data.brackets.map((b, i) => (
                <BracketCard key={b.key} b={b} rank={i + 1}
                  open={open === b.key} onToggle={() => setOpen(open === b.key ? null : b.key)} t={t} />
              ))}
            </ol>
      ) : (
        <section className="odds-teaserbox reveal"><p className="muted">{t('odds.lockedSoon')}</p></section>
      )}

      <TeamOddsList data={data} t={t} />
    </main>
  );
}
