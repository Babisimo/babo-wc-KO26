import { describe, it, expect } from 'vitest';
import { flagClass } from './team-flag';

describe('flagClass', () => {
  it('maps FIFA codes to flag-icons ISO classes', () => {
    expect(flagClass('ARG')).toBe('fi-ar');
    expect(flagClass('USA')).toBe('fi-us');
    expect(flagClass('KOR')).toBe('fi-kr');
    expect(flagClass('KSA')).toBe('fi-sa');
  });
  it('maps the UK home nations to flag-icons gb-* classes', () => {
    expect(flagClass('ENG')).toBe('fi-gb-eng');
    expect(flagClass('SCO')).toBe('fi-gb-sct');
  });
  it('returns null for null or unknown codes', () => {
    expect(flagClass(null)).toBeNull();
    expect(flagClass('ZZZ')).toBeNull();
  });
  it('covers every team in TEAMS', async () => {
    const { TEAMS } = await import('./teams');
    for (const t of TEAMS) expect(flagClass(t.code)).toMatch(/^fi-/);
  });
});
