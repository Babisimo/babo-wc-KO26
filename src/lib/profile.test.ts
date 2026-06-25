import { describe, it, expect } from 'vitest';
import { validateUsername, validateName, isProfileComplete, usernameChangesRemaining, MAX_USERNAME_CHANGES } from './profile';

describe('validateUsername', () => {
  it('accepts a valid username', () => {
    expect(validateUsername('  Pele_10 ')).toEqual({ ok: true, value: 'Pele_10' });
  });
  it('rejects too short', () => {
    const r = validateUsername('ab');
    expect(r.ok).toBe(false);
  });
  it('rejects illegal characters', () => {
    const r = validateUsername('bad name!');
    expect(r.ok).toBe(false);
  });
  it('accepts exactly 3 chars', () => {
    expect(validateUsername('abc').ok).toBe(true);
  });
  it('accepts exactly 20 chars', () => {
    expect(validateUsername('a'.repeat(20)).ok).toBe(true);
  });
  it('rejects 21 chars', () => {
    expect(validateUsername('a'.repeat(21)).ok).toBe(false);
  });
});

describe('validateName', () => {
  it('accepts a normal name', () => {
    expect(validateName('  Lionel ', 'First name')).toEqual({ ok: true, value: 'Lionel' });
  });
  it('rejects empty', () => {
    const r = validateName('   ', 'First name');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('First name');
  });
  it('accepts exactly 1 char', () => {
    expect(validateName('A', 'First name').ok).toBe(true);
  });
  it('accepts exactly 50 chars', () => {
    expect(validateName('a'.repeat(50), 'First name').ok).toBe(true);
  });
  it('rejects 51 chars', () => {
    expect(validateName('a'.repeat(51), 'First name').ok).toBe(false);
  });
});

describe('isProfileComplete', () => {
  it('true when all fields present', () => {
    expect(isProfileComplete({ username: 'x', firstName: 'A', lastName: 'B' })).toBe(true);
  });
  it('false when username missing', () => {
    expect(isProfileComplete({ username: null, firstName: 'A', lastName: 'B' })).toBe(false);
  });
});

describe('MAX_USERNAME_CHANGES', () => {
  it('is a positive integer', () => {
    expect(MAX_USERNAME_CHANGES).toBeGreaterThan(0);
  });
});

describe('usernameChangesRemaining', () => {
  it('returns the full allowance at zero changes', () => {
    expect(usernameChangesRemaining(0)).toBe(MAX_USERNAME_CHANGES);
  });
  it('decreases with each change', () => {
    expect(usernameChangesRemaining(1)).toBe(MAX_USERNAME_CHANGES - 1);
  });
  it('never goes negative past the cap', () => {
    expect(usernameChangesRemaining(MAX_USERNAME_CHANGES + 5)).toBe(0);
  });
});
