import { describe, it, expect } from 'vitest';
import { loginRejectionReason } from './auth-status';

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
