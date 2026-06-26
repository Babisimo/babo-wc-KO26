'use client';

import type { SlotView } from '@/lib/bracket-view';
import { formatMatchDate } from '@/lib/match-date';
import BracketLayout, { BracketStatic } from './BracketLayout';
import BracketCard from './BracketCard';

export default function MarchMadnessBracket({
  slots,
  dates,
  layout = 'interactive',
}: {
  slots: SlotView[];
  dates?: Record<number, string | null>;
  layout?: 'interactive' | 'static';
}) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  const render = (slot: number) => {
    const s = bySlot.get(slot);
    if (!s) return <BracketCard teamA={null} teamB={null} isFinal={slot === 31} />;
    return (
      <BracketCard
        teamA={s.teamA}
        teamB={s.teamB}
        highlight={s.pick ?? s.officialWinner}
        status={s.status}
        dateLabel={formatMatchDate(dates?.[slot])}
        isFinal={slot === 31}
      />
    );
  };

  if (layout === 'static') {
    // No `.brd` wrapper here: `.brd { width: 100% }` inside the shrink-to-fit export
    // stage collapses the layout. `.brd-export` is inline-block, sized to the tree.
    return <div className="brd-export"><BracketStatic render={render} /></div>;
  }
  return <BracketLayout render={render} />;
}
