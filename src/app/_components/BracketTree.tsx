import type { SlotView } from '@/lib/bracket-view';
import { slotsForRound } from '@/lib/bracket-structure';
import { teamName, teamColor } from '@/lib/team-name';
import type { Round } from '@prisma/client';

const ROUNDS: { round: Round; label: string }[] = [
  { round: 'R32', label: 'Round of 32' },
  { round: 'R16', label: 'Round of 16' },
  { round: 'QF', label: 'Quarters' },
  { round: 'SF', label: 'Semis' },
  { round: 'FINAL', label: 'Final' },
];

function teamRow(code: string | null, pick: string | null, winner: string | null) {
  const isPick = code !== null && code === pick;
  const isWin = code !== null && code === winner;
  return (
    <div className={`bk-team${isPick ? ' pick' : ''}${isWin ? ' win' : ''}`}>
      <span className="chip" style={{ background: teamColor(code) }} />
      <span>{teamName(code)}</span>
      {isWin && <span style={{ marginLeft: 'auto' }}>✓</span>}
    </div>
  );
}

export default function BracketTree({ slots }: { slots: SlotView[] }) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  return (
    <div className="bk-tree">
      {ROUNDS.map(({ round, label }) => (
        <div key={round} className="bk-round">
          <h3>{label}</h3>
          {slotsForRound(round).map((slotNum) => {
            const s = bySlot.get(slotNum);
            if (!s) return null;
            return (
              <div key={slotNum} className={`bk-match ${s.status}`}>
                {teamRow(s.teamA, s.pick, s.officialWinner)}
                {teamRow(s.teamB, s.pick, s.officialWinner)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
