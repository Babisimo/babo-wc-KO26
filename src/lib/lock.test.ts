import { describe, it, expect } from 'vitest';
import { LOCK_LEAD_MS, computeLockTime, isLocked, formatLockTimePT } from './lock';

describe('computeLockTime', () => {
  it('returns earliest kickoff minus the lock lead (10 minutes)', () => {
    const a = new Date('2026-07-01T18:00:00Z');
    const b = new Date('2026-07-01T16:00:00Z'); // earliest
    const c = new Date('2026-07-02T16:00:00Z');
    const lock = computeLockTime([a, b, c]);
    expect(lock?.toISOString()).toBe('2026-07-01T15:50:00.000Z');
  });
  it('ignores null kickoffs', () => {
    const b = new Date('2026-07-01T16:00:00Z');
    expect(computeLockTime([null, b, null])?.toISOString()).toBe('2026-07-01T15:50:00.000Z');
  });
  it('returns null when there are no kickoffs', () => {
    expect(computeLockTime([])).toBeNull();
    expect(computeLockTime([null, null])).toBeNull();
  });
});

describe('isLocked', () => {
  const lock = new Date('2026-07-01T15:00:00Z');
  it('is false before lock', () => {
    expect(isLocked(new Date('2026-07-01T14:59:59Z'), lock)).toBe(false);
  });
  it('is true at/after lock', () => {
    expect(isLocked(new Date('2026-07-01T15:00:00Z'), lock)).toBe(true);
    expect(isLocked(new Date('2026-07-01T15:00:01Z'), lock)).toBe(true);
  });
  it('is false when lockTime is null', () => {
    expect(isLocked(new Date(), null)).toBe(false);
  });
});

describe('LOCK_LEAD_MS', () => {
  it('is 10 minutes', () => {
    expect(LOCK_LEAD_MS).toBe(600_000);
  });
});

describe('formatLockTimePT', () => {
  it('formats in Pacific time with a zone label', () => {
    // 2026-07-01T16:00:00Z is 09:00 PDT (UTC-7 in July).
    const s = formatLockTimePT(new Date('2026-07-01T16:00:00Z'));
    expect(s).toContain('9:00');
    expect(s).toMatch(/P[DS]T/);
  });
});
