import type { ReactNode } from 'react';
import { feedersForSlot } from '@/lib/bracket-structure';
import RoundLabels from './RoundLabels';

type Side = 'left' | 'right';

// Recursively renders a balanced sub-bracket rooted at `slot`, each match
// vertically centered between its two feeder matches.
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
 * Tournament bracket. `variant='single'` (default) renders the whole tree one
 * direction (R32 left → Final right) with a round-label header — the FotMob look.
 * `variant='two-sided'` keeps the symmetric split with the Final in the center.
 */
export default function BracketLayout({
  render,
  variant = 'single',
}: {
  render: (slot: number) => ReactNode;
  variant?: 'single' | 'two-sided';
}) {
  if (variant === 'two-sided') {
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

  return (
    <div className="bx-scroll">
      <RoundLabels />
      <div className="bx-wrap single">
        <Node slot={31} side="left" render={render} />
      </div>
    </div>
  );
}
