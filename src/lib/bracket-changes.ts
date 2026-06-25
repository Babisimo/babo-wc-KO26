import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32, type Picks } from '@/lib/bracket-picks';

/**
 * Slots whose saved pick no longer matches a current contestant — because a provisional team
 * was confirmed as someone else, or the projection shifted. Walks slots in dependency order
 * (feeders first), deriving each later slot's contestants only from picks that have survived
 * so far, so a stale Round-of-32 pick correctly cascades to the downstream picks built on it.
 */
export function stalePicks(officialR32: OfficialR32, picks: Picks): number[] {
  const stale: number[] = [];
  const surviving: Picks = {};
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    const pick = picks[s];
    if (!pick) continue;
    const { teamA, teamB } = contestantsForSlot(s, officialR32, surviving);
    if (pick === teamA || pick === teamB) {
      surviving[s] = pick;
    } else {
      stale.push(s);
    }
  }
  return stale;
}
