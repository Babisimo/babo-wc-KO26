import { describe, it, expect } from 'vitest';
import { validateUsername, validateName, isProfileComplete, MAX_USERNAME_CHANGES } from './profile';

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
