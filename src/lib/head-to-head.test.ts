import { describe, it, expect } from 'vitest';
import { compareBrackets } from './head-to-head';
import type { Picks } from './bracket-picks';
import type { OfficialWinners } from './scoring';

// Slot 1 is R32 (1 pt), slot 17 is R16 (2 pts), slot 31 is the Final (16 pts).
const A = (picks: Picks) => ({ label: 'A', picks });
const B = (picks: Picks) => ({ label: 'B', picks });

describe('compareBrackets', () => {
  it('reports identical when the two brackets never differ', () => {
    const picks: Picks = { 1: 'ARG', 17: 'ARG', 31: 'ARG' };
    const r = compareBrackets(A(picks), B({ ...picks }), {});
    expect(r.identical).toBe(true);
    expect(r.remaining).toHaveLength(0);
    expect(r.leader).toBeNull();
  });

  it('only counts slots where picks differ, weighted by round', () => {
    const r = compareBrackets(
      A({ 1: 'ARG', 31: 'ARG' }),
      B({ 1: 'BRA', 31: 'FRA' }),
      {},
    );
    expect(r.remaining.map((g) => g.slot)).toEqual([31, 1]); // Final first (biggest swing)
    expect(r.remainingValue).toBe(17); // 16 (final) + 1 (r32)
  });

  it('banks settled differences by round points and frames the trailer path', () => {
    // Slot 17 decided for A (R16 = 2 pts); slot 31 still open (Final = 16 pts).
    const winners: OfficialWinners = { 17: 'ARG' };
    const r = compareBrackets(
      A({ 17: 'ARG', 31: 'ARG' }),
      B({ 17: 'BRA', 31: 'FRA' }),
      winners,
    );
    expect(r.aNow).toBe(2);
    expect(r.bNow).toBe(0);
    expect(r.settled).toEqual({ aWon: 2, bWon: 0 });
    expect(r.leader).toBe('A');
    expect(r.trailer).toBe('B');
    expect(r.needNet).toBe(3); // gap 2 + 1
    expect(r.remainingValue).toBe(16);
    expect(r.canCatch).toBe(true);
  });

  it('flags when the trailer cannot catch up on remaining points', () => {
    // A leads by 16 (won the Final-weight slot); only a 1-pt R32 diff remains.
    const winners: OfficialWinners = { 31: 'ARG' };
    const r = compareBrackets(
      A({ 1: 'ARG', 31: 'ARG' }),
      B({ 1: 'BRA', 31: 'FRA' }),
      winners,
    );
    expect(r.leader).toBe('A');
    expect(r.needNet).toBe(17);
    expect(r.remainingValue).toBe(1);
    expect(r.canCatch).toBe(false);
  });
});
