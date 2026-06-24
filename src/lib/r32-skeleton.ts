export type R32Entry = { slot: number; teamA: string; teamB: string; kickoff: string | null };

export function validateR32Skeleton(
  entries: R32Entry[],
  knownCodes: Set<string>,
): { ok: true } | { ok: false; error: string } {
  if (entries.length !== 16) {
    return { ok: false, error: 'Exactly 16 Round-of-32 matchups are required.' };
  }
  const seen = new Set<number>();
  for (const e of entries) {
    if (!Number.isInteger(e.slot) || e.slot < 1 || e.slot > 16) {
      return { ok: false, error: `Slot ${e.slot} is not a valid Round-of-32 slot (1–16).` };
    }
    if (seen.has(e.slot)) {
      return { ok: false, error: `Slot ${e.slot} is listed more than once.` };
    }
    seen.add(e.slot);
    if (!knownCodes.has(e.teamA) || !knownCodes.has(e.teamB)) {
      return { ok: false, error: `Slot ${e.slot} has an unknown team code.` };
    }
    if (e.teamA === e.teamB) {
      return { ok: false, error: `Slot ${e.slot} has the same team on both sides.` };
    }
    if (e.kickoff !== null && Number.isNaN(Date.parse(e.kickoff))) {
      return { ok: false, error: `Slot ${e.slot} has an invalid kickoff time.` };
    }
  }
  return { ok: true };
}
