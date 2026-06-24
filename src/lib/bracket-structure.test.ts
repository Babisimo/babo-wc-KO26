import { describe, it, expect } from 'vitest';
import {
  TOTAL_SLOTS,
  roundForSlot,
  slotsForRound,
  feedersForSlot,
  ROUND_POINTS,
  participantsForSlot,
} from './bracket-structure';

describe('roundForSlot', () => {
  it('maps slot ranges to rounds', () => {
    expect(roundForSlot(1)).toBe('R32');
    expect(roundForSlot(16)).toBe('R32');
    expect(roundForSlot(17)).toBe('R16');
    expect(roundForSlot(24)).toBe('R16');
    expect(roundForSlot(25)).toBe('QF');
    expect(roundForSlot(28)).toBe('QF');
    expect(roundForSlot(29)).toBe('SF');
    expect(roundForSlot(30)).toBe('SF');
    expect(roundForSlot(31)).toBe('FINAL');
  });
  it('throws outside 1..31', () => {
    expect(() => roundForSlot(0)).toThrow(RangeError);
    expect(() => roundForSlot(32)).toThrow(RangeError);
  });
});

describe('slotsForRound', () => {
  it('returns the slots of each round', () => {
    expect(slotsForRound('R32')).toHaveLength(16);
    expect(slotsForRound('R32')[0]).toBe(1);
    expect(slotsForRound('R16')).toEqual([17, 18, 19, 20, 21, 22, 23, 24]);
    expect(slotsForRound('QF')).toEqual([25, 26, 27, 28]);
    expect(slotsForRound('SF')).toEqual([29, 30]);
    expect(slotsForRound('FINAL')).toEqual([31]);
  });
});

describe('feedersForSlot', () => {
  it('returns null for R32', () => {
    expect(feedersForSlot(1)).toBeNull();
    expect(feedersForSlot(16)).toBeNull();
  });
  it('wires R16 from the FIFA WC26 routing', () => {
    expect(feedersForSlot(17)).toEqual([2, 5]);
    expect(feedersForSlot(18)).toEqual([1, 3]);
    expect(feedersForSlot(23)).toEqual([14, 16]);
    expect(feedersForSlot(24)).toEqual([13, 15]);
  });
  it('wires QF, SF, FINAL', () => {
    expect(feedersForSlot(25)).toEqual([17, 18]);
    expect(feedersForSlot(26)).toEqual([21, 22]);
    expect(feedersForSlot(28)).toEqual([23, 24]);
    expect(feedersForSlot(29)).toEqual([25, 26]);
    expect(feedersForSlot(30)).toEqual([27, 28]);
    expect(feedersForSlot(31)).toEqual([29, 30]);
  });
  it('every R32 slot feeds exactly one R16 slot', () => {
    const used = [17, 18, 19, 20, 21, 22, 23, 24].flatMap((s) => feedersForSlot(s)!);
    expect(used.sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe('ROUND_POINTS', () => {
  it('is round-weighted, perfect bracket = 80', () => {
    expect(ROUND_POINTS).toEqual({ R32: 1, R16: 2, QF: 4, SF: 8, FINAL: 16 });
    const perfect =
      16 * ROUND_POINTS.R32 +
      8 * ROUND_POINTS.R16 +
      4 * ROUND_POINTS.QF +
      2 * ROUND_POINTS.SF +
      1 * ROUND_POINTS.FINAL;
    expect(perfect).toBe(80);
  });
});

describe('TOTAL_SLOTS', () => {
  it('equals 31 (16 R32 + 8 R16 + 4 QF + 2 SF + 1 FINAL)', () => {
    expect(TOTAL_SLOTS).toBe(31);
  });
});

describe('participantsForSlot', () => {
  it('returns stored teams for R32', () => {
    const matches = { 1: { teamA: 'ARG', teamB: 'BRA', winner: null } };
    expect(participantsForSlot(1, matches)).toEqual({ teamA: 'ARG', teamB: 'BRA' });
  });
  it('derives R16 participants from feeder winners', () => {
    const matches = {
      2: { teamA: 'ARG', teamB: 'BRA', winner: 'ARG' },
      5: { teamA: 'ESP', teamB: 'FRA', winner: 'FRA' },
    };
    expect(participantsForSlot(17, matches)).toEqual({ teamA: 'ARG', teamB: 'FRA' });
  });
  it('returns nulls when feeders are undecided', () => {
    const matches = {
      2: { teamA: 'ARG', teamB: 'BRA', winner: null },
      5: { teamA: 'ESP', teamB: 'FRA', winner: 'FRA' },
    };
    expect(participantsForSlot(17, matches)).toEqual({ teamA: null, teamB: 'FRA' });
  });
  it('returns nulls when a feeder slot is missing', () => {
    expect(participantsForSlot(31, {})).toEqual({ teamA: null, teamB: null });
  });
});
