import { describe, it, expect } from 'vitest';
import { normalizeBracketName, statusForNewBracket } from './bracket-name';

describe('normalizeBracketName', () => {
  it('keeps a clean name', () => {
    expect(normalizeBracketName('Long shot', 2)).toBe('Long shot');
  });
  it('trims and collapses internal whitespace', () => {
    expect(normalizeBracketName('  My   Bracket  ', 1)).toBe('My Bracket');
  });
  it('strips control characters', () => {
    expect(normalizeBracketName('Evil', 1)).toBe('Evil');
  });
  it('caps length at 32 characters', () => {
    const long = 'x'.repeat(50);
    expect(normalizeBracketName(long, 1)).toHaveLength(32);
  });
  it('falls back to "Bracket {n}" when empty/blank/nullish', () => {
    expect(normalizeBracketName('', 3)).toBe('Bracket 3');
    expect(normalizeBracketName('   ', 4)).toBe('Bracket 4');
    expect(normalizeBracketName(null, 5)).toBe('Bracket 5');
    expect(normalizeBracketName(undefined, 6)).toBe('Bracket 6');
  });
});

describe('statusForNewBracket', () => {
  it('auto-approves the first bracket, makes the rest pending', () => {
    expect(statusForNewBracket(0)).toBe('APPROVED');
    expect(statusForNewBracket(1)).toBe('PENDING');
    expect(statusForNewBracket(5)).toBe('PENDING');
  });
});
