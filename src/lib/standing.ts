export type StandingEntry = { key: string; total: number; rank: number };

/** The signed-in user's best-ranked official bracket on the leaderboard, or null. */
export function myStanding(
  entries: StandingEntry[],
  myKeys: string[],
): { rank: number; total: number } | null {
  const mine = entries.filter((e) => myKeys.includes(e.key));
  if (mine.length === 0) return null;
  const best = mine.reduce((a, b) => (b.rank < a.rank ? b : a));
  return { rank: best.rank, total: best.total };
}

/** Rank delta for the standing line. Lower rank number is better, so prev > cur means "up". */
export function movement(
  previousRank: number | null,
  currentRank: number,
): { dir: 'up' | 'down' | 'same' | 'none'; places: number } {
  if (previousRank === null) return { dir: 'none', places: 0 };
  if (previousRank > currentRank) return { dir: 'up', places: previousRank - currentRank };
  if (previousRank < currentRank) return { dir: 'down', places: currentRank - previousRank };
  return { dir: 'same', places: 0 };
}
