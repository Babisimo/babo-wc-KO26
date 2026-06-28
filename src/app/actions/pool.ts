'use server';

import { db } from '@/lib/db';
import { computePoolStats, countFilledBrackets, type PoolHeaderStats } from '@/lib/pool-stats';

/** Headline pool numbers (brackets in / filled / pot) for the global header. */
export async function getPoolStats(): Promise<PoolHeaderStats> {
  const [official, config] = await Promise.all([
    db.bracket.findMany({ where: { official: true }, select: { picks: true } }),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);
  const entryCents = config?.entryCents ?? 5000;
  const stats = computePoolStats(official.length, entryCents);
  return { ...stats, filled: countFilledBrackets(official), entryCents };
}
