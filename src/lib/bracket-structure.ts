import type { Round } from '@prisma/client';

export const TOTAL_SLOTS = 31;

// Fixed bracket geometry: [round, firstSlot, lastSlot, prevRoundFirstSlot].
// prevRoundFirstSlot is the first slot of the feeding round (unused for R32).
const LAYERS: { round: Round; first: number; last: number; prevFirst: number }[] = [
  { round: 'R32', first: 1, last: 16, prevFirst: 0 },
  { round: 'R16', first: 17, last: 24, prevFirst: 1 },
  { round: 'QF', first: 25, last: 28, prevFirst: 17 },
  { round: 'SF', first: 29, last: 30, prevFirst: 25 },
  { round: 'FINAL', first: 31, last: 31, prevFirst: 29 },
];

function layerForSlot(slot: number) {
  const layer = LAYERS.find((l) => slot >= l.first && slot <= l.last);
  if (!layer) throw new RangeError(`slot out of range: ${slot}`);
  return layer;
}

export function roundForSlot(slot: number): Round {
  return layerForSlot(slot).round;
}

export function slotsForRound(round: Round): number[] {
  const layer = LAYERS.find((l) => l.round === round)!;
  const slots: number[] = [];
  for (let s = layer.first; s <= layer.last; s++) slots.push(s);
  return slots;
}

// FIFA WC26 official routing. Match numbers 73–104 map to app slots
// (slot = match − 72; Final match 104 → slot 31). Each higher slot lists its two feeders.
const FEEDERS: Record<number, [number, number]> = {
  17: [2, 5],  18: [1, 3],  19: [4, 6],  20: [7, 8],
  21: [11, 12], 22: [9, 10], 23: [14, 16], 24: [13, 15],
  25: [17, 18], 26: [21, 22], 27: [19, 20], 28: [23, 24],
  29: [25, 26], 30: [27, 28],
  31: [29, 30],
};

export function feedersForSlot(slot: number): [number, number] | null {
  layerForSlot(slot); // validates range (throws RangeError outside 1..31)
  return FEEDERS[slot] ?? null;
}

export const ROUND_POINTS: Record<Round, number> = {
  R32: 1,
  R16: 2,
  QF: 4,
  SF: 8,
  FINAL: 16,
};

export type SlotResult = { teamA: string | null; teamB: string | null; winner: string | null };

export function participantsForSlot(
  slot: number,
  matches: Record<number, SlotResult>,
): { teamA: string | null; teamB: string | null } {
  const feeders = feedersForSlot(slot);
  if (feeders === null) {
    const m = matches[slot];
    return { teamA: m?.teamA ?? null, teamB: m?.teamB ?? null };
  }
  const [a, b] = feeders;
  return { teamA: matches[a]?.winner ?? null, teamB: matches[b]?.winner ?? null };
}
