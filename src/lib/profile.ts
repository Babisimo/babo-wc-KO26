export const MAX_USERNAME_CHANGES = 2;

/** How many username changes a user has left, given how many they've made. */
export function usernameChangesRemaining(count: number): number {
  return Math.max(0, MAX_USERNAME_CHANGES - count);
}

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export function validateUsername(raw: string): ValidationResult {
  const value = raw.trim();
  if (!USERNAME_RE.test(value)) {
    return { ok: false, error: 'Username must be 3–20 letters, numbers, or underscores.' };
  }
  return { ok: true, value };
}

export function validateName(raw: string, label: string): ValidationResult {
  const value = raw.trim();
  if (value.length < 1 || value.length > 50) {
    return { ok: false, error: `${label} must be 1–50 characters.` };
  }
  return { ok: true, value };
}

export function isProfileComplete(u: {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}): boolean {
  return Boolean(u.username && u.firstName && u.lastName);
}
