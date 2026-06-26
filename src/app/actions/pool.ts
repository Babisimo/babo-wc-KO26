'use server';

import { db } from '@/lib/db';
import { computePoolStats, type PoolStats } from '@/lib/pool-stats';

/** Headline pool numbers (players / brackets / pot) for the global header. */
export async function getPoolStats(): Promise<PoolStats> {
  const [users, config] = await Promise.all([
    db.user.findMany({ where: { credits: { gt: 0 } }, select: { credits: true } }),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);
  return computePoolStats(users, config?.entryCents ?? 5000);
}
