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
