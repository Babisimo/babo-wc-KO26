import type { UserStatus } from '@prisma/client';

/**
 * Returns null when the user may log in, otherwise a human-readable reason.
 * Used by the NextAuth authorize() callback to enforce admin approval.
 */
export function loginRejectionReason(status: UserStatus): string | null {
  switch (status) {
    case 'APPROVED':
      return null;
    case 'PENDING':
      return 'Your account is awaiting admin approval.';
    case 'REJECTED':
      return 'Your account was not approved.';
    default:
      return 'Your account cannot sign in.';
  }
}

export type LoginIssue = 'invalid' | 'pending' | 'rejected';

/**
 * Why a login attempt failed, for showing the user a specific message.
 * Only reveals pending/rejected when the password is correct, so it never leaks
 * account existence to someone who doesn't know the password.
 */
export function loginIssue(user: { status: UserStatus } | null, passwordOk: boolean): LoginIssue {
  if (!user || !passwordOk) return 'invalid';
  switch (user.status) {
    case 'PENDING':
      return 'pending';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'invalid'; // APPROVED → login should have succeeded; nothing to explain
  }
}
