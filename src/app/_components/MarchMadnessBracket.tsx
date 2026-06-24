import type { SlotView } from '@/lib/bracket-view';
import { teamName } from '@/lib/team-name';
import BracketLayout from './BracketLayout';
import TeamFlag from './TeamFlag';

function teamRow(code: string | null, winner: string | null) {
  const isWin = code !== null && code === winner;
  return (
    <div className={`fm-row${isWin ? ' win' : ''}`}>
      <TeamFlag code={code} />
      <span className="fm-nm">{teamName(code)}</span>
      {isWin && <span className="fm-tick">✓</span>}
    </div>
  );
}

function card(s: SlotView | undefined) {
  if (!s) return <div className="fm-match" />;
  return (
    <div className={`fm-match ${s.status}`}>
      {teamRow(s.teamA, s.officialWinner)}
      {teamRow(s.teamB, s.officialWinner)}
    </div>
  );
}

export default function MarchMadnessBracket({ slots }: { slots: SlotView[] }) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  return <BracketLayout render={(slot) => card(bySlot.get(slot))} />;
}
