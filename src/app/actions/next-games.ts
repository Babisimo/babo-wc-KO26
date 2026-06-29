'use server';

import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getOfficialBracket } from '@/app/actions/bracket';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { formatLockTimePT, isLocked } from '@/lib/lock';
import { TEAMS } from '@/lib/teams';
import { resolveCode } from '@/lib/team-resolve';
import { mapScoreboardGames, pickGames, poolSplit, type GameState, type PoolSplit } from '@/lib/next-games';
import { gameSlotPick, type SlotParticipants, type PickResult } from '@/lib/game-slot';
import type { Picks } from '@/lib/bracket-picks';
import { getBookOdds, type BookLine } from '@/lib/book-odds';

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
  odds: { probA: number; probB: number } | null; // bookmaker win prob ("The books")
  pool: PoolSplit | null;                         // how the pool's brackets split ("The bracket"); null pre-lock
};

export async function getNextGames(): Promise<{ games: GameRow[]; lockNote: string | null; lockTimeIso: string | null; lockLabel: string | null }> {
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

  const bookLines: BookLine[] = await getBookOdds().catch(() => []);

  function oddsFor(teamA: string, teamB: string): { probA: number; probB: number } | null {
    const l = bookLines.find(
      (x) => (x.codeA === teamA && x.codeB === teamB) || (x.codeA === teamB && x.codeB === teamA),
    );
    if (!l) return null;
    return l.codeA === teamA ? { probA: l.probA, probB: l.probB } : { probA: l.probB, probB: l.probA };
  }

  // "The bracket" consensus needs every official bracket's picks — but those are
  // private until lock, so only load + tally them once brackets are locked.
  const locked = isLocked(new Date(), lockTimeIso ? new Date(lockTimeIso) : null);
  let allPicks: Picks[] = [];
  if (locked) {
    const rows = await db.bracket.findMany({ where: { official: true }, select: { picks: true } });
    allPicks = rows.map((r) => coercePicks(r.picks));
  }

  let games: GameRow[] = [];
  try {
    const res = await fetch(`${SCOREBOARD}?dates=${DATES}`, { next: { revalidate: 15 } });
    if (res.ok) {
      const parsed = pickGames(mapScoreboardGames(await res.json(), resolveTeam));
      games = parsed.map((g) => {
        const { slot, yourPick, result } = gameSlotPick(slotParticipants, g, topPicks, winners);
        const split = locked && slot != null ? poolSplit(allPicks, slot, g.teamA, g.teamB) : null;
        return {
          ...g, yourPick, result,
          odds: oddsFor(g.teamA, g.teamB),
          pool: split && split.voters > 0 ? split : null,
        };
      });
    }
  } catch {
    games = []; // feed unreachable → empty strip; page is unaffected
  }

  const lockMs = lockTimeIso ? Date.parse(lockTimeIso) : NaN;
  const lockLabel = Number.isFinite(lockMs) ? formatLockTimePT(new Date(lockMs)) : null;
  const lockNote = Number.isFinite(lockMs) && Date.now() < lockMs ? lockLabel : null;

  return { games, lockNote, lockTimeIso, lockLabel };
}
