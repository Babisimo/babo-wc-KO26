import { createHash, randomBytes } from 'node:crypto';

/** How long a password-reset token stays valid: 1 hour. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** SHA-256 hex digest of a raw reset token. Deterministic; only the hash is stored. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A fresh reset token: the raw `token` (sent in the email link) and its `tokenHash`
 *  (stored in the DB). 32 bytes of crypto randomness, base64url-encoded. */
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashResetToken(token) };
}

/** A token is usable only if it has not been used and has not expired. */
export function isResetTokenValid(
  record: { expiresAt: Date; usedAt: Date | null },
  now: Date,
): boolean {
  return record.usedAt == null && now.getTime() < record.expiresAt.getTime();
}
