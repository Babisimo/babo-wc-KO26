import { describe, it, expect } from 'vitest';
import { canRemoveUser, canSetAdmin } from './admin-guard';

describe('canRemoveUser', () => {
  it('forbids removing yourself', () => {
    expect(canRemoveUser('a', 'a', ['a', 'b']).ok).toBe(false);
  });
  it('forbids removing the last admin', () => {
    expect(canRemoveUser('a', 'b', ['b']).ok).toBe(false);
  });
  it('allows removing a normal user', () => {
    expect(canRemoveUser('a', 'c', ['a']).ok).toBe(true);
  });
});

describe('canSetAdmin', () => {
  it('forbids changing your own admin status', () => {
    expect(canSetAdmin('a', 'a', false, ['a']).ok).toBe(false);
  });
  it('forbids demoting the last admin', () => {
    expect(canSetAdmin('a', 'b', false, ['b']).ok).toBe(false);
  });
  it('allows promoting a user', () => {
    expect(canSetAdmin('a', 'c', true, ['a']).ok).toBe(true);
  });
});
