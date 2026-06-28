export type SlotParticipants = { slot: number; teamA: string | null; teamB: string | null };
export type PickResult = 'pending' | 'won' | 'busted';

/** Match an ESPN fixture to its bracket slot (by the two teams), then resolve the user's pick
 *  for that slot and whether it has won/busted once the slot has an official winner. */
export function gameSlotPick(
  slots: SlotParticipants[],
  game: { teamA: string; teamB: string },
  picks: Record<number, string>,
  winners: Record<number, string | null>,
): { slot: number | null; yourPick: string | null; result: PickResult | null } {
  const pair = new Set([game.teamA, game.teamB]);
  const match = slots.find((s) => s.teamA && s.teamB && pair.has(s.teamA) && pair.has(s.teamB));
  if (!match) return { slot: null, yourPick: null, result: null };
  const pick = picks[match.slot];
  const yourPick = pick && pair.has(pick) ? pick : null;
  if (!yourPick) return { slot: match.slot, yourPick: null, result: null };
  const winner = winners[match.slot] ?? null;
  const result: PickResult = winner ? (winner === yourPick ? 'won' : 'busted') : 'pending';
  return { slot: match.slot, yourPick, result };
}
