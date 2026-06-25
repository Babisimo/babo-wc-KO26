'use client';

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import type { Round } from '@prisma/client';
import { feedersForSlot, roundForSlot, slotsForRound } from '@/lib/bracket-structure';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';

// Mobile layout:
//   'vert' = connected tree converging top+bottom to the centered Final;
//   'tree' = single-direction connected bracket (R32 → Final);
//   'tabs' = one round at a time; 'fan' = the older flat vertical fan.
// Flip this one line to switch.
const MOBILE_LAYOUT: 'vert' | 'tree' | 'tabs' | 'fan' = 'vert';

type Side = 'left' | 'right';

// Recursively renders a balanced sub-bracket rooted at `slot`, each match
// vertically centered between its two feeder matches (desktop tree).
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

// ---- mobile: vertical connected tree converging to the centered Final ----
// 'down' = feeders above, self below (top half: R32 at the very top → SF near center).
// 'up'   = self above, feeders below (bottom half: SF near center → R32 at the very bottom).
type VDir = 'down' | 'up';

function VNode({ slot, dir, render }: { slot: number; dir: VDir; render: (slot: number) => ReactNode }) {
  const feeders = feedersForSlot(slot);
  if (!feeders) return <div className="vx-leaf">{render(slot)}</div>;

  const kids = (
    <div className="vx-kids">
      <VNode slot={feeders[0]} dir={dir} render={render} />
      <VNode slot={feeders[1]} dir={dir} render={render} />
    </div>
  );
  const self = <div className="vx-self">{render(slot)}</div>;

  return (
    <div className={`vx ${dir}`}>
      {dir === 'down' ? (<>{kids}{self}</>) : (<>{self}{kids}</>)}
    </div>
  );
}

function MobileVertical({ render }: { render: (slot: number) => ReactNode }) {
  return (
    <div className="brd-vert">
      <div className="brd-vert-inner">
        <VNode slot={29} dir="down" render={render} />
        <div className="brd-vert-final">
          <span className="brd-vert-champ" aria-hidden>🏆</span>
          <div className="brd-vert-final-card">{render(31)}</div>
          <span className="brd-final-tag">Final</span>
        </div>
        <VNode slot={30} dir="up" render={render} />
      </div>
    </div>
  );
}

// ---- mobile: single-direction connected bracket (R32 -> Final, with connector lines) ----
function MobileTree({ render }: { render: (slot: number) => ReactNode }) {
  return (
    <div className="brd-single">
      <Node slot={31} side="left" render={render} />
    </div>
  );
}

// ---- mobile: round selector tabs (one round at a time) ----
const TAB_ROUNDS: Round[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
const ROUND_TAB_KEY: Record<Round, StringKey> = {
  R32: 'round.r32Short', R16: 'round.r16Short', QF: 'round.qfShort', SF: 'round.sfShort', FINAL: 'round.finalShort',
};

function MobileTabs({ render }: { render: (slot: number) => ReactNode }) {
  const t = useT();
  const [round, setRound] = useState<Round>('R32');
  return (
    <div className="brd-tabs-wrap">
      <div className="brd-tabs" role="tablist" aria-label="Round">
        {TAB_ROUNDS.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={round === r}
            className={`brd-tab${round === r ? ' active' : ''}`}
            onClick={() => setRound(r)}
          >
            {t(ROUND_TAB_KEY[r])}
          </button>
        ))}
      </div>
      <div className="brd-tab-list">
        {slotsForRound(round).map((s) => <div key={s} className="brd-tab-card">{render(s)}</div>)}
      </div>
    </div>
  );
}

// ---- mobile: vertical fan (kept as a backup; enable via MOBILE_LAYOUT) ----
const ROUND_ORDER: Round[] = ['R32', 'R16', 'QF', 'SF'];

function collectHalf(root: number): Record<Round, number[]> {
  const byRound: Record<string, number[]> = { R32: [], R16: [], QF: [], SF: [], FINAL: [] };
  (function walk(slot: number) {
    byRound[roundForSlot(slot)].push(slot);
    const f = feedersForSlot(slot);
    if (f) { walk(f[0]); walk(f[1]); }
  })(root);
  for (const k of Object.keys(byRound)) byRound[k].sort((a, b) => a - b);
  return byRound as Record<Round, number[]>;
}

function Row({ slots, render }: { slots: number[]; render: (s: number) => ReactNode }) {
  return (
    <div className="brd-row">
      {slots.map((s) => <div key={s} className="brd-cell">{render(s)}</div>)}
    </div>
  );
}

function MobileFan({ render }: { render: (slot: number) => ReactNode }) {
  const top = collectHalf(29);
  const bottom = collectHalf(30);
  return (
    <div className="brd-fan">
      {ROUND_ORDER.map((r) => <Row key={`t-${r}`} slots={top[r]} render={render} />)}
      <div className="brd-final-m"><Centerpiece render={render} /></div>
      {[...ROUND_ORDER].reverse().map((r) => <Row key={`b-${r}`} slots={bottom[r]} render={render} />)}
    </div>
  );
}

/**
 * Responsive tournament bracket. Desktop renders a symmetric two-sided tree with
 * the Final centered; mobile uses round-selector tabs (or the vertical fan backup).
 * CSS picks the desktop tree or the mobile view per viewport width.
 */
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;
const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));

type Cam = { scale: number; tx: number; ty: number };

export default function BracketLayout({
  render,
}: {
  render: (slot: number) => ReactNode;
}) {
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
    const inners = Array.from(pan.querySelectorAll<HTMLElement>('.brd-desktop-inner, .brd-vert-inner'));
    const inner = inners.find((el) => el.offsetParent !== null); // the one not display:none
    if (!inner) return null;
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

  // Frame the whole bracket on first paint.
  useEffect(() => {
    const id = requestAnimationFrame(fitToView);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="brd">
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
          <div className="brd-desktop">
            <div className="brd-desktop-inner">
              <Node slot={29} side="left" render={render} />
              <div className="brd-final"><Centerpiece render={render} /></div>
              <Node slot={30} side="right" render={render} />
            </div>
          </div>

          <div className="brd-mobile">
            {MOBILE_LAYOUT === 'vert' ? <MobileVertical render={render} />
              : MOBILE_LAYOUT === 'tree' ? <MobileTree render={render} />
              : MOBILE_LAYOUT === 'tabs' ? <MobileTabs render={render} />
              : <MobileFan render={render} />}
          </div>
        </div>
      </div>
    </div>
  );
}
