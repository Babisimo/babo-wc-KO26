'use server';

import { db } from '@/lib/db';
import { currentWinners } from '@/app/actions/results';
import { getOfficialBracket } from '@/app/actions/bracket';
import { fetchSurfacedGames } from '@/app/actions/scoreboard';
import { scoreBracket } from '@/lib/scoring';
import { rankEntries, potSplit, type RankedEntry } from '@/lib/leaderboard-rank';
import { computePoolStats } from '@/lib/pool-stats';
import { computeStage, type Stage } from '@/lib/tournament-stage';
import { championAnnouncement } from '@/lib/champion';
import { isLocked } from '@/lib/lock';
import { buildLeaderboardPicks, type LeaderboardPicks } from '@/lib/leaderboard-picks';
import type { Picks } from '@/lib/bracket-picks';

export type LeaderboardData = {
  entries: RankedEntry[];
  potCents: number;
  entryCents: number;
  winnerKeys: string[];
  shareCents: number;
  stage: Stage;
  champions: { names: string[]; shareCents: number } | null;
  nextPicks: LeaderboardPicks; // per-bracket picks for the current/up-next games (empty pre-lock)
};

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

export async function getLeaderboard(): Promise<LeaderboardData> {
  const [brackets, winners, config, official] = await Promise.all([
    db.bracket.findMany({
      where: { official: true }, // only designated, paid entries are ranked on the board
      select: { id: true, userId: true, name: true, picks: true },
    }),
    currentWinners(),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
    getOfficialBracket(), // official draw slots + lock time, for the current-match pick chips
  ]);

  const userIds = brackets.map((b) => b.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, username: true, firstName: true },
  });
  const userById = new Map(users.map((u) => {
    const handle = u.username ?? u.name;
    return [u.id, { display: u.firstName ? `${handle} (${u.firstName})` : handle, username: u.username }];
  }));

  // One leaderboard row per bracket, keyed by bracket id.
  const scored = brackets.map((b) => {
    const u = userById.get(b.userId);
    return {
      key: b.id,
      name: `${u?.display ?? 'Unknown'} — ${b.name}`,
      owner: u?.display ?? 'Unknown',
      bracketName: b.name,
      username: u?.username ?? null,
      total: scoreBracket(coercePicks(b.picks), winners),
    };
  });

  const entries = rankEntries(scored);
  const entryCents = config?.entryCents ?? 5000;
  const { potCents } = computePoolStats(brackets.length, entryCents); // pot = brackets in × entry
  const { winners: winEntries, shareCents } = potSplit(entries, potCents);
  const stage = computeStage(winners);

  // Once the Final is decided, the rank-1 bracket(s) are the pool champion(s). Map each
  // winning bracket to its owner's display name (deduped inside championAnnouncement).
  const bracketUserId = new Map(brackets.map((b) => [b.id, b.userId]));
  const winnerDisplays = winEntries
    .map((w) => userById.get(bracketUserId.get(w.key) ?? '')?.display)
    .filter((d): d is string => !!d);

  // Per-bracket picks for the current/up-next games. Picks are private until lock, so this
  // stays empty (no leak) until brackets are locked; the games come from the ESPN scoreboard.
  let nextPicks: LeaderboardPicks = { headers: [], cellsByKey: {} };
  const locked = isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null);
  if (locked) {
    const games = await fetchSurfacedGames();
    if (games.length > 0) {
      const slotParticipants = official.slots.map((s) => ({ slot: s.slot, teamA: s.teamA, teamB: s.teamB }));
      nextPicks = buildLeaderboardPicks(
        slotParticipants,
        games,
        brackets.map((b) => ({ key: b.id, picks: coercePicks(b.picks) })),
        winners,
      );
    }
  }

  return {
    entries,
    potCents,
    entryCents,
    winnerKeys: winEntries.map((w) => w.key),
    shareCents,
    stage,
    champions: championAnnouncement(stage, winnerDisplays, shareCents),
    nextPicks,
  };
}
