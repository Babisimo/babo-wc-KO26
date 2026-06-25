'use client';

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type TouchEvent as RTouchEvent, type ReactNode } from 'react';
import type { Round } from '@prisma/client';
import { feedersForSlot, slotsForRound } from '@/lib/bracket-structure';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';

type Side = 'left' | 'right';

// Recursively renders a balanced sub-bracket rooted at `slot`, each match
// vertically centered between its two feeder matches (the two-sided desktop tree).
function Node({
  slot,
  side,
  render,
}: {
  slot: number;
  side: Side;
  render: (slot: number) => ReactNode;
}) {
  const feeders = feedersForSlot(slot);
  if (!feeders) return <div className="bx-leaf">{render(slot)}</div>;

  const kids = (
    <div className="bx-kids">
      <Node slot={feeders[0]} side={side} render={render} />
      <Node slot={feeders[1]} side={side} render={render} />
    </div>
  );
  const self = <div className="bx-self">{render(slot)}</div>;

  return (
    <div className={`bx ${side}`}>
      {side === 'left' ? (<>{kids}{self}</>) : (<>{self}{kids}</>)}
    </div>
  );
}

function Centerpiece({ render }: { render: (slot: number) => ReactNode }) {
  return (
    <div className="brd-final-card">
      <div className="brd-trophy" aria-hidden>
        <span className="brd-trophy-cup">🏆</span>
        <span className="brd-trophy-label">Champion</span>
      </div>
      {render(31)}
      <span className="brd-final-tag">Final</span>
    </div>
  );
}

// ---- mobile: round-by-round tabs (one round at a time, big readable cards) ----
const TAB_ROUNDS: Round[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
const ROUND_TAB_KEY: Record<Round, StringKey> = {
  R32: 'round.r32Short', R16: 'round.r16Short', QF: 'round.qfShort', SF: 'round.sfShort', FINAL: 'round.finalShort',
};
const NEXT_ROUND: Partial<Record<Round, Round>> = { R32: 'R16', R16: 'QF', QF: 'SF', SF: 'FINAL' };

// The two games in `round` that feed each game of the next round, so we can bracket
// them with a connector line. The Final has no pairing (it's the last game).
function roundPairs(round: Round): number[][] {
  const next = NEXT_ROUND[round];
  if (!next) return [];
  return slotsForRound(next).map((parent) => feedersForSlot(parent) ?? []);
}

// One round's games — the Final as a single card, every other round as bracketed pairs.
function RoundBlock({ round, render }: { round: Round; render: (slot: number) => ReactNode }) {
  if (round === 'FINAL') return <div className="brd-tab-card">{render(31)}</div>;
  return (
    <>
      {roundPairs(round).map((pair, i) => (
        <div key={i} className="brd-tab-pair">
          {pair.map((s) => <div key={s} className="brd-tab-card">{render(s)}</div>)}
        </div>
      ))}
    </>
  );
}

// Mobile round-by-round — swipe left/right (or tap a tab) to move between rounds.
const SWIPE_MIN = 45; // px of horizontal travel to count as a swipe

function BracketTabs({ render }: { render: (slot: number) => ReactNode }) {
  const t = useT();
  const [round, setRound] = useState<Round>('R32');
  const [dir, setDir] = useState(0); // -1 prev, +1 next — drives the slide-in animation
  const touch = useRef<{ x: number; y: number } | null>(null);
  const idx = TAB_ROUNDS.indexOf(round);

  function goTo(next: Round) {
    const ni = TAB_ROUNDS.indexOf(next);
    if (ni === idx) return;
    setDir(ni > idx ? 1 : -1);
    setRound(next);
  }
  function step(delta: number) {
    const ni = idx + delta;
    if (ni >= 0 && ni < TAB_ROUNDS.length) goTo(TAB_ROUNDS[ni]);
  }

  function onTouchStart(e: RTouchEvent) {
    const tp = e.touches[0];
    touch.current = { x: tp.clientX, y: tp.clientY };
  }
  function onTouchEnd(e: RTouchEvent) {
    if (!touch.current) return;
    const tp = e.changedTouches[0];
    const dx = tp.clientX - touch.current.x, dy = tp.clientY - touch.current.y;
    touch.current = null;
    // horizontal swipe only — vertical drags stay as normal scrolling
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  }

  return (
    <div className="brd-tabs-wrap">
      <div className="brd-tabs" role="tablist" aria-label="Round">
        {TAB_ROUNDS.map((r) => (
          <button key={r} type="button" role="tab" aria-selected={round === r}
            className={`brd-tab${round === r ? ' active' : ''}`} onClick={() => goTo(r)}>
            {t(ROUND_TAB_KEY[r])}
          </button>
        ))}
      </div>
      <div
        key={round}
        className={`brd-tab-list${dir > 0 ? ' slide-next' : dir < 0 ? ' slide-prev' : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <RoundBlock round={round} render={render} />
      </div>
    </div>
  );
}

// ---- desktop (and mobile "Full bracket"): map-style pan/zoom of the two-sided tree ----
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;
const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));

type Cam = { scale: number; tx: number; ty: number };

function BracketZoom({ render, revealKey }: { render: (slot: number) => ReactNode; revealKey: string }) {
  // Camera over a fixed-size viewport: translate (tx,ty) then scale. Drag pans,
  // pinch / wheel zoom; the viewport never changes size, so there's no scrolling.
  const [cam, setCam] = useState<Cam>({ scale: 1, tx: 0, ty: 0 });
  const vpRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<HTMLDivElement>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const dragLast = useRef<{ x: number; y: number } | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const pinch = useRef<{ dist: number; fx: number; fy: number } | null>(null);

  function measure() {
    const vp = vpRef.current, pan = panRef.current;
    if (!vp || !pan) return null;
    const inner = pan.querySelector<HTMLElement>('.brd-desktop-inner');
    if (!inner || inner.offsetParent === null) return null; // null while hidden (display:none)
    return { vpW: vp.clientWidth, vpH: vp.clientHeight, natW: inner.offsetWidth, natH: inner.offsetHeight };
  }

  // Keep at least a sliver of the bracket on screen so it can never be lost.
  function clampCam(next: Cam): Cam {
    const m = measure();
    if (!m) return next;
    const cw = m.natW * next.scale, ch = m.natH * next.scale;
    const vis = 90;
    return {
      scale: next.scale,
      tx: Math.min(m.vpW - vis, Math.max(vis - cw, next.tx)),
      ty: Math.min(m.vpH - vis, Math.max(vis - ch, next.ty)),
    };
  }

  function fitToView() {
    const m = measure();
    if (!m || !m.natW || !m.natH) return;
    const scale = clampZoom(Math.min(m.vpW / m.natW, m.vpH / m.natH) * 0.96);
    setCam({ scale, tx: (m.vpW - m.natW * scale) / 2, ty: (m.vpH - m.natH * scale) / 2 });
  }

  // Open at a comfortable, readable scale (cards at full size, centered) — pan to explore.
  function resetView() {
    const m = measure();
    if (!m || !m.natW || !m.natH) return;
    const scale = 1;
    setCam(clampCam({ scale, tx: (m.vpW - m.natW * scale) / 2, ty: (m.vpH - m.natH * scale) / 2 }));
  }

  function point(e: RPointerEvent) {
    const r = vpRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: RPointerEvent) {
    const p = point(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) {
      // Don't capture yet — a tap must still reach the team buttons (fill page).
      downAt.current = p;
      dragLast.current = p;
      dragging.current = false;
    }
    if (ptrs.current.size === 2) {
      dragging.current = false;
      dragLast.current = null;
      vpRef.current!.setPointerCapture(e.pointerId);
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), fx: (a.x + b.x) / 2, fy: (a.y + b.y) / 2 };
    }
  }

  function onPointerMove(e: RPointerEvent) {
    if (!ptrs.current.has(e.pointerId)) return;
    const p = point(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1 && dragLast.current) {
      if (!dragging.current) {
        const d0 = downAt.current!;
        if (Math.hypot(p.x - d0.x, p.y - d0.y) < 5) return; // still could be a tap
        dragging.current = true;
        try { vpRef.current!.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        dragLast.current = p;
      }
      const dx = p.x - dragLast.current.x, dy = p.y - dragLast.current.y;
      dragLast.current = p;
      setCam((prev) => clampCam({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
    } else if (ptrs.current.size === 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y), fx = (a.x + b.x) / 2, fy = (a.y + b.y) / 2;
      const prevP = pinch.current;
      const factor = dist / prevP.dist;
      const panDx = fx - prevP.fx, panDy = fy - prevP.fy;
      pinch.current = { dist, fx, fy };
      setCam((prev) => {
        const ns = clampZoom(prev.scale * factor);
        const f = ns / prev.scale;
        return clampCam({ scale: ns, tx: fx - (fx - prev.tx) * f + panDx, ty: fy - (fy - prev.ty) * f + panDy });
      });
    }
  }

  function onPointerUp(e: RPointerEvent) {
    ptrs.current.delete(e.pointerId);
    try { vpRef.current!.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 1) {
      const r = [...ptrs.current.values()][0];
      dragLast.current = r;
      downAt.current = r;
      dragging.current = false;
    } else if (ptrs.current.size === 0) {
      dragLast.current = null;
      dragging.current = false;
    }
  }

  // Wheel zoom toward the cursor (native non-passive so we can preventDefault).
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setCam((prev) => {
        const ns = clampZoom(prev.scale * factor);
        const f = ns / prev.scale;
        return clampCam({ scale: ns, tx: px - (px - prev.tx) * f, ty: py - (py - prev.ty) * f });
      });
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when first shown (desktop: once on mount; mobile: when "Full bracket" opens,
  // i.e. revealKey changes — so we measure AFTER the viewport becomes visible, not while hidden).
  useEffect(() => {
    const id = requestAnimationFrame(resetView);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey]);

  return (
    <div className="brd-zoom">
      <div className="brd-zoombar">
        <span className="brd-zpct" aria-live="polite">{Math.round(cam.scale * 100)}%</span>
        <button type="button" className="brd-zfit" onClick={fitToView}>Fit</button>
      </div>

      <div
        className="brd-viewport"
        ref={vpRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="brd-pan"
          ref={panRef}
          style={{ transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})` }}
        >
          <div className="brd-desktop-inner">
            <Node slot={29} side="left" render={render} />
            <div className="brd-final"><Centerpiece render={render} /></div>
            <Node slot={30} side="right" render={render} />
          </div>
        </div>
      </div>
    </div>
  );
}

type BracketView = 'tabs' | 'full';
const VIEW_KEY: Record<BracketView, StringKey> = {
  tabs: 'bracket.viewRounds', full: 'bracket.viewFull',
};

/**
 * Tournament bracket — same on every screen size: round-by-round by default (swipe or tap
 * between rounds, with slide-in animation), and a "Full" toggle to the zoomable two-sided tree.
 */
export default function BracketLayout({
  render,
}: {
  render: (slot: number) => ReactNode;
}) {
  const t = useT();
  const [view, setView] = useState<BracketView>('tabs');

  return (
    <div className={`brd brd-view-${view}`}>
      <div className="brd-view-switch">
        <div className="brd-viewseg" role="group" aria-label="Bracket view">
          {(['tabs', 'full'] as BracketView[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`brd-viewbtn${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {t(VIEW_KEY[v])}
            </button>
          ))}
        </div>
      </div>

      <BracketZoom render={render} revealKey={view} />
      <BracketTabs render={render} />
    </div>
  );
}
