import type { Stage } from '@/lib/tournament-stage';

/**
 * The pool champion(s) once the tournament is complete, or null. Complete means the Final is
 * decided — `computeStage` sets `champion` only then. `winnerDisplays` are the display names of
 * the rank-1 official brackets (may repeat when one player owns several tied brackets); they are
 * deduped and sorted. Null before completion or when there are no winners.
 */
export function championAnnouncement(
  stage: Stage,
  winnerDisplays: string[],
  shareCents: number,
): { names: string[]; shareCents: number } | null {
  if (!stage.champion) return null;
  const names = [...new Set(winnerDisplays)].sort((a, b) => a.localeCompare(b));
  if (names.length === 0) return null;
  return { names, shareCents };
}

/** "A" · "A {and} B" · "A, B {and} C" — conjunction injected so callers localize it. */
export function joinNames(names: string[], and: string): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}
