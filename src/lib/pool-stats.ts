import { coercePicks } from '@/lib/picks-json';

export type PoolStats = {
  bracketsIn: number; // official brackets entered into the pool
  potCents: number;   // bracketsIn * entryCents
};

/** Header view: the brackets-based pot plus how many are filled and the unit price. */
export type PoolHeaderStats = PoolStats & {
  filled: number;     // official brackets with every game picked
  entryCents: number; // unit price, so the header can show the "in × $50" breakdown
};

const TOTAL_GAMES = 31; // R32 → Final

/** Count official brackets that have all 31 games picked — the "filled" half of filled-vs-in. */
export function countFilledBrackets(brackets: { picks: unknown }[]): number {
  return brackets.reduce((n, b) => {
    const made = Object.values(coercePicks(b.picks)).filter((v) => typeof v === 'string' && v).length;
    return made >= TOTAL_GAMES ? n + 1 : n;
  }, 0);
}

/** Pot from entered brackets: a player is "in" once they enter (mark official) a bracket. */
export function computePoolStats(bracketsIn: number, entryCents: number): PoolStats {
  return { bracketsIn, potCents: bracketsIn * entryCents };
}
