import type { OfficialSlot } from '@/app/actions/bracket';
import type { OfficialR32 } from '@/lib/bracket-picks';

export function officialR32FromSlots(slots: OfficialSlot[]): OfficialR32 {
  const o: OfficialR32 = {};
  for (const s of slots) {
    if (s.round === 'R32') {
      o[s.slot] = { teamA: s.teamA, teamB: s.teamB };
    }
  }
  return o;
}

export function officialR32IsSet(officialR32: OfficialR32): boolean {
  for (let s = 1; s <= 16; s++) {
    const o = officialR32[s];
    if (!o || !o.teamA || !o.teamB) return false;
  }
  return true;
}
