import type { SlotView } from '@/lib/bracket-view';
import { teamName, teamColor } from '@/lib/team-name';
import BracketLayout from './BracketLayout';

function teamRow(code: string | null, pick: string | null, winner: string | null) {
  const isPick = code !== null && code === pick;
  const isWin = code !== null && code === winner;
  return (
    <div className={`mm-team${isPick ? ' pick' : ''}${isWin ? ' win' : ''}`}>
      <span className="chip" style={{ background: teamColor(code) }} />
      <span className="nm">{teamName(code)}</span>
      {isWin && <span className="tick">✓</span>}
    </div>
  );
}

function card(s: SlotView | undefined) {
  if (!s) return <div className="mm-match" />;
  return (
    <div className={`mm-match ${s.status}`}>
      {teamRow(s.teamA, s.pick, s.officialWinner)}
      {teamRow(s.teamB, s.pick, s.officialWinner)}
    </div>
  );
}

export default function MarchMadnessBracket({ slots }: { slots: SlotView[] }) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  return <BracketLayout render={(slot) => card(bySlot.get(slot))} />;
}
