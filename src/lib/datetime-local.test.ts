import { describe, it, expect } from 'vitest';
import { isoToLocalInput, localInputToIso } from './datetime-local';

describe('datetime-local round-trip', () => {
  it('round-trips a minute-precision instant through local input form', () => {
    const iso = new Date('2026-07-01T16:00:00.000Z').toISOString();
    const local = isoToLocalInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(localInputToIso(local)).toBe(iso);
  });
  it('maps empty <-> empty/null', () => {
    expect(isoToLocalInput('')).toBe('');
    expect(localInputToIso('')).toBeNull();
  });
  it('returns empty/null on invalid input', () => {
    expect(isoToLocalInput('not-a-date')).toBe('');
    expect(localInputToIso('not-a-date')).toBeNull();
  });
});
