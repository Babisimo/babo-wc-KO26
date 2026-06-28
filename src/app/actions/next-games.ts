'use server';

import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getOfficialBracket } from '@/app/actions/bracket';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { formatLockTimePT } from '@/lib/lock';
import { TEAMS } from '@/lib/teams';
import { resolveCode } from '@/lib/team-resolve';
import { mapScoreboardGames, pickGames, type GameState } from '@/lib/next-games';
import { gameSlotPick, type SlotParticipants, type PickResult } from '@/lib/game-slot';
import type { Picks } from '@/lib/bracket-picks';

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
// Knockout window (UTC). One request covers the whole range.
const DATES = '20260628-20260720';

const KNOWN = new Set(TEAMS.map((t) => t.code));
const resolveTeam = (abbr?: string, name?: string): string | null => {
  if (abbr && KNOWN.has(abbr)) return abbr;
  const r = resolveCode(name ?? abbr ?? '');
  return r && KNOWN.has(r) ? r : null;
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

export type GameRow = {
  teamA: string; teamB: string; kickoffIso: string; state: GameState;
  scoreA: number | null; scoreB: number | null;
  yourPick: string | null; result: PickResult | null;
};

export async function getNextGames(): Promise<{ games: GameRow[]; lockNote: string | null }> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id ?? null;

  const [{ slots, lockTimeIso }, winners] = await Promise.all([getOfficialBracket(), currentWinners()]);
  const slotParticipants: SlotParticipants[] = slots.map((s) => ({ slot: s.slot, teamA: s.teamA, teamB: s.teamB }));

  // The user's top-scoring official bracket supplies "your pick".
  let topPicks: Picks = {};
  if (userId) {
    const brackets = await db.bracket.findMany({ where: { userId, official: true }, select: { picks: true } });
    let best = -1;
    for (const b of brackets) {
      const picks = coercePicks(b.picks);
      const score = scoreBracket(picks, winners);
      if (score > best) { best = score; topPicks = picks; }
    }
  }

  let games: GameRow[] = [];
  try {
    const res = await fetch(`${SCOREBOARD}?dates=${DATES}`, { next: { revalidate: 15 } });
    if (res.ok) {
      const parsed = pickGames(mapScoreboardGames(await res.json(), resolveTeam));
      games = parsed.map((g) => {
        const { yourPick, result } = gameSlotPick(slotParticipants, g, topPicks, winners);
        return { ...g, yourPick, result };
      });
    }
  } catch {
    games = []; // feed unreachable → empty strip; page is unaffected
  }

  const lockMs = lockTimeIso ? Date.parse(lockTimeIso) : NaN;
  const lockNote = Number.isFinite(lockMs) && Date.now() < lockMs ? formatLockTimePT(new Date(lockMs)) : null;

  return { games, lockNote };
}
