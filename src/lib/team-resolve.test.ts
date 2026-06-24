import { describe, it, expect } from 'vitest';
import { normalizeTeam, resolveCode } from './team-resolve';

describe('normalizeTeam', () => {
  it('lowercases and strips accents/punctuation', () => {
    expect(normalizeTeam('Curaçao')).toBe('curacao');
    expect(normalizeTeam("Côte d'Ivoire")).toBe('cote divoire');
  });
  it('dedupes repeated words', () => {
    expect(normalizeTeam('USA USA')).toBe('usa');
  });
});

describe('resolveCode', () => {
  it('resolves an exact team name', () => {
    expect(resolveCode('Argentina')).toBe('ARG');
  });
  it('is case- and accent-insensitive', () => {
    expect(resolveCode('argentina')).toBe('ARG');
    expect(resolveCode('Curaçao')).toBe('CUW');
  });
  it('passes a known code through', () => {
    expect(resolveCode('ARG')).toBe('ARG');
  });
  it('resolves a common feed alias', () => {
    expect(resolveCode('South Korea')).toBe('KOR');
  });
  it('returns null for an unknown name', () => {
    expect(resolveCode('Atlantis')).toBeNull();
    expect(resolveCode('')).toBeNull();
  });
});
