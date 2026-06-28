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
