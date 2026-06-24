export const LOCK_LEAD_MS = 3600_000; // 1 hour

/** Earliest non-null R32 kickoff minus one hour; null if there are no kickoffs. */
export function computeLockTime(r32Kickoffs: (Date | null)[]): Date | null {
  const times = r32Kickoffs.filter((d): d is Date => d !== null).map((d) => d.getTime());
  if (times.length === 0) return null;
  return new Date(Math.min(...times) - LOCK_LEAD_MS);
}

export function isLocked(now: Date, lockTime: Date | null): boolean {
  return lockTime !== null && now.getTime() >= lockTime.getTime();
}

/** Format an instant in Pacific time, e.g. "Jul 1, 2026, 9:00 AM PDT". */
export function formatLockTimePT(lockTime: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(lockTime);
}
