import { describe, it, expect } from 'vitest';
import { validateR32Skeleton, type R32Entry } from './r32-skeleton';

const KNOWN = new Set(['ARG', 'BRA', 'ESP', 'FRA']);

function entry(slot: number, teamA = 'ARG', teamB = 'BRA'): R32Entry {
  return { slot, teamA, teamB, kickoff: null };
}

function fullValid(): R32Entry[] {
  return Array.from({ length: 16 }, (_, i) => entry(i + 1));
}

describe('validateR32Skeleton', () => {
  it('accepts 16 valid entries', () => {
    expect(validateR32Skeleton(fullValid(), KNOWN)).toEqual({ ok: true });
  });
  it('rejects the wrong number of entries', () => {
    expect(validateR32Skeleton(fullValid().slice(0, 15), KNOWN).ok).toBe(false);
  });
  it('rejects a slot outside 1..16', () => {
    const e = fullValid();
    e[0] = entry(17);
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('rejects duplicate slots', () => {
    const e = fullValid();
    e[1] = entry(1);
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('rejects an unknown team code', () => {
    const e = fullValid();
    e[0] = entry(1, 'ZZZ', 'BRA');
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('rejects a team playing itself', () => {
    const e = fullValid();
    e[0] = entry(1, 'ARG', 'ARG');
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('rejects an invalid kickoff', () => {
    const e = fullValid();
    e[0] = { slot: 1, teamA: 'ARG', teamB: 'BRA', kickoff: 'not-a-date' };
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('accepts a valid ISO kickoff', () => {
    const e = fullValid();
    e[0] = { slot: 1, teamA: 'ARG', teamB: 'BRA', kickoff: '2026-07-01T16:00:00.000Z' };
    expect(validateR32Skeleton(e, KNOWN)).toEqual({ ok: true });
  });
});
