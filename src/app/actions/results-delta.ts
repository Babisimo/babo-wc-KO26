import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getOfficialBracket } from '@/app/actions/bracket';
import { scoreBracket } from '@/lib/scoring';
import { rankEntries } from '@/lib/leaderboard-rank';
import { resultDelta, type WinnerMap, type SlotTeams, type DeltaBracket } from '@/lib/result-delta';
import type { Picks } from '@/lib/bracket-picks';

function coercePicks(raw: unknown): Picks {
  const out: Picks = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const slot = Number(k);
      if (Number.isInteger(slot) && typeof v === 'string') out[slot] = v;
    }
  }
  return out;
}

/**
 * Writes to record after winners change: each official bracket's pre-change rank → previousRank,
 * and a ResultEvent per newly-decided slot. Returns [] when nothing was newly decided.
 */
export async function buildResultDeltaOps(
  before: WinnerMap,
  after: WinnerMap,
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const rows = await db.bracket.findMany({ where: { official: true }, select: { id: true, userId: true, name: true, picks: true } });
  if (rows.length === 0) {
    // No brackets to rank, but still record events so the drama line works.
    return recordEventsOnly(before, after);
  }

  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, username: true, firstName: true },
  });
  const displayOf = new Map(users.map((u) => {
    const handle = u.username ?? u.name;
    return [u.id, u.firstName ? `${handle} (${u.firstName})` : handle];
  }));

  const brackets: (DeltaBracket & { id: string })[] = rows.map((r) => {
    const display = displayOf.get(r.userId) ?? 'Unknown';
    return { id: r.id, display, rankName: `${display} — ${r.name}`, picks: coercePicks(r.picks) };
  });

  // Pre-change ranks (same entries the leaderboard uses, scored under the OLD winners).
  const ranked = rankEntries(brackets.map((b) => ({ key: b.id, name: b.rankName, total: scoreBracket(b.picks, before) })));
  const rankById = new Map(ranked.map((e) => [e.key, e.rank]));

  const { slots } = await getOfficialBracket();
  const slotTeams: SlotTeams = {};
  for (const s of slots) slotTeams[s.slot] = { teamA: s.teamA, teamB: s.teamB };

  const { events, newLeader } = resultDelta(before, after, slotTeams, brackets);
  if (events.length === 0) return [];

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const b of brackets) {
    ops.push(db.bracket.update({ where: { id: b.id }, data: { previousRank: rankById.get(b.id) ?? null } }));
  }
  for (const e of events) {
    ops.push(db.resultEvent.create({ data: { slot: e.slot, winner: e.winner, loser: e.loser, bustedCount: e.bustedCount, newLeader } }));
  }
  return ops;
}

/** Record events with no bracket ranking (no official brackets yet). */
async function recordEventsOnly(before: WinnerMap, after: WinnerMap): Promise<Prisma.PrismaPromise<unknown>[]> {
  const { slots } = await getOfficialBracket();
  const slotTeams: SlotTeams = {};
  for (const s of slots) slotTeams[s.slot] = { teamA: s.teamA, teamB: s.teamB };
  const { events } = resultDelta(before, after, slotTeams, []);
  return events.map((e) =>
    db.resultEvent.create({ data: { slot: e.slot, winner: e.winner, loser: e.loser, bustedCount: e.bustedCount, newLeader: null } }),
  );
}
