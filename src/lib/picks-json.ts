import type { Picks } from '@/lib/bracket-picks';

/** Turn a stored JSON blob into a numeric-keyed Picks map (rejects arrays / non-string values / non-integer keys). */
export function coercePicks(raw: unknown): Picks {
  const out: Picks = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const slot = Number(k);
      if (Number.isInteger(slot) && typeof v === 'string') out[slot] = v;
    }
  }
  return out;
}
