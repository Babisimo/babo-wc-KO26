import { describe, it, expect } from 'vitest';
import { resultDelta, type SlotTeams, type DeltaBracket } from './result-delta';

const slots: SlotTeams = {
  1: { teamA: 'USA', teamB: 'BIH' },
  2: { teamA: 'GER', teamB: 'PAR' },
};
// ROUND_POINTS for R32 slots is the same for slots 1 and 2, so scores compare cleanly.
const brackets: DeltaBracket[] = [
  { display: 'ana (Ana)', rankName: 'ana (Ana) — A', picks: { 1: 'USA', 2: 'GER' } },
  { display: 'beto (Beto)', rankName: 'beto (Beto) — B', picks: { 1: 'BIH', 2: 'GER' } },
];

describe('resultDelta', () => {
  it('emits an event per newly-decided slot with loser + busted count', () => {
    const { events } = resultDelta({}, { 1: 'USA' }, slots, brackets);
    expect(events).toEqual([{ slot: 1, winner: 'USA', loser: 'BIH', bustedCount: 1 }]); // beto picked BIH
  });

  it('ignores slots that were already decided', () => {
    const { events } = resultDelta({ 1: 'USA' }, { 1: 'USA', 2: 'GER' }, slots, brackets);
    expect(events.map((e) => e.slot)).toEqual([2]);
  });

  it('reports a new leader when the top of the board changes', () => {
    // before: nothing decided → tie at 0 → leader is ana by name. After slot 1 (USA): ana leads alone.
    // After slot 2 also won by both, ana still leads. Force a flip: only beto is right on slot 1.
    const flip = resultDelta({}, { 1: 'BIH' }, slots, brackets);
    expect(flip.newLeader).toBe('beto (Beto)'); // beto picked BIH, ana didn't → beto jumps to #1
  });

  it('returns null newLeader when the leader does not change', () => {
    const { newLeader } = resultDelta({}, { 2: 'GER' }, slots, brackets); // both picked GER → tie unchanged
    expect(newLeader).toBeNull();
  });
});
