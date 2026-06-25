'use client';

import type { SlotView } from '@/lib/bracket-view';
import { formatMatchDate } from '@/lib/match-date';
import BracketLayout from './BracketLayout';
import BracketCard from './BracketCard';

export default function MarchMadnessBracket({
  slots,
  dates,
}: {
  slots: SlotView[];
  dates?: Record<number, string | null>;
}) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  return (
    <BracketLayout
      render={(slot) => {
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
      }}
    />
  );
}
