import { describe, it, expect } from 'vitest';
import { mergeEffectiveR32 } from './effective-r32';
import type { OfficialR32 } from './bracket-picks';

describe('mergeEffectiveR32', () => {
  it('prefers the official draw and marks those slots confirmed', () => {
    const official: OfficialR32 = { 1: { teamA: 'ARG', teamB: 'BRA' } };
    const { r32, confirmed } = mergeEffectiveR32(official, {}, {});
    expect(r32[1]).toEqual({ teamA: 'ARG', teamB: 'BRA' });
    expect(confirmed[1]).toBe(true);
  });

  it('falls back to the projection (provisional) when the official slot is unset', () => {
    const projected: OfficialR32 = { 2: { teamA: 'ESP', teamB: 'GER' } };
    const projectedConfirmed: OfficialR32 = { 2: { teamA: null, teamB: null } };
    const { r32, confirmed } = mergeEffectiveR32({}, projected, projectedConfirmed);
    expect(r32[2]).toEqual({ teamA: 'ESP', teamB: 'GER' });
    expect(confirmed[2]).toBe(false);
  });

  it('marks a projected slot confirmed only when both teams match the confirmed set', () => {
    const projected: OfficialR32 = { 3: { teamA: 'FRA', teamB: 'POR' } };
    const bothConfirmed: OfficialR32 = { 3: { teamA: 'FRA', teamB: 'POR' } };
    const oneConfirmed: OfficialR32 = { 3: { teamA: 'FRA', teamB: null } };
    expect(mergeEffectiveR32({}, projected, bothConfirmed).confirmed[3]).toBe(true);
    expect(mergeEffectiveR32({}, projected, oneConfirmed).confirmed[3]).toBe(false);
  });

  it('leaves an unknown slot as TBD (null teams, not confirmed)', () => {
    const { r32, confirmed } = mergeEffectiveR32({}, {}, {});
    expect(r32[5]).toEqual({ teamA: null, teamB: null });
    expect(confirmed[5]).toBe(false);
  });
});
