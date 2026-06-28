import { countFilledBrackets } from '@/lib/pool-stats';

/**
 * Members who have NO fully-filled official bracket — i.e. they're in the pool (hold credits)
 * but haven't completed an entry. Generic so the caller gets its own row objects back, keeping
 * username/name/email for rendering. "Filled" reuses countFilledBrackets (all 31 games picked).
 */
export function membersMissingEntry<T extends { id: string }>(
  members: T[],
  officialBrackets: { userId: string; picks: unknown }[],
): T[] {
  const byUser = new Map<string, { picks: unknown }[]>();
  for (const b of officialBrackets) {
    const list = byUser.get(b.userId);
    if (list) list.push({ picks: b.picks });
    else byUser.set(b.userId, [{ picks: b.picks }]);
  }
  return members.filter((m) => countFilledBrackets(byUser.get(m.id) ?? []) === 0);
}
