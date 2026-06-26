export type PoolStats = {
  players: number; // people holding >=1 credit (each is automatically in the pool)
  entries: number; // total brackets = sum of credits (one credit = one paid bracket)
  potCents: number; // entries * entryCents
};

/**
 * Pool headline numbers from members' credits. A credit is a paid bracket slot, so a player
 * is "in" the moment they hold a credit — no need to wait for them to mark a bracket
 * official. Players counts the holders; brackets (entries) and the pot follow total credits.
 */
export function computePoolStats(users: { credits: number }[], entryCents: number): PoolStats {
  const holders = users.filter((u) => u.credits > 0);
  const players = holders.length;
  const entries = holders.reduce((sum, u) => sum + u.credits, 0);
  return { players, entries, potCents: entries * entryCents };
}
