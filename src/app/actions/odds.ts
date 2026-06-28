'use server';

import { db } from '@/lib/db';
import { getOfficialBracket } from '@/app/actions/bracket';
import { currentWinners } from '@/app/actions/results';
import { officialR32FromSlots } from '@/lib/official-r32';
import { isLocked } from '@/lib/lock';
import { getBookOdds } from '@/lib/book-odds';
import { simulateOdds, type OddsBracket, type OddsReport } from '@/lib/bracket-odds';
import { coercePicks } from '@/lib/picks-json';

const SIMS = 100_000;

// Bounds the per-window cost to one simulation; concurrent pollers share one cached result.
const ODDS_TTL_MS = 120_000;
let cached: { at: number; report: OddsReport } | null = null;

async function computeOdds(): Promise<OddsReport> {
  const [{ slots, lockTimeIso }, winners, bookLines] = await Promise.all([
    getOfficialBracket(),
    currentWinners(),
    getBookOdds().catch(() => []), // books outage must never break the page
  ]);

  const officialR32 = officialR32FromSlots(slots);
  const locked = isLocked(new Date(), lockTimeIso ? new Date(lockTimeIso) : null);

  // Before lock, picks are private — never read them; show team + book odds only.
  let brackets: OddsBracket[] = [];
  if (locked) {
    const rows = await db.bracket.findMany({
      where: { official: true },
      select: { id: true, userId: true, name: true, picks: true },
    });
    const users = await db.user.findMany({
      where: { id: { in: rows.map((b) => b.userId) } },
      select: { id: true, name: true, username: true, firstName: true },
    });
    const display = new Map(users.map((u) => {
      const handle = u.username ?? u.name;
      return [u.id, u.firstName ? `${handle} (${u.firstName})` : handle];
    }));
    brackets = rows.map((b) => ({
      key: b.id,
      name: `${display.get(b.userId) ?? 'Unknown'} — ${b.name}`,
      picks: coercePicks(b.picks),
    }));
  }

  return simulateOdds(
    { officialR32, winners, brackets, bookLines, locked, updatedAt: new Date().toISOString() },
    { sims: SIMS },
  );
}

export async function getOdds(): Promise<OddsReport> {
  if (cached && Date.now() - cached.at < ODDS_TTL_MS) return cached.report;
  const report = await computeOdds();
  cached = { at: Date.now(), report };
  return report;
}
