import type { BookLine } from '@/lib/book-odds';
import { teamElo, eloWinProb } from '@/lib/team-elo';

/** Probability that `codeA` advances past `codeB`: a real bookmaker line if one exists
 *  for the pair (either orientation), else the Elo expectation. One source so the sim and
 *  the UI never disagree. */
export function matchupProb(
  codeA: string | null,
  codeB: string | null,
  lines: BookLine[],
): { p: number; hasLine: boolean } {
  const line = lines.find(
    (l) => (l.codeA === codeA && l.codeB === codeB) || (l.codeA === codeB && l.codeB === codeA),
  );
  if (line) return { p: line.codeA === codeA ? line.probA : line.probB, hasLine: true };
  return { p: eloWinProb(teamElo(codeA), teamElo(codeB)), hasLine: false };
}
