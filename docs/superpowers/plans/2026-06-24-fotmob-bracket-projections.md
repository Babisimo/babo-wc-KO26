# FotMob Bracket — Live Projections + Toggle (Plan 2 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive the `/official` bracket from live ESPN group standings — projecting the Round-of-32 field as it stands and showing only mathematically-final slots under a "Confirmed" toggle.

**Architecture:** A pure seeding engine (`wc26-seeding.ts`) turns 12 group standings into an R32 field using FIFA's official position schedule + best-8 third-place logic. A standings adapter (`standings-feed.ts`) maps ESPN's public JSON into the engine's input. A server action fetches standings, runs the engine, and returns two `SlotView[]` arrays (projected + confirmed); the `/official` page renders them behind an "As it stands / Confirmed" toggle. Plan 1 already shipped the bracket UI this renders into.

**Tech Stack:** Next.js 15 (App Router, stock/modified), React 19, TypeScript, Vitest 4. No new dependencies.

## Global Constraints

- This is **Plan 2 of 2**; Plan 1 (FIFA routing, flags, single-direction layout, mobile) is merged to `master`. Build on `master` (or a fresh branch off it).
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code — modified Next.js (per `AGENTS.md`).
- Windows/Prisma gotcha: this plan adds NO Prisma/DB schema changes; the engine and adapter are pure. The server action only reads. The dev-server EPERM lock is irrelevant here.
- **Data source is ESPN only**, never FotMob. Standings endpoint: `https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings` (public, no auth; verified live).
- Reuse `resolveCode` from `src/lib/team-resolve.ts` for ESPN-name → team-code resolution. Reuse `OfficialR32`/`contestantsForSlot` from `src/lib/bracket-picks.ts`, `participantsForSlot`/`feedersForSlot`/`roundForSlot` from `src/lib/bracket-structure.ts`, and `SlotView` from `src/lib/bracket-view.ts`.
- Third-place tiebreakers: points → goal difference → goals scored are exact from ESPN; **conduct and FIFA-ranking tiebreakers are approximated in v1** (documented), per the approved spec.
- Third-place slot allocation: use a **deterministic eligibility-matching algorithm** honoring FIFA's published per-slot eligibility sets — NOT the official 495-row combination table. Document this as a v1 approximation in the engine file.
- "Confirmed" v1: a group's winner/runner-up is confirmed once that group has played all matches; third-place slots confirmed only once **all 12 groups** are complete.
- Spec: `docs/superpowers/specs/2026-06-24-fotmob-bracket-projections-design.md`.
- End every commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Verify commands: `npx tsc --noEmit` · `npx vitest run` · `npx next build`.

---

## Reference data (used by Tasks 1–2)

**R32 position schedule** (app slot → its two positions), from FIFA's official bracket
(Wikipedia "2026 FIFA World Cup knockout stage"; app slot = FIFA match − 72). `W-X` =
winner of group X, `R-X` = runner-up of group X, `T:<letters>` = the qualifying
third-placed team allocated from one of those eligible groups:

```
 1: R-A , R-B            9: W-D , T:BEFIJ
 2: W-E , T:ABCDF       10: W-G , T:AEHIJ
 3: W-F , R-C           11: R-K , R-L
 4: W-C , R-F           12: W-H , R-J
 5: W-I , T:CDFGH       13: W-B , T:EFGIJ
 6: R-E , R-I           14: W-J , R-H
 7: W-A , T:CEFHI       15: W-K , T:DEIJL
 8: W-L , T:EHIJK       16: R-D , R-G
```

The eight third-place slots are {2,5,7,8,9,10,13,15} with the eligibility sets shown.
Winners of groups A, B, D, E, G, I, K, L face a third; winners of C, F, H, J face a
runner-up. Eligibility sets verified to admit a perfect matching for any choice of 8
qualifying groups.

**Third-place ranking criteria (FIFA), in order:** points, goal difference, goals scored,
[conduct, FIFA ranking — approximated/omitted in v1].

---

## Task 1: Seeding engine — positions, types, third-place ranking

**Files:**
- Create: `src/lib/wc26-seeding.ts`
- Test: `src/lib/wc26-seeding.test.ts`

**Interfaces:**
- Produces:
  - `type StandingRow = { code: string | null; rank: number; points: number; gd: number; gf: number }`
  - `type GroupStanding = { group: string; complete: boolean; teams: StandingRow[] }` (`teams` ordered by `rank`)
  - `rankThirds(groups: GroupStanding[]): string[]` — returns the group letters of the **best 8** third-placed teams, ordered best→worst, by points → gd → gf (ties beyond that broken by group letter ascending, deterministic).
- Consumes: nothing (pure).

- [ ] **Step 1: Write failing tests** — `src/lib/wc26-seeding.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { rankThirds, type GroupStanding } from './wc26-seeding';

// helper: build a group where the 3rd-place row has given points/gd/gf
function grp(letter: string, third: { points: number; gd: number; gf: number }, complete = true): GroupStanding {
  return {
    group: letter,
    complete,
    teams: [
      { code: `${letter}1`, rank: 1, points: 9, gd: 9, gf: 9 },
      { code: `${letter}2`, rank: 2, points: 6, gd: 3, gf: 5 },
      { code: `${letter}3`, rank: 3, points: third.points, gd: third.gd, gf: third.gf },
      { code: `${letter}4`, rank: 4, points: 0, gd: -9, gf: 0 },
    ],
  };
}

const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

describe('rankThirds', () => {
  it('returns the 8 best third-placed group letters, ordered by points then gd then gf', () => {
    // Give each group's 3rd a distinct points total so order is unambiguous.
    const groups = LETTERS.map((l, i) => grp(l, { points: i, gd: 0, gf: 0 }));
    const best = rankThirds(groups);
    expect(best).toHaveLength(8);
    // highest points = L(11) down to E(4); A(0)..D(3) eliminated
    expect(best).toEqual(['L','K','J','I','H','G','F','E']);
  });

  it('breaks point ties by goal difference, then goals scored', () => {
    const groups = LETTERS.map((l) => grp(l, { points: 3, gd: 0, gf: 0 }));
    // all tied on points; give A best gd, B second by gf
    groups[0] = grp('A', { points: 3, gd: 5, gf: 5 });
    groups[1] = grp('B', { points: 3, gd: 2, gf: 9 });
    const best = rankThirds(groups);
    expect(best[0]).toBe('A'); // best gd
    expect(best[1]).toBe('B'); // next: gd 2 beats the rest at gd 0
  });

  it('breaks remaining ties deterministically by group letter', () => {
    const groups = LETTERS.map((l) => grp(l, { points: 3, gd: 0, gf: 0 }));
    const best = rankThirds(groups);
    expect(best).toEqual(['A','B','C','D','E','F','G','H']); // alphabetical when fully tied
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/wc26-seeding.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the types, schedule, and `rankThirds`** — `src/lib/wc26-seeding.ts`

```ts
// Live WC26 Round-of-32 seeding from group standings.
//
// v1 approximations (documented, per the approved spec):
//  - Third-place tiebreakers use points -> goal difference -> goals scored (exact from
//    ESPN). FIFA's deeper conduct + FIFA-ranking tiebreakers are NOT applied; remaining
//    ties break by group letter (deterministic).
//  - Third-place SLOT allocation uses a deterministic eligibility-matching algorithm
//    (Task 2), not FIFA's official 495-row combination table. The result always honors
//    the published per-slot eligibility sets, but may differ from the official table in
//    rare combinations. Encoding the exact table is a future enhancement.

export type StandingRow = { code: string | null; rank: number; points: number; gd: number; gf: number };
export type GroupStanding = { group: string; complete: boolean; teams: StandingRow[] };

// Position tokens for the R32 schedule.
type Pos = { kind: 'W' | 'R'; group: string } | { kind: 'T'; eligible: string };

export const THIRD_SLOTS: Record<number, string> = {
  2: 'ABCDF', 5: 'CDFGH', 7: 'CEFHI', 8: 'EHIJK',
  9: 'BEFIJ', 10: 'AEHIJ', 13: 'EFGIJ', 15: 'DEIJL',
};

// app slot -> [position, position]
export const R32_SCHEDULE: Record<number, [Pos, Pos]> = {
  1:  [{ kind: 'R', group: 'A' }, { kind: 'R', group: 'B' }],
  2:  [{ kind: 'W', group: 'E' }, { kind: 'T', eligible: THIRD_SLOTS[2] }],
  3:  [{ kind: 'W', group: 'F' }, { kind: 'R', group: 'C' }],
  4:  [{ kind: 'W', group: 'C' }, { kind: 'R', group: 'F' }],
  5:  [{ kind: 'W', group: 'I' }, { kind: 'T', eligible: THIRD_SLOTS[5] }],
  6:  [{ kind: 'R', group: 'E' }, { kind: 'R', group: 'I' }],
  7:  [{ kind: 'W', group: 'A' }, { kind: 'T', eligible: THIRD_SLOTS[7] }],
  8:  [{ kind: 'W', group: 'L' }, { kind: 'T', eligible: THIRD_SLOTS[8] }],
  9:  [{ kind: 'W', group: 'D' }, { kind: 'T', eligible: THIRD_SLOTS[9] }],
  10: [{ kind: 'W', group: 'G' }, { kind: 'T', eligible: THIRD_SLOTS[10] }],
  11: [{ kind: 'R', group: 'K' }, { kind: 'R', group: 'L' }],
  12: [{ kind: 'W', group: 'H' }, { kind: 'R', group: 'J' }],
  13: [{ kind: 'W', group: 'B' }, { kind: 'T', eligible: THIRD_SLOTS[13] }],
  14: [{ kind: 'W', group: 'J' }, { kind: 'R', group: 'H' }],
  15: [{ kind: 'W', group: 'K' }, { kind: 'T', eligible: THIRD_SLOTS[15] }],
  16: [{ kind: 'R', group: 'D' }, { kind: 'R', group: 'G' }],
};

function thirdOf(g: GroupStanding): StandingRow | undefined {
  return g.teams.find((t) => t.rank === 3);
}

/** Group letters of the best 8 third-placed teams, best first. */
export function rankThirds(groups: GroupStanding[]): string[] {
  const ranked = [...groups]
    .map((g) => ({ group: g.group, t: thirdOf(g) }))
    .filter((x): x is { group: string; t: StandingRow } => !!x.t)
    .sort((a, b) =>
      b.t.points - a.t.points ||
      b.t.gd - a.t.gd ||
      b.t.gf - a.t.gf ||
      a.group.localeCompare(b.group),
    );
  return ranked.slice(0, 8).map((x) => x.group);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/wc26-seeding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wc26-seeding.ts src/lib/wc26-seeding.test.ts
git commit -m "feat: WC26 seeding engine - schedule + third-place ranking

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Seeding engine — third allocation + R32 assembly

**Files:**
- Modify: `src/lib/wc26-seeding.ts`
- Test: `src/lib/wc26-seeding.test.ts` (add cases)

**Interfaces:**
- Consumes: `rankThirds`, `R32_SCHEDULE`, `THIRD_SLOTS`, `GroupStanding` (Task 1); `OfficialR32` from `@/lib/bracket-picks`.
- Produces:
  - `assignThirds(qualified: string[]): Record<number, string>` — maps each third-slot (2,5,…) to a qualifying **group letter**, a perfect matching honoring `THIRD_SLOTS` eligibility; deterministic. Throws `Error` if no complete matching exists (should never happen for valid input).
  - `seedR32(groups: GroupStanding[]): { projected: OfficialR32; confirmedSlots: Set<number> }` — full R32 field from standings, plus the set of slots whose teams are mathematically final.

- [ ] **Step 1: Add failing tests** to `src/lib/wc26-seeding.test.ts`

```ts
import { assignThirds, seedR32 } from './wc26-seeding';

// Build all 12 groups, fully complete, winners/runners coded "<L>1"/"<L>2"/"<L>3".
function fullGroups(thirdPoints: Record<string, number> = {}): GroupStanding[] {
  return LETTERS.map((l) =>
    grp(l, { points: thirdPoints[l] ?? 3, gd: 0, gf: 0 }, true),
  );
}

describe('assignThirds', () => {
  it('assigns every third-slot to an eligible qualifying group (perfect matching)', () => {
    // qualifying = the 8 groups A,B,C,D,E,F,G,H
    const qualified = ['A','B','C','D','E','F','G','H'];
    const m = assignThirds(qualified);
    const slots = Object.keys(m).map(Number).sort((a, b) => a - b);
    expect(slots).toEqual([2,5,7,8,9,10,13,15]);
    // each assigned group is eligible for its slot and is in the qualified set
    for (const [slot, g] of Object.entries(m)) {
      expect(THIRD_SLOTS[Number(slot)]).toContain(g);
      expect(qualified).toContain(g);
    }
    // bijection: 8 distinct groups used
    expect(new Set(Object.values(m)).size).toBe(8);
  });

  it('is deterministic for the same qualifying set', () => {
    const q = ['A','B','C','D','E','F','G','H'];
    expect(assignThirds(q)).toEqual(assignThirds(q));
  });
});

describe('seedR32', () => {
  it('fills all 16 R32 slots with winners, runners-up, and allocated thirds', () => {
    const { projected } = seedR32(fullGroups());
    for (let s = 1; s <= 16; s++) {
      expect(projected[s]?.teamA).toBeTruthy();
      expect(projected[s]?.teamB).toBeTruthy();
    }
    // slot 1 = R-A vs R-B
    expect(projected[1]).toEqual({ teamA: 'A2', teamB: 'B2' });
    // slot 3 = W-F vs R-C
    expect(projected[3]).toEqual({ teamA: 'F1', teamB: 'C2' });
  });

  it('marks every slot confirmed when all 12 groups are complete', () => {
    const { confirmedSlots } = seedR32(fullGroups());
    expect(confirmedSlots.size).toBe(16);
  });

  it('leaves third-slots unconfirmed while any group is still in progress', () => {
    const groups = fullGroups();
    groups[11] = grp('L', { points: 3, gd: 0, gf: 0 }, false); // group L not complete
    const { confirmedSlots } = seedR32(groups);
    // a non-third slot whose two groups are both complete stays confirmed (e.g. slot 1: A,B)
    expect(confirmedSlots.has(1)).toBe(true);
    // every third-slot is unconfirmed because best-8 needs all 12 complete
    for (const s of [2,5,7,8,9,10,13,15]) expect(confirmedSlots.has(s)).toBe(false);
    // slot 11 (R-K vs R-L) references incomplete group L -> unconfirmed
    expect(confirmedSlots.has(11)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/lib/wc26-seeding.test.ts`
Expected: FAIL — `assignThirds`/`seedR32` not exported.

- [ ] **Step 3: Implement allocation + assembly** — append to `src/lib/wc26-seeding.ts`

```ts
import type { OfficialR32 } from '@/lib/bracket-picks';

const THIRD_SLOT_NUMS = [2, 5, 7, 8, 9, 10, 13, 15] as const;

/**
 * Perfect matching of the 8 third-slots to the 8 qualifying groups, honoring
 * THIRD_SLOTS eligibility. Deterministic backtracking: slots in ascending order, each
 * tries eligible unused groups in alphabetical order; first complete matching wins.
 */
export function assignThirds(qualified: string[]): Record<number, string> {
  const qset = new Set(qualified);
  const slots = [...THIRD_SLOT_NUMS];
  const used = new Set<string>();
  const result: Record<number, string> = {};

  function solve(i: number): boolean {
    if (i === slots.length) return true;
    const slot = slots[i];
    const eligible = THIRD_SLOTS[slot]
      .split('')
      .filter((g) => qset.has(g) && !used.has(g))
      .sort();
    for (const g of eligible) {
      used.add(g);
      result[slot] = g;
      if (solve(i + 1)) return true;
      used.delete(g);
      delete result[slot];
    }
    return false;
  }

  if (!solve(0)) throw new Error(`no valid third-place allocation for [${qualified.join(',')}]`);
  return result;
}

function byLetter(groups: GroupStanding[]): Map<string, GroupStanding> {
  return new Map(groups.map((g) => [g.group, g]));
}
function rowAtRank(g: GroupStanding | undefined, rank: number): string | null {
  return g?.teams.find((t) => t.rank === rank)?.code ?? null;
}

/** Full R32 field from current standings, plus the set of mathematically-final slots. */
export function seedR32(groups: GroupStanding[]): { projected: OfficialR32; confirmedSlots: Set<number> } {
  const map = byLetter(groups);
  const allComplete = groups.length === 12 && groups.every((g) => g.complete);
  const qualifiedThirds = rankThirds(groups);
  const thirdAssign = assignThirds(qualifiedThirds); // slot -> group letter

  const projected: OfficialR32 = {};
  const confirmedSlots = new Set<number>();

  // Resolve one position to a team code + whether it is mathematically final.
  // `slot` is needed only for third positions (it selects the allocated group).
  function resolve(p: Pos, slot: number): { code: string | null; confirmed: boolean } {
    if (p.kind === 'W') return { code: rowAtRank(map.get(p.group), 1), confirmed: map.get(p.group)?.complete ?? false };
    if (p.kind === 'R') return { code: rowAtRank(map.get(p.group), 2), confirmed: map.get(p.group)?.complete ?? false };
    // third: the allocated group's 3rd-place team; final only once ALL groups are complete
    return { code: rowAtRank(map.get(thirdAssign[slot]), 3), confirmed: allComplete };
  }

  for (let slot = 1; slot <= 16; slot++) {
    const [p1, p2] = R32_SCHEDULE[slot];
    const r1 = resolve(p1, slot);
    const r2 = resolve(p2, slot);
    projected[slot] = { teamA: r1.code, teamB: r2.code };
    if (r1.confirmed && r2.confirmed) confirmedSlots.add(slot);
  }

  return { projected, confirmedSlots };
}
```

- [ ] **Step 4: Run to verify all engine tests pass**

Run: `npx vitest run src/lib/wc26-seeding.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wc26-seeding.ts src/lib/wc26-seeding.test.ts
git commit -m "feat: WC26 third-place allocation + R32 assembly with confirmed flags

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: ESPN standings adapter

**Files:**
- Create: `src/lib/standings-feed.ts`
- Create: `src/lib/standings-feed.fixture.json` (a trimmed real ESPN payload: ≥2 groups, ≥3 teams each, with the stat names below)
- Test: `src/lib/standings-feed.test.ts`

**Interfaces:**
- Consumes: `resolveCode` from `@/lib/team-resolve`; `GroupStanding`/`StandingRow` from `@/lib/wc26-seeding`.
- Produces: `mapEspnStandings(json: unknown): GroupStanding[]` — maps ESPN's `children[]` groups into engine input. Group letter parsed from `name` ("Group A" → "A"). Per entry: `code` via `resolveCode(team.displayName)`, `rank`/`points`/`gd`(=pointDifferential)/`gf`(=pointsFor) from `stats[].value`, ordered by `rank`. `complete` = every team in the group has `gamesPlayed.value === 3`.

- [ ] **Step 1: Create the fixture** — `src/lib/standings-feed.fixture.json`

Capture from the live endpoint (or hand-build matching its shape). Minimum viable shape:

```json
{
  "children": [
    {
      "name": "Group A",
      "standings": {
        "entries": [
          { "team": { "displayName": "Mexico" },      "stats": [ {"name":"rank","value":1}, {"name":"points","value":7}, {"name":"pointDifferential","value":4}, {"name":"pointsFor","value":5}, {"name":"gamesPlayed","value":3} ] },
          { "team": { "displayName": "USA" },          "stats": [ {"name":"rank","value":2}, {"name":"points","value":5}, {"name":"pointDifferential","value":2}, {"name":"pointsFor","value":4}, {"name":"gamesPlayed","value":3} ] },
          { "team": { "displayName": "Norway" },       "stats": [ {"name":"rank","value":3}, {"name":"points","value":4}, {"name":"pointDifferential","value":0}, {"name":"pointsFor","value":3}, {"name":"gamesPlayed","value":3} ] },
          { "team": { "displayName": "Saudi Arabia" }, "stats": [ {"name":"rank","value":4}, {"name":"points","value":0}, {"name":"pointDifferential","value":-6}, {"name":"pointsFor","value":1}, {"name":"gamesPlayed","value":3} ] }
        ]
      }
    },
    {
      "name": "Group B",
      "standings": {
        "entries": [
          { "team": { "displayName": "Canada" }, "stats": [ {"name":"rank","value":1}, {"name":"points","value":6}, {"name":"pointDifferential","value":3}, {"name":"pointsFor","value":4}, {"name":"gamesPlayed","value":2} ] },
          { "team": { "displayName": "Croatia" }, "stats": [ {"name":"rank","value":2}, {"name":"points","value":4}, {"name":"pointDifferential","value":1}, {"name":"pointsFor","value":3}, {"name":"gamesPlayed","value":2} ] }
        ]
      }
    }
  ]
}
```

- [ ] **Step 2: Write failing tests** — `src/lib/standings-feed.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { mapEspnStandings } from './standings-feed';
import fixture from './standings-feed.fixture.json';

describe('mapEspnStandings', () => {
  it('maps ESPN children into GroupStanding[] with parsed letters and stats', () => {
    const groups = mapEspnStandings(fixture);
    const a = groups.find((g) => g.group === 'A')!;
    expect(a.complete).toBe(true);
    expect(a.teams[0]).toMatchObject({ code: 'MEX', rank: 1, points: 7, gd: 4, gf: 5 });
    expect(a.teams.map((t) => t.rank)).toEqual([1, 2, 3, 4]); // ordered by rank
  });
  it('marks a group incomplete when any team has gamesPlayed < 3', () => {
    const groups = mapEspnStandings(fixture);
    expect(groups.find((g) => g.group === 'B')!.complete).toBe(false);
  });
  it('returns [] for a malformed payload', () => {
    expect(mapEspnStandings(null)).toEqual([]);
    expect(mapEspnStandings({})).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/lib/standings-feed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement** — `src/lib/standings-feed.ts`

```ts
import { resolveCode } from '@/lib/team-resolve';
import type { GroupStanding, StandingRow } from '@/lib/wc26-seeding';

interface EspnEntry { team?: { displayName?: string }; stats?: Array<{ name?: string; value?: number }> }
interface EspnGroup { name?: string; standings?: { entries?: EspnEntry[] } }

function statVal(entry: EspnEntry, name: string): number {
  return entry.stats?.find((s) => s.name === name)?.value ?? 0;
}

/** Map an ESPN soccer standings payload into the seeding engine's input. */
export function mapEspnStandings(json: unknown): GroupStanding[] {
  const root = json as { children?: unknown[] } | null;
  const children = Array.isArray(root?.children) ? root!.children : [];
  const out: GroupStanding[] = [];
  for (const child of children as EspnGroup[]) {
    const m = /Group\s+([A-L])/i.exec(child?.name ?? '');
    if (!m) continue;
    const entries = child.standings?.entries ?? [];
    const teams: StandingRow[] = entries.map((e) => ({
      code: resolveCode(e.team?.displayName ?? ''),
      rank: statVal(e, 'rank'),
      points: statVal(e, 'points'),
      gd: statVal(e, 'pointDifferential'),
      gf: statVal(e, 'pointsFor'),
    }));
    teams.sort((a, b) => a.rank - b.rank);
    const complete = entries.length > 0 && entries.every((e) => statVal(e, 'gamesPlayed') === 3);
    out.push({ group: m[1].toUpperCase(), complete, teams });
  }
  return out;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/standings-feed.test.ts`
Expected: PASS. (If `resolveCode` doesn't recognize a fixture name, use a name it does — check `src/lib/team-resolve.ts`/`teams.ts` — rather than weakening the assertion.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/standings-feed.ts src/lib/standings-feed.fixture.json src/lib/standings-feed.test.ts
git commit -m "feat: ESPN standings adapter -> GroupStanding[]

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Projection server action

**Files:**
- Create: `src/app/actions/projection.ts`

**Interfaces:**
- Consumes: `mapEspnStandings` (Task 3), `seedR32` (Task 2), `buildBracketView` from `@/lib/bracket-view`, `OfficialR32` from `@/lib/bracket-picks`.
- Produces: `getProjectedBracket(): Promise<{ available: boolean; asItStands: SlotView[]; confirmed: SlotView[] }>` — fetches ESPN standings, runs the engine, and returns two `SlotView[]` arrays (the projected field, and the same field with only confirmed slots filled). `available:false` (empty arrays) when the fetch fails or returns no groups.

- [ ] **Step 1: Read the bracket-view builder + an existing action**

Read `src/lib/bracket-view.ts` (`buildBracketView` signature and `SlotView` shape) and `src/app/actions/results.ts` (the established feed-fetch pattern + any env provider toggle) so this action matches house style. `buildBracketView(official, picks, winners)` returns `SlotView[]`; here `picks` and `winners` are empty (no user, no results — projection only).

- [ ] **Step 2: Implement** — `src/app/actions/projection.ts`

```ts
'use server';

import { mapEspnStandings } from '@/lib/standings-feed';
import { seedR32 } from '@/lib/wc26-seeding';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';
import type { OfficialR32 } from '@/lib/bracket-picks';

const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';

const EMPTY = { available: false, asItStands: [] as SlotView[], confirmed: [] as SlotView[] };

export async function getProjectedBracket(): Promise<{ available: boolean; asItStands: SlotView[]; confirmed: SlotView[] }> {
  let json: unknown;
  try {
    const res = await fetch(ESPN_STANDINGS, { cache: 'no-store' });
    if (!res.ok) return EMPTY;
    json = await res.json();
  } catch {
    return EMPTY;
  }

  const groups = mapEspnStandings(json);
  if (groups.length === 0) return EMPTY;

  const { projected, confirmedSlots } = seedR32(groups);

  // confirmed view: same field, but null out any slot not yet mathematically final
  const confirmedR32: OfficialR32 = {};
  for (let s = 1; s <= 16; s++) {
    confirmedR32[s] = confirmedSlots.has(s)
      ? projected[s]
      : { teamA: null, teamB: null };
  }

  return {
    available: true,
    asItStands: buildBracketView(projected, {}, {}),
    confirmed: buildBracketView(confirmedR32, {}, {}),
  };
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean. (If `buildBracketView`'s parameter types differ from `(OfficialR32, {}, {})`, adapt the call to its real signature — read it in Step 1; do not change the lib.)

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/projection.ts
git commit -m "feat: getProjectedBracket action (ESPN standings -> projected + confirmed views)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `/official` toggle UI

**Files:**
- Create: `src/app/official/OfficialBracketView.tsx` (client wrapper with the toggle)
- Modify: `src/app/official/page.tsx`
- Modify: `src/app/globals.css` (`.fm-toggle` segmented control)

**Interfaces:**
- Consumes: `getProjectedBracket` (Task 4), `getOfficialBracket` (existing, `@/app/actions/bracket`), `officialR32IsSet`/`officialR32FromSlots` (`@/lib/official-r32`), `MarchMadnessBracket` (`@/app/_components/MarchMadnessBracket`), `SlotView`.
- Produces: a client component `OfficialBracketView({ asItStands, confirmed }: { asItStands: SlotView[]; confirmed: SlotView[] })` rendering a segmented "As it stands / Confirmed" toggle that swaps which `SlotView[]` the bracket shows (default: As it stands).

- [ ] **Step 1: Create the client toggle wrapper** — `src/app/official/OfficialBracketView.tsx`

```tsx
'use client';

import { useState } from 'react';
import type { SlotView } from '@/lib/bracket-view';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';

export default function OfficialBracketView({
  asItStands,
  confirmed,
}: {
  asItStands: SlotView[];
  confirmed: SlotView[];
}) {
  const [mode, setMode] = useState<'live' | 'confirmed'>('live');
  const slots = mode === 'live' ? asItStands : confirmed;
  return (
    <>
      <div className="fm-toggle" role="tablist" aria-label="Bracket view">
        <button type="button" role="tab" aria-selected={mode === 'live'}
          className={`seg${mode === 'live' ? ' active' : ''}`} onClick={() => setMode('live')}>
          As it stands
        </button>
        <button type="button" role="tab" aria-selected={mode === 'confirmed'}
          className={`seg${mode === 'confirmed' ? ' active' : ''}`} onClick={() => setMode('confirmed')}>
          Confirmed
        </button>
      </div>
      <MarchMadnessBracket slots={slots} />
    </>
  );
}
```

- [ ] **Step 2: Wire the page** — modify `src/app/official/page.tsx`

Keep the existing auth gate and the official-from-DB path. When the official R32 is NOT yet set in the DB, fall back to projections with the toggle. Concretely, after the auth check, replace the body that fetches `getOfficialBracket()` with:

```tsx
  const official = await getOfficialBracket();
  const officialR32 = officialR32FromSlots(official.slots);

  // Once the real R32 is set, show it with live results (existing behavior).
  if (officialR32IsSet(officialR32)) {
    const decided = official.slots.filter((s) => s.winner).length;
    const view: SlotView[] = official.slots.map((s) => ({
      slot: s.slot, round: s.round, teamA: s.teamA, teamB: s.teamB,
      pick: null, officialWinner: s.winner, status: s.winner ? 'correct' : 'pending',
    }));
    return (
      <main className="shell">
        <header className="reveal" style={{ marginBottom: 22 }}>
          <p className="eyebrow">The real thing</p><h1>Official Bracket</h1>
          <p className="lead">The actual Round-of-32 draw and results as they come in. Teams that advance are marked in gold.</p>
        </header>
        <section className="panel reveal reveal-2">
          <div className="panel-head"><h2>Knockout tree</h2><span className="pill">{decided} / {official.slots.length} decided</span></div>
          <MarchMadnessBracket slots={view} />
        </section>
      </main>
    );
  }

  // Group stage still in progress -> live projection with the toggle.
  const projection = await getProjectedBracket();
  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 22 }}>
        <p className="eyebrow">The road to the final</p><h1>Official Bracket</h1>
        <p className="lead">
          Projected from the live group standings. Switch to <strong>Confirmed</strong> to see only matchups that are mathematically locked.
        </p>
      </header>
      <section className="panel reveal reveal-2">
        {projection.available ? (
          <OfficialBracketView asItStands={projection.asItStands} confirmed={projection.confirmed} />
        ) : (
          <p className="muted">The bracket isn&apos;t available yet — check back once group-stage results are in.</p>
        )}
      </section>
    </main>
  );
```

Update the imports at the top of `page.tsx` accordingly: add `getProjectedBracket` from `@/app/actions/projection`, `officialR32FromSlots`/`officialR32IsSet` from `@/lib/official-r32`, and `OfficialBracketView` from `./OfficialBracketView`. Keep `export const dynamic = 'force-dynamic';`.

- [ ] **Step 3: Add the toggle CSS** — append to `src/app/globals.css`

```css
/* As it stands / Confirmed toggle */
.fm-toggle { display: inline-flex; margin-bottom: 14px; padding: 3px; border: 1px solid var(--chalk); border-radius: 999px; background: rgba(255,255,255,0.06); }
.fm-toggle .seg { border: 0; background: transparent; color: var(--line-dim); font-size: 0.8rem; font-weight: 600; padding: 6px 16px; border-radius: 999px; cursor: pointer; }
.fm-toggle .seg.active { background: var(--gold); color: var(--ink); font-weight: 800; }
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/official` still compiles (dynamic).

- [ ] **Step 5: Commit**

```bash
git add src/app/official/OfficialBracketView.tsx src/app/official/page.tsx src/app/globals.css
git commit -m "feat: As-it-stands/Confirmed toggle on /official (live projections)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: all pass; vitest includes the new `wc26-seeding` + `standings-feed` suites; build compiles `/official`.

- [ ] **Step 2: Live check (logged in)**

`npm run dev`, log in as admin (`gondaniel852@gmail.com`), open `/official`. With the preview R32 set in the DB you'll see the official-results path; to exercise projections, view it against a DB where the official R32 is not fully set (or temporarily confirm the projection path renders the toggle and that "Confirmed" hides not-yet-final slots while "As it stands" fills all 16). Confirm the toggle switches the field and the bracket re-renders without layout shift.

- [ ] **Step 3: Spot-check projection sanity**

With live ESPN standings, confirm the projected R32 matchups look plausible against a public source (e.g. FotMob/ESPN bracket) — winners/runners-up land in the right slots; the 8 best thirds are placed in eligible slots. Note any mismatch (expected in rare third-allocation combinations per the documented v1 approximation).

---

## Self-review (done while writing)

- **Spec coverage:** projection engine (3rd-place ranking + best-8 + allocation) → Tasks 1–2; ESPN adapter → Task 3; server action producing projected+confirmed → Task 4; `/official` As-it-stands/Confirmed toggle → Task 5; verification → Task 6. Data source is ESPN only. v1 approximations (deep tiebreakers; eligibility-matching vs the 495-row table; group-complete confirmation rule) are documented in `wc26-seeding.ts` and match the spec's resolved decisions.
- **Placeholder scan:** clean. `resolve(p, slot)` handles W/R/T directly (no dead branch). Task 4 Step 1 and Task 5 Step 2 instruct reading the real `buildBracketView`/`page.tsx` signatures before transcribing, with exact fallback guidance. No "TBD"/"add error handling" placeholders.
- **Type consistency:** `GroupStanding`/`StandingRow` defined in Task 1, consumed by Tasks 2–3; `seedR32` returns `{ projected: OfficialR32; confirmedSlots: Set<number> }` consumed by Task 4; `getProjectedBracket` returns `{ available, asItStands, confirmed }` consumed by Task 5's `OfficialBracketView`. `MarchMadnessBracket` takes `{ slots: SlotView[] }` (unchanged from Plan 1).
- **Scope:** no Prisma/schema changes; no change to the pick game or scoring; read-only ESPN fetch.
