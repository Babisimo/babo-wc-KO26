// Reconcile the heuristic R32 projection with the real fixtures once they are published.
//
// The projection's group-winner/runner placements are structurally fixed and always
// correct; only the best-third-place *slot allocation* is a heuristic (see assignThirds
// in wc26-seeding.ts) and can differ from FIFA's official table. As soon as the real
// draw is scheduled, ESPN's schedule feed carries the true fixtures — we map each one to
// its slot by its structurally-fixed (non-third) "anchor" team(s) and override, so the
// preview is exact whenever the real draw is knowable, and falls back to the heuristic
// only before fixtures exist.

import type { OfficialR32 } from '@/lib/bracket-picks';

export type FixturePair = { teamA: string; teamB: string };

type Slotted = { teamA: string | null; teamB: string | null };

/**
 * Parse an ESPN scoreboard payload into resolved R32 team pairs. `resolve` maps a
 * competitor's (abbreviation, displayName) to an internal team code, or null for a
 * placeholder/unknown (e.g. a Round-of-16 "Round of 32 X Winner" entry), which is skipped.
 */
export function mapEspnSchedule(
  json: unknown,
  resolve: (abbr: string | undefined, name: string | undefined) => string | null,
): FixturePair[] {
  const root = json as { events?: unknown[] } | null;
  const events = Array.isArray(root?.events) ? root!.events : [];
  const out: FixturePair[] = [];
  const seen = new Set<string>();
  for (const ev of events as Array<{ competitions?: Array<{ competitors?: Array<{ team?: { abbreviation?: string; displayName?: string } }> }> }>) {
    const cs = ev?.competitions?.[0]?.competitors ?? [];
    if (cs.length !== 2) continue;
    const a = resolve(cs[0]?.team?.abbreviation, cs[0]?.team?.displayName);
    const b = resolve(cs[1]?.team?.abbreviation, cs[1]?.team?.displayName);
    if (!a || !b) continue;
    const key = [a, b].sort().join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ teamA: a, teamB: b });
  }
  return out;
}

/** The structurally-fixed teams of a pairing (everything that isn't a third place). */
function anchorKey(pair: Slotted | FixturePair, isThird: (code: string) => boolean): string {
  return [pair.teamA, pair.teamB]
    .filter((c): c is string => !!c && !isThird(c))
    .sort()
    .join('+');
}

/** anchor key -> slot, from the (always-complete) projected map. */
function anchorIndex(projected: OfficialR32, isThird: (code: string) => boolean): Map<string, number> {
  const idx = new Map<string, number>();
  for (const [slot, pair] of Object.entries(projected)) {
    const key = anchorKey(pair, isThird);
    if (key) idx.set(key, Number(slot));
  }
  return idx;
}

function applyFixtures(target: OfficialR32, fixtures: FixturePair[], idx: Map<string, number>, isThird: (code: string) => boolean): OfficialR32 {
  const out: OfficialR32 = {};
  for (const [slot, pair] of Object.entries(target)) out[Number(slot)] = { ...pair };
  for (const f of fixtures) {
    const slot = idx.get(anchorKey(f, isThird));
    if (slot == null) continue;
    out[slot] = { teamA: f.teamA, teamB: f.teamB };
  }
  return out;
}

/**
 * Override projected/confirmed slots with the real fixtures wherever a fixture can be
 * matched to a slot by its anchor team(s). Slots without a matching fixture keep their
 * heuristic value, so a partial schedule degrades gracefully.
 */
export function reconcileSeedWithFixtures(
  seed: { projected: OfficialR32; confirmed: OfficialR32 },
  fixtures: FixturePair[],
  isThird: (code: string) => boolean,
): { projected: OfficialR32; confirmed: OfficialR32 } {
  const idx = anchorIndex(seed.projected, isThird);
  return {
    projected: applyFixtures(seed.projected, fixtures, idx, isThird),
    confirmed: applyFixtures(seed.confirmed, fixtures, idx, isThird),
  };
}

/**
 * Slots where the heuristic projection disagrees with the real fixtures — for telemetry /
 * a guard. Empty once the projection matches reality.
 */
export function fixtureMismatches(
  projected: OfficialR32,
  fixtures: FixturePair[],
  isThird: (code: string) => boolean,
): { slot: number; projected: FixturePair; actual: FixturePair }[] {
  const idx = anchorIndex(projected, isThird);
  const out: { slot: number; projected: FixturePair; actual: FixturePair }[] = [];
  for (const f of fixtures) {
    const slot = idx.get(anchorKey(f, isThird));
    if (slot == null) continue;
    const p = projected[slot];
    const have = new Set([p.teamA, p.teamB]);
    if (have.has(f.teamA) && have.has(f.teamB)) continue;
    out.push({ slot, projected: { teamA: p.teamA ?? '', teamB: p.teamB ?? '' }, actual: f });
  }
  return out.sort((a, b) => a.slot - b.slot);
}
