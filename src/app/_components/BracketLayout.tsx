import type { ReactNode } from 'react';
import { feedersForSlot } from '@/lib/bracket-structure';

type Side = 'left' | 'right';

// Recursively renders a balanced sub-bracket rooted at `slot`, where each match
// is vertically centered between its two feeder matches (flex align-items:center).
// Left half flows left→right (kids, then self); right half mirrors.
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

/**
 * Two-sided tournament bracket. The Final (slot 31) sits in the center, fed by
 * the left semifinal subtree (slot 29) and the right semifinal subtree (slot 30).
 * `render(slot)` draws a single match card (static or interactive).
 */
export default function BracketLayout({ render }: { render: (slot: number) => ReactNode }) {
  return (
    <div className="bx-wrap">
      <Node slot={29} side="left" render={render} />
      <div className="bx-final">
        <div className="bx-final-tag">Final</div>
        {render(31)}
        <div className="bx-trophy">🏆</div>
      </div>
      <Node slot={30} side="right" render={render} />
    </div>
  );
}
