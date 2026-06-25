import { describe, it, expect } from 'vitest';
import { canCreateBracket } from './bracket-credits';

describe('canCreateBracket', () => {
  it('allows a create only while used < credits', () => {
    expect(canCreateBracket(0, 1)).toBe(true);   // approved, no bracket yet
    expect(canCreateBracket(1, 1)).toBe(false);  // at cap
    expect(canCreateBracket(1, 2)).toBe(true);   // bought a second
    expect(canCreateBracket(2, 2)).toBe(false);  // at cap again
  });
  it('blocks when the user has no credits', () => {
    expect(canCreateBracket(0, 0)).toBe(false);
  });
});
