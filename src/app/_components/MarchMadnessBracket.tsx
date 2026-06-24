import type { SlotView } from '@/lib/bracket-view';
import { teamName, teamColor } from '@/lib/team-name';

// Two-sided "March Madness" layout. The fixed bracket geometry splits into
// the Final's two semifinal subtrees: left = SF slot 29, right = SF slot 30.
const LEFT_COLS = [
  { label: 'Round of 32', slots: [1, 2, 3, 4, 5, 6, 7, 8], cls: 'r32' },
  { label: 'Round of 16', slots: [17, 18, 19, 20], cls: '' },
  { label: 'Quarters', slots: [25, 26], cls: '' },
  { label: 'Semifinal', slots: [29], cls: '' },
];
const RIGHT_COLS = [
  { label: 'Semifinal', slots: [30], cls: '' },
  { label: 'Quarters', slots: [27, 28], cls: '' },
  { label: 'Round of 16', slots: [21, 22, 23, 24], cls: '' },
  { label: 'Round of 32', slots: [9, 10, 11, 12, 13, 14, 15, 16], cls: 'r32' },
];

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

function matchCard(s: SlotView | undefined, slot: number) {
  if (!s) return <div key={slot} className="mm-match" />;
  return (
    <div key={slot} className={`mm-match ${s.status}`}>
      {teamRow(s.teamA, s.pick, s.officialWinner)}
      {teamRow(s.teamB, s.pick, s.officialWinner)}
    </div>
  );
}

function Column({
  label,
  slots,
  cls,
  bySlot,
}: {
  label: string;
  slots: number[];
  cls: string;
  bySlot: Map<number, SlotView>;
}) {
  return (
    <div className={`mm-col ${cls}`}>
      <h4>{label}</h4>
      {slots.map((slot) => matchCard(bySlot.get(slot), slot))}
    </div>
  );
}

export default function MarchMadnessBracket({ slots }: { slots: SlotView[] }) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  const final = bySlot.get(31);
  return (
    <div className="mm">
      {LEFT_COLS.map((c) => (
        <Column key={`L${c.label}`} {...c} bySlot={bySlot} />
      ))}
      <div className="mm-final">
        <h4>Final</h4>
        {matchCard(final, 31)}
        <div className="trophy">🏆</div>
      </div>
      {RIGHT_COLS.map((c) => (
        <Column key={`R${c.label}`} {...c} bySlot={bySlot} />
      ))}
    </div>
  );
}
