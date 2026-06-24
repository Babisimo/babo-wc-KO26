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

export function feedersForSlot(slot: number): [number, number] | null {
  const layer = layerForSlot(slot);
  if (layer.round === 'R32') return null;
  const localIndex = slot - layer.first; // 0-based within the layer
  const a = layer.prevFirst + 2 * localIndex;
  return [a, a + 1];
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
