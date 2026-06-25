export type ScoreEntry = { key: string; name: string; total: number; username?: string | null };
export type RankedEntry = ScoreEntry & { rank: number };

/** Sort by total desc, then name asc for stable display; ties share a rank (1,1,3,…). */
export function rankEntries(entries: ScoreEntry[]): RankedEntry[] {
  const sorted = [...entries].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
  let lastTotal: number | null = null;
  let lastRank = 0;
  return sorted.map((e, i) => {
    if (e.total !== lastTotal) {
      lastRank = i + 1;
      lastTotal = e.total;
    }
    return { ...e, rank: lastRank };
  });
}

export function potSplit(
  ranked: RankedEntry[],
  potCents: number,
): { winners: RankedEntry[]; shareCents: number } {
  const winners = ranked.filter((e) => e.rank === 1);
  const shareCents = winners.length > 0 ? Math.floor(potCents / winners.length) : 0;
  return { winners, shareCents };
}
