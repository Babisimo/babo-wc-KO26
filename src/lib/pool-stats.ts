import { coercePicks } from '@/lib/picks-json';

export type PoolStats = {
  players: number; // people holding >=1 credit (each is automatically in the pool)
  entries: number; // total brackets = sum of credits (one credit = one paid bracket)
  potCents: number; // entries * entryCents
};

/** Header view: the credits-based stats plus how many brackets are filled and the unit price. */
export type PoolHeaderStats = PoolStats & {
  filled: number; // official brackets with every game picked
  entryCents: number; // unit price, so the header can show the "entries × $50" breakdown
};

const TOTAL_GAMES = 31; // R32 → Final

/** Count official brackets that have all 31 games picked — the "filled" half of filled-vs-paid. */
export function countFilledBrackets(brackets: { picks: unknown }[]): number {
  return brackets.reduce((n, b) => {
    const made = Object.values(coercePicks(b.picks)).filter((v) => typeof v === 'string' && v).length;
    return made >= TOTAL_GAMES ? n + 1 : n;
  }, 0);
}

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
