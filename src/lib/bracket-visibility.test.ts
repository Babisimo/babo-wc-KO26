import { describe, it, expect } from 'vitest';
import { canViewUserBracket } from './bracket-visibility';

describe('canViewUserBracket', () => {
  it('lets the owner view their own bracket anytime', () => {
    expect(canViewUserBracket({ isOwner: true, locked: false })).toBe(true);
    expect(canViewUserBracket({ isOwner: true, locked: true })).toBe(true);
  });
  it('hides others until lock', () => {
    expect(canViewUserBracket({ isOwner: false, locked: false })).toBe(false);
  });
  it('shows others after lock', () => {
    expect(canViewUserBracket({ isOwner: false, locked: true })).toBe(true);
  });
});
