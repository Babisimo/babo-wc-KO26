// Lightweight reserved/blocked-word filter. Substring, case-insensitive.
const BLOCKED = ['admin', 'root', 'moderator', 'fuck', 'shit', 'nigger', 'faggot'];

export function checkUsernameAllowed(username: string): { ok: true } | { ok: false; error: string } {
  const lower = username.toLowerCase();
  if (BLOCKED.some((w) => lower.includes(w))) {
    return { ok: false, error: 'That username is not allowed.' };
  }
  return { ok: true };
}
