import { describe, it, expect } from 'vitest';
import { officialR32FromSlots, officialR32IsSet } from './official-r32';
import type { OfficialSlot } from '@/app/actions/bracket';

function slot(s: number, round: OfficialSlot['round'], teamA: string | null, teamB: string | null): OfficialSlot {
  return { slot: s, round, teamA, teamB, winner: null, kickoff: null };
}

describe('officialR32FromSlots', () => {
  it('keeps only R32 slots and maps to team pairs', () => {
    const slots = [slot(1, 'R32', 'ARG', 'BRA'), slot(17, 'R16', null, null)];
    const o = officialR32FromSlots(slots);
    expect(o[1]).toEqual({ teamA: 'ARG', teamB: 'BRA' });
    expect(o[17]).toBeUndefined();
  });
});

describe('officialR32IsSet', () => {
  it('is true only when all 16 R32 slots have both teams', () => {
    const o: Record<number, { teamA: string | null; teamB: string | null }> = {};
    for (let s = 1; s <= 16; s++) o[s] = { teamA: `A${s}`, teamB: `B${s}` };
    expect(officialR32IsSet(o)).toBe(true);
    o[16] = { teamA: 'A16', teamB: null };
    expect(officialR32IsSet(o)).toBe(false);
  });
  it('is false when empty', () => {
    expect(officialR32IsSet({})).toBe(false);
  });
});
