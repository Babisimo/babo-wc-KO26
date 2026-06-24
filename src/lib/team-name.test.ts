import { describe, it, expect } from 'vitest';
import { teamName, teamColor } from './team-name';

describe('teamName', () => {
  it('returns the team name for a known code', () => {
    expect(teamName('ARG')).toBe('Argentina');
  });
  it('falls back to the code for an unknown one and a dash for null', () => {
    expect(teamName('ZZZ')).toBe('ZZZ');
    expect(teamName(null)).toBe('—');
  });
});

describe('teamColor', () => {
  it('returns a hex color for a known code', () => {
    expect(teamColor('ARG')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it('returns a neutral grey for unknown/null', () => {
    expect(teamColor('ZZZ')).toBe('#888888');
    expect(teamColor(null)).toBe('#888888');
  });
});
