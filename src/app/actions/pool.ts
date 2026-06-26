'use server';

import { db } from '@/lib/db';
import { computePoolStats, countFilledBrackets, type PoolHeaderStats } from '@/lib/pool-stats';

/** Headline pool numbers (players / brackets / pot / filled) for the global header. */
export async function getPoolStats(): Promise<PoolHeaderStats> {
  const [users, official, config] = await Promise.all([
    db.user.findMany({ where: { credits: { gt: 0 } }, select: { credits: true } }),
    db.bracket.findMany({ where: { official: true }, select: { picks: true } }),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);
  const entryCents = config?.entryCents ?? 5000;
  const stats = computePoolStats(users, entryCents);
  return { ...stats, filled: countFilledBrackets(official), entryCents };
}
