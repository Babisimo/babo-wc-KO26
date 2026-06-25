import { describe, it, expect } from 'vitest';
import { loginRejectionReason, loginIssue } from './auth-status';

describe('loginRejectionReason', () => {
  it('allows approved users', () => {
    expect(loginRejectionReason('APPROVED')).toBeNull();
  });
  it('blocks pending users with a clear message', () => {
    expect(loginRejectionReason('PENDING')).toMatch(/approval/i);
  });
  it('blocks rejected users', () => {
    expect(loginRejectionReason('REJECTED')).toMatch(/not approved/i);
  });
});

describe('loginIssue', () => {
  it('reports invalid when the account does not exist', () => {
    expect(loginIssue(null, false)).toBe('invalid');
  });
  it('reports invalid when the password is wrong, even for a pending account', () => {
    // Never reveal that a pending account exists to someone without the password.
    expect(loginIssue({ status: 'PENDING' }, false)).toBe('invalid');
  });
  it('reports pending when the password is correct but approval is pending', () => {
    expect(loginIssue({ status: 'PENDING' }, true)).toBe('pending');
  });
  it('reports rejected when the password is correct but the account was rejected', () => {
    expect(loginIssue({ status: 'REJECTED' }, true)).toBe('rejected');
  });
  it('reports invalid for an approved account (login should have succeeded)', () => {
    expect(loginIssue({ status: 'APPROVED' }, true)).toBe('invalid');
  });
});
