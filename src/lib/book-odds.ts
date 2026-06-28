import { resolveCode } from '@/lib/team-resolve';
import { teamElo, eloWinProb } from '@/lib/team-elo';

// ESPN's public, keyless scoreboard carries scores AND moneyline in one call.
const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const DATES = '20260628-20260720'; // knockout window (UTC), same range as next-games

export type BookLine = { codeA: string; codeB: string; probA: number; probB: number };

export function americanToImplied(odds: unknown): number {
  const v = parseInt(String(odds ?? ''), 10);
  if (!Number.isFinite(v) || v === 0) return 0;
  return v > 0 ? 100 / (v + 100) : -v / (-v + 100);
}

/** One ESPN event → a 2-way advancement line, or null if it has no usable moneyline. */
export function mapEspnEvent(event: unknown): BookLine | null {
  const comp = (event as { competitions?: Array<Record<string, unknown>> })?.competitions?.[0];
  const ml = (comp?.odds as Array<{ moneyline?: { home?: unknown; draw?: unknown; away?: unknown } }>)?.[0]?.moneyline;
  if (!ml?.home || !ml?.away || !ml?.draw) return null;

  const pick = (side: unknown) =>
    (side as { close?: { odds?: unknown }; open?: { odds?: unknown } })?.close?.odds
    ?? (side as { open?: { odds?: unknown } })?.open?.odds;
  const h = americanToImplied(pick(ml.home));
  const d = americanToImplied(pick(ml.draw));
  const a = americanToImplied(pick(ml.away));
  const sum = h + d + a;
  if (sum <= 0) return null;
  const pWinH = h / sum, pDraw = d / sum, pWinA = a / sum; // vig removed

  const cs = (comp?.competitors as Array<{ homeAway?: string; team?: { displayName?: string } }>) ?? [];
  const homeName = cs.find((c) => c.homeAway === 'home')?.team?.displayName ?? '';
  const awayName = cs.find((c) => c.homeAway === 'away')?.team?.displayName ?? '';
  const codeA = resolveCode(homeName), codeB = resolveCode(awayName);
  if (!codeA || !codeB) return null;

  // Knockouts can't end drawn: split the draw mass by relative Elo strength.
  const shareHome = eloWinProb(teamElo(codeA), teamElo(codeB));
  return {
    codeA, codeB,
    probA: pWinH + pDraw * shareHome,
    probB: pWinA + pDraw * (1 - shareHome),
  };
}

export async function getBookOdds(): Promise<BookLine[]> {
  const res = await fetch(`${SCOREBOARD}?dates=${DATES}`, { next: { revalidate: 3600 } }); // hourly
  if (!res.ok) throw new Error(`ESPN odds ${res.status}`);
  const json = await res.json();
  return ((json?.events ?? []) as unknown[])
    .map(mapEspnEvent)
    .filter((o): o is BookLine => o !== null);
}
