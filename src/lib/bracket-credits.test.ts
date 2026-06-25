import { describe, it, expect } from 'vitest';
import { canCreateBracket, canMarkOfficial } from './bracket-credits';

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

describe('canMarkOfficial', () => {
  it('allows marking official only while official count < credits', () => {
    expect(canMarkOfficial(0, 1)).toBe(true);   // first official
    expect(canMarkOfficial(1, 1)).toBe(false);  // at cap
    expect(canMarkOfficial(1, 3)).toBe(true);   // room for more
    expect(canMarkOfficial(3, 3)).toBe(false);  // at cap again
  });
  it('blocks a user with no credits from marking any official', () => {
    expect(canMarkOfficial(0, 0)).toBe(false);
  });
});
