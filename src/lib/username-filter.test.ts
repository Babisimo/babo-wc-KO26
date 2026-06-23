import { describe, it, expect } from 'vitest';
import { checkUsernameAllowed } from './username-filter';

describe('checkUsernameAllowed', () => {
  it('allows a normal username', () => {
    expect(checkUsernameAllowed('soccerfan')).toEqual({ ok: true });
  });
  it('blocks a reserved word', () => {
    const r = checkUsernameAllowed('admin');
    expect(r.ok).toBe(false);
  });
  it('rejects case-insensitive match (mixed case)', () => {
    expect(checkUsernameAllowed('Admin').ok).toBe(false);
  });
  it('rejects case-insensitive match (uppercase)', () => {
    expect(checkUsernameAllowed('ADMIN').ok).toBe(false);
  });
});
