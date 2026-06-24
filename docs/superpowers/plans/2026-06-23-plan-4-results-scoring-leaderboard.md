# WC26 Knockout — Plan 4: Results Feed, Scoring & Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score every user's bracket against the official knockout winners and rank them on a leaderboard, with winners set either by an auto-feed (ESPN, penalty-safe) or an admin override that always wins.

**Architecture:** Pure, unit-tested cores — `scoring.ts` (round-weighted points), `leaderboard-rank.ts` (shared ranks + pot split), `official-winners.ts` (set/clear a winner with downstream cascade reconciliation, reusing Plan 3's `contestantsForSlot`), and `results-feed.ts` (ESPN knockout mapper + a resolver that fills the bracket from feed results). Thin server actions persist to `Match.actualWinner`/`winnerSource` and a `PoolConfig` pot; a leaderboard page renders standings. Admin-set winners (`winnerSource = ADMIN`) are never overwritten by the feed.

**Tech Stack:** Next.js 15.5 (App Router), Prisma 6 / PostgreSQL, TypeScript, Vitest 4. Builds on Plans 1–3.

## Global Constraints

- Builds on Plans 1–3. Reuse: `@/lib/db`; `@/lib/auth` (`auth`, `AppSession`); `@/app/actions/admin` (`requireAdmin`); `@/lib/bracket-structure` (`TOTAL_SLOTS`, `roundForSlot`, `slotsForRound`, `ROUND_POINTS`, `participantsForSlot`); `@/lib/bracket-picks` (`contestantsForSlot`, `Picks`, `OfficialR32`); `@/lib/official-r32` (`officialR32FromSlots`); `@/app/actions/bracket` (`getOfficialBracket`, `OfficialSlot`); `@/lib/teams` (`TEAMS`).
- Path alias `@/*` → `./src/*`. Colocated `*.test.ts`, run `npx vitest run`. Commit after each task. Never commit `.superpowers/`, `*.tsbuildinfo`, `.next/`, or any worktree under `.worktrees/`.
- No live DB / no live feed in this environment: verify with `npx prisma validate`/`generate` (dummy `DATABASE_URL` only if generate insists; never `db push`/`db seed`), `npx tsc --noEmit`, `npx vitest run`, `npx next build`. Network fetches (ESPN) are NOT exercised here — only their pure mappers are tested on fixtures.
- **Round points** (already defined in `bracket-structure.ts`, used here for scoring): R32 = 1, R16 = 2, QF = 4, SF = 8, FINAL = 16. Perfect bracket = 80.
- **Leaderboard ranking:** by total points descending; ties **share** a rank (1, 1, 3, …); name is the deterministic sort tiebreaker for display order only (it does NOT break the shared rank). No score tiebreaker — rank-1 users split the pot.
- **Winner precedence:** a `Match.actualWinner` set by an admin (`winnerSource = 'ADMIN'`) is authoritative and the auto-feed must never overwrite it. Feed-set winners use `winnerSource = 'FEED'`.
- **Penalty safety:** knockout games can be decided on penalties (equal regulation score), so the ESPN mapper takes the winner from the per-competitor `winner` boolean, not a score comparison.
- Out of scope (Plan 5): viewing OTHER users' brackets + the themed bracket-tree UI. This plan's leaderboard shows names + totals only (never another user's picks).

---

### Task 1: Schema — `Match.winnerSource` + `PoolConfig`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: a new optional `winnerSource String?` column on `Match` (values used by the app: `'ADMIN'` | `'FEED'`; `null` when undecided), and a singleton `PoolConfig { id @id @default("default"), potCents Int @default(0), updatedAt }`.

- [ ] **Step 1: Add `winnerSource` to the `Match` model**

In `prisma/schema.prisma`, add one line to the existing `Match` model, right after the `actualWinner` field:

```prisma
  winnerSource String?       // "ADMIN" | "FEED"; null when undecided
```

- [ ] **Step 2: Append the `PoolConfig` model**

Append after the `Bracket` model (do not alter anything existing):

```prisma
model PoolConfig {
  id        String   @id @default("default")
  potCents  Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 3: Validate, generate, typecheck**

Run: `npx prisma validate`
Expected: "valid".
Run: `npx prisma generate`
Expected: "Generated Prisma Client". (Dummy `DATABASE_URL` only if it insists; do NOT `db push`.)
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Match.winnerSource and PoolConfig"
```

---

### Task 2: Scoring engine — TDD

**Files:**
- Create: `src/lib/scoring.ts`
- Create: `src/lib/scoring.test.ts`

**Interfaces:**
- Consumes: `TOTAL_SLOTS`, `roundForSlot`, `ROUND_POINTS` from `@/lib/bracket-structure`; `Picks` from `@/lib/bracket-picks`.
- Produces from `@/lib/scoring`:
  - `type OfficialWinners = Record<number, string | null>` — slot → winning team code (or null/undecided).
  - `scoreBracket(picks: Picks, winners: OfficialWinners): number` — sum of `ROUND_POINTS[round]` over slots where the user's pick equals the (non-null) official winner.

- [ ] **Step 1: Write the failing test**

`src/lib/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scoreBracket, type OfficialWinners } from './scoring';
import type { Picks } from './bracket-picks';

describe('scoreBracket', () => {
  it('is 0 for an empty bracket', () => {
    expect(scoreBracket({}, {})).toBe(0);
  });
  it('awards 1 point for a correct R32 pick', () => {
    const picks: Picks = { 1: 'ARG' };
    const winners: OfficialWinners = { 1: 'ARG' };
    expect(scoreBracket(picks, winners)).toBe(1);
  });
  it('awards 16 points for a correct Final pick', () => {
    expect(scoreBracket({ 31: 'ARG' }, { 31: 'ARG' })).toBe(16);
  });
  it('awards nothing for a wrong pick', () => {
    expect(scoreBracket({ 1: 'BRA' }, { 1: 'ARG' })).toBe(0);
  });
  it('awards nothing when the result is undecided', () => {
    expect(scoreBracket({ 1: 'ARG' }, { 1: null })).toBe(0);
    expect(scoreBracket({ 1: 'ARG' }, {})).toBe(0);
  });
  it('sums round-weighted points across rounds', () => {
    // a correct R32 (1), a correct R16 (2), and a correct QF (4) = 7
    const picks: Picks = { 1: 'ARG', 17: 'ARG', 25: 'ARG' };
    const winners: OfficialWinners = { 1: 'ARG', 17: 'ARG', 25: 'ARG' };
    expect(scoreBracket(picks, winners)).toBe(7);
  });
  it('totals 80 for a perfect bracket', () => {
    const picks: Picks = {};
    const winners: OfficialWinners = {};
    for (let s = 1; s <= 31; s++) { picks[s] = 'X'; winners[s] = 'X'; }
    expect(scoreBracket(picks, winners)).toBe(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/scoring.ts`:
```ts
import { TOTAL_SLOTS, roundForSlot, ROUND_POINTS } from '@/lib/bracket-structure';
import type { Picks } from '@/lib/bracket-picks';

export type OfficialWinners = Record<number, string | null>;

/** Round-weighted score: sum of ROUND_POINTS over slots the user got right. */
export function scoreBracket(picks: Picks, winners: OfficialWinners): number {
  let total = 0;
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const winner = winners[slot];
    if (winner && picks[slot] === winner) {
      total += ROUND_POINTS[roundForSlot(slot)];
    }
  }
  return total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat: add round-weighted scoring"
```

---

### Task 3: Leaderboard ranking + pot split — TDD

**Files:**
- Create: `src/lib/leaderboard-rank.ts`
- Create: `src/lib/leaderboard-rank.test.ts`

**Interfaces:**
- Produces from `@/lib/leaderboard-rank`:
  - `type ScoreEntry = { key: string; name: string; total: number }`
  - `type RankedEntry = ScoreEntry & { rank: number }`
  - `rankEntries(entries: ScoreEntry[]): RankedEntry[]` — sorted by total desc then name asc; ties share a rank (1,1,3,…).
  - `potSplit(ranked: RankedEntry[], potCents: number): { winners: RankedEntry[]; shareCents: number }` — `winners` are the rank-1 entries; `shareCents = floor(potCents / winners.length)` (0 when there are no entries).

- [ ] **Step 1: Write the failing test**

`src/lib/leaderboard-rank.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { rankEntries, potSplit, type ScoreEntry } from './leaderboard-rank';

describe('rankEntries', () => {
  it('orders by total descending', () => {
    const r = rankEntries([
      { key: 'a', name: 'Ann', total: 5 },
      { key: 'b', name: 'Bob', total: 9 },
    ]);
    expect(r.map((e) => e.key)).toEqual(['b', 'a']);
    expect(r.map((e) => e.rank)).toEqual([1, 2]);
  });
  it('shares ranks on ties and skips accordingly (1,1,3)', () => {
    const r = rankEntries([
      { key: 'a', name: 'Ann', total: 9 },
      { key: 'b', name: 'Bob', total: 9 },
      { key: 'c', name: 'Cy', total: 4 },
    ]);
    expect(r.map((e) => e.rank)).toEqual([1, 1, 3]);
  });
  it('breaks display order by name when totals tie', () => {
    const r = rankEntries([
      { key: 'z', name: 'Zoe', total: 7 },
      { key: 'a', name: 'Al', total: 7 },
    ]);
    expect(r.map((e) => e.name)).toEqual(['Al', 'Zoe']);
    expect(r.map((e) => e.rank)).toEqual([1, 1]);
  });
  it('handles an empty list', () => {
    expect(rankEntries([])).toEqual([]);
  });
});

describe('potSplit', () => {
  const entries: ScoreEntry[] = [
    { key: 'a', name: 'Ann', total: 9 },
    { key: 'b', name: 'Bob', total: 9 },
    { key: 'c', name: 'Cy', total: 4 },
  ];
  it('splits the pot among rank-1 winners', () => {
    const { winners, shareCents } = potSplit(rankEntries(entries), 10000);
    expect(winners.map((w) => w.key).sort()).toEqual(['a', 'b']);
    expect(shareCents).toBe(5000);
  });
  it('floors uneven splits', () => {
    const { shareCents } = potSplit(rankEntries(entries), 10001);
    expect(shareCents).toBe(5000);
  });
  it('returns 0 share for no entries', () => {
    expect(potSplit([], 10000)).toEqual({ winners: [], shareCents: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/leaderboard-rank.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/leaderboard-rank.ts`:
```ts
export type ScoreEntry = { key: string; name: string; total: number };
export type RankedEntry = ScoreEntry & { rank: number };

/** Sort by total desc, then name asc for stable display; ties share a rank (1,1,3,…). */
export function rankEntries(entries: ScoreEntry[]): RankedEntry[] {
  const sorted = [...entries].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
  let lastTotal: number | null = null;
  let lastRank = 0;
  return sorted.map((e, i) => {
    if (e.total !== lastTotal) {
      lastRank = i + 1;
      lastTotal = e.total;
    }
    return { ...e, rank: lastRank };
  });
}

export function potSplit(
  ranked: RankedEntry[],
  potCents: number,
): { winners: RankedEntry[]; shareCents: number } {
  const winners = ranked.filter((e) => e.rank === 1);
  const shareCents = winners.length > 0 ? Math.floor(potCents / winners.length) : 0;
  return { winners, shareCents };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/leaderboard-rank.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard-rank.ts src/lib/leaderboard-rank.test.ts
git commit -m "feat: add leaderboard ranking and pot split"
```

---

### Task 4: Team name → code resolver — TDD

**Files:**
- Create: `src/lib/team-resolve.ts`
- Create: `src/lib/team-resolve.test.ts`

**Interfaces:**
- Consumes: `TEAMS` from `@/lib/teams`.
- Produces from `@/lib/team-resolve`:
  - `normalizeTeam(raw: string): string` — accent/punctuation-stripped, lowercased, de-duped words (ported from wc26).
  - `resolveCode(name: string): string | null` — maps a feed display name (or a code) to a FIFA code via `TEAMS` names plus a small alias map for common feed spellings; `null` if unresolved.

- [ ] **Step 1: Write the failing test**

`src/lib/team-resolve.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeTeam, resolveCode } from './team-resolve';

describe('normalizeTeam', () => {
  it('lowercases and strips accents/punctuation', () => {
    expect(normalizeTeam('Curaçao')).toBe('curacao');
    expect(normalizeTeam("Côte d'Ivoire")).toBe('cote divoire');
  });
  it('dedupes repeated words', () => {
    expect(normalizeTeam('USA USA')).toBe('usa');
  });
});

describe('resolveCode', () => {
  it('resolves an exact team name', () => {
    expect(resolveCode('Argentina')).toBe('ARG');
  });
  it('is case- and accent-insensitive', () => {
    expect(resolveCode('argentina')).toBe('ARG');
    expect(resolveCode('Curaçao')).toBe('CUW');
  });
  it('passes a known code through', () => {
    expect(resolveCode('ARG')).toBe('ARG');
  });
  it('resolves a common feed alias', () => {
    expect(resolveCode('South Korea')).toBe('KOR');
  });
  it('returns null for an unknown name', () => {
    expect(resolveCode('Atlantis')).toBeNull();
    expect(resolveCode('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/team-resolve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/team-resolve.ts`:
```ts
import { TEAMS } from '@/lib/teams';

/** Lowercase, strip accents/punctuation, collapse + dedupe words. */
export function normalizeTeam(raw: string): string {
  const noAccent = (raw ?? '').normalize('NFKD').replace(/\p{Diacritic}/gu, '');
  const cleaned = noAccent
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean);
  return Array.from(new Set(words)).join(' ');
}

// Common feed (ESPN/TheSportsDB) spellings that differ from our TEAMS names.
const ALIASES: Record<string, string> = {
  'south korea': 'KOR',
  'korea republic': 'KOR',
  'republic of korea': 'KOR',
  'united states': 'USA',
  'cote divoire': 'CIV',
  'ivory coast': 'CIV',
  'dr congo': 'COD',
  'congo dr': 'COD',
  'czech republic': 'CZE',
  'ir iran': 'IRN',
  'cabo verde': 'CPV',
};

const CODE_BY_NORM = new Map<string, string>();
for (const t of TEAMS) {
  CODE_BY_NORM.set(normalizeTeam(t.name), t.code);
  CODE_BY_NORM.set(normalizeTeam(t.code), t.code);
}
for (const [name, code] of Object.entries(ALIASES)) {
  CODE_BY_NORM.set(normalizeTeam(name), code);
}

export function resolveCode(name: string): string | null {
  if (!name || !name.trim()) return null;
  return CODE_BY_NORM.get(normalizeTeam(name)) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/team-resolve.test.ts`
Expected: PASS (all passed). (If `resolveCode('South Korea')` fails, the `TEAMS` entry for KOR already normalizes to a different name — the alias map still maps `south korea` → `KOR`, so the test holds regardless of the stored name.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/team-resolve.ts src/lib/team-resolve.test.ts
git commit -m "feat: add team name-to-code resolver"
```

---

### Task 5: Official-winners mutation (set/clear + cascade) — TDD

**Files:**
- Create: `src/lib/official-winners.ts`
- Create: `src/lib/official-winners.test.ts`

**Interfaces:**
- Consumes: `TOTAL_SLOTS` from `@/lib/bracket-structure`; `contestantsForSlot`, `OfficialR32` from `@/lib/bracket-picks`; `OfficialWinners` from `@/lib/scoring`.
- Produces from `@/lib/official-winners`:
  - `reconcileWinners(officialR32: OfficialR32, winners: OfficialWinners): OfficialWinners` — returns a NEW map with any later-round winner cleared if it is no longer one of that slot's current contestants (one forward sweep over slots 17..31).
  - `applyWinner(officialR32: OfficialR32, winners: OfficialWinners, slot: number, winner: string | null): OfficialWinners` — sets (or, when `winner` is null, clears) the slot, then reconciles downstream. Does not mutate the input.

- [ ] **Step 1: Write the failing test**

`src/lib/official-winners.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { applyWinner, reconcileWinners } from './official-winners';
import type { OfficialR32 } from './bracket-picks';
import type { OfficialWinners } from './scoring';

const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
};

describe('applyWinner', () => {
  it('sets a winner without mutating the input', () => {
    const before: OfficialWinners = {};
    const after = applyWinner(OFFICIAL, before, 1, 'ARG');
    expect(after[1]).toBe('ARG');
    expect(before).toEqual({});
  });
  it('clears downstream winners when an upstream winner changes', () => {
    let w: OfficialWinners = {};
    w = applyWinner(OFFICIAL, w, 1, 'ARG');
    w = applyWinner(OFFICIAL, w, 2, 'FRA');
    w = applyWinner(OFFICIAL, w, 17, 'ARG'); // slot 17 feeds from 1 & 2
    expect(w[17]).toBe('ARG');
    w = applyWinner(OFFICIAL, w, 1, 'BRA'); // ARG no longer advances
    expect(w[1]).toBe('BRA');
    expect(w[17]).toBeUndefined();
  });
  it('clears a slot (and its dependents) when winner is null', () => {
    let w: OfficialWinners = {};
    w = applyWinner(OFFICIAL, w, 1, 'ARG');
    w = applyWinner(OFFICIAL, w, 2, 'FRA');
    w = applyWinner(OFFICIAL, w, 17, 'FRA');
    w = applyWinner(OFFICIAL, w, 2, null); // clear slot 2; FRA no longer in slot 17
    expect(w[2]).toBeUndefined();
    expect(w[17]).toBeUndefined();
  });
});

describe('reconcileWinners', () => {
  it('drops a later winner not among its contestants', () => {
    const w: OfficialWinners = { 1: 'ARG', 2: 'FRA', 17: 'ZZZ' };
    expect(reconcileWinners(OFFICIAL, w)[17]).toBeUndefined();
  });
  it('keeps a valid later winner', () => {
    const w: OfficialWinners = { 1: 'ARG', 2: 'FRA', 17: 'FRA' };
    expect(reconcileWinners(OFFICIAL, w)[17]).toBe('FRA');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/official-winners.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/official-winners.ts`:
```ts
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32 } from '@/lib/bracket-picks';
import type { OfficialWinners } from '@/lib/scoring';

/**
 * Clear any later-round winner that is no longer one of its slot's current
 * contestants. One forward sweep suffices: slots are numbered in dependency
 * order, so an upstream clear is visible when we evaluate downstream slots.
 */
export function reconcileWinners(
  officialR32: OfficialR32,
  winners: OfficialWinners,
): OfficialWinners {
  const next: OfficialWinners = { ...winners };
  for (let s = 17; s <= TOTAL_SLOTS; s++) {
    const w = next[s];
    if (!w) continue;
    const { teamA, teamB } = contestantsForSlot(s, officialR32, asPicks(next));
    if (w !== teamA && w !== teamB) delete next[s];
  }
  return next;
}

export function applyWinner(
  officialR32: OfficialR32,
  winners: OfficialWinners,
  slot: number,
  winner: string | null,
): OfficialWinners {
  const next: OfficialWinners = { ...winners };
  if (winner === null) delete next[slot];
  else next[slot] = winner;
  return reconcileWinners(officialR32, next);
}

// contestantsForSlot expects Picks (Record<number,string>); our winners map may
// hold nulls. Strip nulls so the shapes line up.
function asPicks(winners: OfficialWinners): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(winners)) {
    if (typeof v === 'string') out[Number(k)] = v;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/official-winners.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/official-winners.ts src/lib/official-winners.test.ts
git commit -m "feat: add official-winners set/clear with cascade"
```

---

### Task 6: ESPN knockout feed mapper + resolver — TDD

**Files:**
- Create: `src/lib/results-feed.ts`
- Create: `src/lib/results-feed.test.ts`

**Interfaces:**
- Consumes: `resolveCode` from `@/lib/team-resolve`; `applyWinner` from `@/lib/official-winners`; `slotsForRound` from `@/lib/bracket-structure`; `contestantsForSlot`, `OfficialR32` from `@/lib/bracket-picks`; `OfficialWinners` from `@/lib/scoring`.
- Produces from `@/lib/results-feed`:
  - `type FeedResult = { teamA: string; teamB: string; winner: string | null }` — resolved FIFA codes for a finished feed match (winner from the ESPN `winner` boolean, null if undetermined).
  - `mapEspnKnockout(json: unknown): FeedResult[]` — finished events only, both team codes resolvable.
  - `resolveOfficialWinners(officialR32: OfficialR32, feed: FeedResult[]): OfficialWinners` — walks rounds R32→FINAL, matches each slot's current contestant pair to a feed result, and records the feed winner.

- [ ] **Step 1: Write the failing test**

`src/lib/results-feed.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mapEspnKnockout, resolveOfficialWinners, type FeedResult } from './results-feed';
import type { OfficialR32 } from './bracket-picks';

// Minimal ESPN scoreboard shape: one finished (ARG beat BRA on the winner flag,
// even though scores are equal — penalties), one not-yet-played.
const ESPN = {
  events: [
    {
      competitions: [
        {
          status: { type: { completed: true, state: 'post' } },
          competitors: [
            { homeAway: 'home', team: { displayName: 'Argentina' }, score: '1', winner: true },
            { homeAway: 'away', team: { displayName: 'Brazil' }, score: '1', winner: false },
          ],
        },
      ],
    },
    {
      competitions: [
        {
          status: { type: { completed: false, state: 'pre' } },
          competitors: [
            { homeAway: 'home', team: { displayName: 'Spain' }, score: null, winner: false },
            { homeAway: 'away', team: { displayName: 'France' }, score: null, winner: false },
          ],
        },
      ],
    },
  ],
};

describe('mapEspnKnockout', () => {
  it('keeps only finished events and resolves codes + winner', () => {
    const out = mapEspnKnockout(ESPN);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ teamA: 'ARG', teamB: 'BRA', winner: 'ARG' });
  });
  it('returns [] for junk input', () => {
    expect(mapEspnKnockout(null)).toEqual([]);
    expect(mapEspnKnockout({})).toEqual([]);
  });
});

describe('resolveOfficialWinners', () => {
  const OFFICIAL: OfficialR32 = {
    1: { teamA: 'ARG', teamB: 'BRA' },
    2: { teamA: 'ESP', teamB: 'FRA' },
  };
  it('records winners for matched R32 slots', () => {
    const feed: FeedResult[] = [{ teamA: 'ARG', teamB: 'BRA', winner: 'ARG' }];
    const w = resolveOfficialWinners(OFFICIAL, feed);
    expect(w[1]).toBe('ARG');
    expect(w[2]).toBeUndefined();
  });
  it('matches regardless of pair order', () => {
    const feed: FeedResult[] = [{ teamA: 'BRA', teamB: 'ARG', winner: 'BRA' }];
    expect(resolveOfficialWinners(OFFICIAL, feed)[1]).toBe('BRA');
  });
  it('fills a later round once its feeders are decided', () => {
    const feed: FeedResult[] = [
      { teamA: 'ARG', teamB: 'BRA', winner: 'ARG' },
      { teamA: 'ESP', teamB: 'FRA', winner: 'FRA' },
      { teamA: 'ARG', teamB: 'FRA', winner: 'ARG' }, // the R16 slot-17 game
    ];
    const w = resolveOfficialWinners(OFFICIAL, feed);
    expect(w[1]).toBe('ARG');
    expect(w[2]).toBe('FRA');
    expect(w[17]).toBe('ARG');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/results-feed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/results-feed.ts`:
```ts
import { resolveCode } from '@/lib/team-resolve';
import { applyWinner } from '@/lib/official-winners';
import { slotsForRound } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32 } from '@/lib/bracket-picks';
import type { OfficialWinners } from '@/lib/scoring';

export type FeedResult = { teamA: string; teamB: string; winner: string | null };

interface EspnCompetitor {
  homeAway?: string;
  team?: { displayName?: string };
  score?: string | number | null;
  winner?: boolean;
}

/** Map a raw ESPN scoreboard payload to resolved, finished knockout results. */
export function mapEspnKnockout(json: unknown): FeedResult[] {
  const root = json as { events?: unknown[] } | null;
  const events = Array.isArray(root?.events) ? root!.events : [];
  const out: FeedResult[] = [];
  for (const ev of events as Array<{ competitions?: unknown[] }>) {
    const comp = Array.isArray(ev?.competitions) ? (ev.competitions[0] as {
      status?: { type?: { completed?: boolean } };
      competitors?: EspnCompetitor[];
    }) : undefined;
    if (!comp?.status?.type?.completed) continue;
    const comps = comp.competitors ?? [];
    const home = comps.find((c) => c.homeAway === 'home');
    const away = comps.find((c) => c.homeAway === 'away');
    const a = resolveCode(home?.team?.displayName ?? '');
    const b = resolveCode(away?.team?.displayName ?? '');
    if (!a || !b) continue;
    const winnerComp = comps.find((c) => c.winner === true);
    const winner = winnerComp ? resolveCode(winnerComp.team?.displayName ?? '') : null;
    out.push({ teamA: a, teamB: b, winner });
  }
  return out;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/**
 * Build the official winners map from feed results by walking the bracket in
 * round order: each slot's current contestants (from already-decided feeders)
 * are matched to a feed result by unordered team pair.
 */
export function resolveOfficialWinners(officialR32: OfficialR32, feed: FeedResult[]): OfficialWinners {
  const byPair = new Map<string, FeedResult>();
  for (const f of feed) byPair.set(pairKey(f.teamA, f.teamB), f);

  let winners: OfficialWinners = {};
  const rounds = ['R32', 'R16', 'QF', 'SF', 'FINAL'] as const;
  for (const round of rounds) {
    for (const slot of slotsForRound(round)) {
      const { teamA, teamB } = contestantsForSlot(slot, officialR32, asPicks(winners));
      if (!teamA || !teamB) continue;
      const match = byPair.get(pairKey(teamA, teamB));
      if (match && match.winner && (match.winner === teamA || match.winner === teamB)) {
        winners = applyWinner(officialR32, winners, slot, match.winner);
      }
    }
  }
  return winners;
}

function asPicks(winners: OfficialWinners): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(winners)) {
    if (typeof v === 'string') out[Number(k)] = v;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/results-feed.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/results-feed.ts src/lib/results-feed.test.ts
git commit -m "feat: add ESPN knockout feed mapper and resolver"
```

---

### Task 7: Results + pot server actions

**Files:**
- Create: `src/app/actions/results.ts`

**Interfaces:**
- Consumes: `db`; `requireAdmin`; `getOfficialBracket`; `officialR32FromSlots`; `contestantsForSlot`; `applyWinner`; `mapEspnKnockout`/`resolveOfficialWinners`; `OfficialWinners`.
- Produces from `@/app/actions/results`:
  - `currentWinners(): Promise<OfficialWinners>` — reads `Match.actualWinner` into a slot→code map (helper; exported for the leaderboard).
  - `setMatchWinner(slot: number, winner: string | null): Promise<{ error?: string }>` — admin-only; validates `winner` is one of the slot's current contestants (or null); applies the cascade and persists every changed slot, marking the target `winnerSource = 'ADMIN'`.
  - `refreshResults(): Promise<{ error?: string; updated?: number }>` — admin-only; fetches the ESPN knockout scoreboard, resolves winners, and writes them to slots whose `winnerSource` is not `'ADMIN'` (marking them `'FEED'`).
  - `setPot(dollars: number): Promise<{ error?: string }>` — admin-only; upserts `PoolConfig.potCents`.

- [ ] **Step 1: Create `src/app/actions/results.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/app/actions/admin';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import { contestantsForSlot } from '@/lib/bracket-picks';
import { applyWinner } from '@/lib/official-winners';
import { mapEspnKnockout, resolveOfficialWinners } from '@/lib/results-feed';
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import type { OfficialWinners } from '@/lib/scoring';

const ESPN_KO_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260628-20260720';

function asPicks(winners: OfficialWinners): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(winners)) if (typeof v === 'string') out[Number(k)] = v;
  return out;
}

/** Read Match.actualWinner rows into a slot -> code map. */
export async function currentWinners(): Promise<OfficialWinners> {
  const rows = await db.match.findMany({ select: { slot: true, actualWinner: true } });
  const w: OfficialWinners = {};
  for (const r of rows) w[r.slot] = r.actualWinner;
  return w;
}

export async function setMatchWinner(slot: number, winner: string | null): Promise<{ error?: string }> {
  await requireAdmin();
  if (!Number.isInteger(slot) || slot < 1 || slot > TOTAL_SLOTS) {
    return { error: 'Invalid slot.' };
  }

  const official = await getOfficialBracket();
  const officialR32 = officialR32FromSlots(official.slots);
  const before = await currentWinners();

  if (winner !== null) {
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, asPicks(before));
    if (winner !== teamA && winner !== teamB) {
      return { error: 'That team is not in this game yet.' };
    }
  }

  const after = applyWinner(officialR32, before, slot, winner);

  // Persist every slot whose winner changed.
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    const wb = before[s] ?? null;
    const wa = after[s] ?? null;
    if (wb === wa) continue;
    if (s === slot) {
      await db.match.update({
        where: { slot: s },
        data: { actualWinner: winner, winnerSource: winner === null ? null : 'ADMIN' },
      });
    } else {
      // downstream slot got cleared by the cascade
      await db.match.update({
        where: { slot: s },
        data: { actualWinner: null, winnerSource: null },
      });
    }
  }

  revalidatePath('/admin/bracket');
  revalidatePath('/');
  return {};
}

export async function refreshResults(): Promise<{ error?: string; updated?: number }> {
  await requireAdmin();

  let json: unknown;
  try {
    const res = await fetch(ESPN_KO_URL, { cache: 'no-store' });
    if (!res.ok) return { error: `Feed returned ${res.status}.` };
    json = await res.json();
  } catch {
    return { error: 'Could not reach the results feed.' };
  }

  const official = await getOfficialBracket();
  const officialR32 = officialR32FromSlots(official.slots);
  const feed = mapEspnKnockout(json);
  const resolved = resolveOfficialWinners(officialR32, feed);

  // Which slots are admin-locked? Those keep their winner.
  const rows = await db.match.findMany({ select: { slot: true, winnerSource: true, actualWinner: true } });
  const adminSlot = new Set(rows.filter((r) => r.winnerSource === 'ADMIN').map((r) => r.slot));
  const existing: OfficialWinners = {};
  for (const r of rows) existing[r.slot] = r.actualWinner;

  let updated = 0;
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    if (adminSlot.has(s)) continue;
    const next = resolved[s] ?? null;
    if ((existing[s] ?? null) === next) continue;
    await db.match.update({
      where: { slot: s },
      data: { actualWinner: next, winnerSource: next === null ? null : 'FEED' },
    });
    updated++;
  }

  revalidatePath('/admin/bracket');
  revalidatePath('/');
  return { updated };
}

export async function setPot(dollars: number): Promise<{ error?: string }> {
  await requireAdmin();
  if (!Number.isFinite(dollars) || dollars < 0) return { error: 'Enter a valid amount.' };
  const potCents = Math.round(dollars * 100);
  await db.poolConfig.upsert({
    where: { id: 'default' },
    update: { potCents },
    create: { id: 'default', potCents },
  });
  revalidatePath('/');
  revalidatePath('/admin/bracket');
  return {};
}
```

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/results.ts
git commit -m "feat: add results and pot admin actions"
```

---

### Task 8: Leaderboard assembly + home leaderboard

**Files:**
- Create: `src/app/actions/leaderboard.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `db`; `currentWinners` (Task 7); `scoreBracket` (Task 2); `rankEntries`/`potSplit`/`RankedEntry` (Task 3); the existing home-page pieces (`getOfficialBracket`, `formatLockTimePT`, `Countdown`).
- Produces from `@/app/actions/leaderboard`:
  - `type LeaderboardData = { entries: RankedEntry[]; potCents: number; winnerKeys: string[]; shareCents: number }`
  - `getLeaderboard(): Promise<LeaderboardData>` — loads all brackets + their users' display names, scores each against `currentWinners()`, ranks them, and computes the pot split from `PoolConfig`.
- Produces: the home page now renders the leaderboard table below the countdown.

- [ ] **Step 1: Create `src/app/actions/leaderboard.ts`**

```ts
'use server';

import { db } from '@/lib/db';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { rankEntries, potSplit, type RankedEntry } from '@/lib/leaderboard-rank';
import type { Picks } from '@/lib/bracket-picks';

export type LeaderboardData = {
  entries: RankedEntry[];
  potCents: number;
  winnerKeys: string[];
  shareCents: number;
};

function coercePicks(raw: unknown): Picks {
  const out: Picks = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const slot = Number(k);
      if (Number.isInteger(slot) && typeof v === 'string') out[slot] = v;
    }
  }
  return out;
}

export async function getLeaderboard(): Promise<LeaderboardData> {
  const [brackets, winners, config] = await Promise.all([
    db.bracket.findMany({ select: { userId: true, picks: true } }),
    currentWinners(),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);

  const userIds = brackets.map((b) => b.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, username: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.username ?? u.name]));

  const scored = brackets.map((b) => ({
    key: b.userId,
    name: nameById.get(b.userId) ?? 'Unknown',
    total: scoreBracket(coercePicks(b.picks), winners),
  }));

  const entries = rankEntries(scored);
  const potCents = config?.potCents ?? 0;
  const { winners: winEntries, shareCents } = potSplit(entries, potCents);

  return { entries, potCents, winnerKeys: winEntries.map((w) => w.key), shareCents };
}
```

- [ ] **Step 2: Update `src/app/page.tsx` to render the leaderboard**

```tsx
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { formatLockTimePT } from '@/lib/lock';
import Countdown from '@/app/_components/Countdown';

export const dynamic = 'force-dynamic';

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  const [{ lockTimeIso }, board] = await Promise.all([getOfficialBracket(), getLeaderboard()]);
  const lockLabel = lockTimeIso ? formatLockTimePT(new Date(lockTimeIso)) : null;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>WC26 Knockout Bracket</h1>
      {session?.user ? (
        <p>Welcome, {session.user.name}.</p>
      ) : (
        <p>Request an account to join the pool.</p>
      )}
      <Countdown lockTimeIso={lockTimeIso} lockLabel={lockLabel} />

      <section style={{ marginTop: 24 }}>
        <h2>Leaderboard</h2>
        <p style={{ opacity: 0.7 }}>
          Pot: {dollars(board.potCents)}
          {board.winnerKeys.length > 0 && board.shareCents > 0 && (
            <> — {board.winnerKeys.length === 1 ? 'leader takes' : `${board.winnerKeys.length} leaders split`} {dollars(board.shareCents)} each</>
          )}
        </p>
        {board.entries.length === 0 ? (
          <p>No brackets submitted yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>#</th><th style={{ textAlign: 'left' }}>Player</th><th style={{ textAlign: 'right' }}>Points</th></tr>
            </thead>
            <tbody>
              {board.entries.map((e) => (
                <tr key={e.key} style={{ borderTop: '1px solid #ffffff22' }}>
                  <td>{e.rank}</td>
                  <td>{e.name}{board.winnerKeys.includes(e.key) ? ' 🏆' : ''}</td>
                  <td style={{ textAlign: 'right' }}>{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck, full suite, build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.
Run: `npx next build`
Expected: compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/leaderboard.ts src/app/page.tsx
git commit -m "feat: add leaderboard assembly and home standings"
```

---

### Task 9: Admin results UI (set winners, refresh feed, set pot)

**Files:**
- Create: `src/app/admin/bracket/ResultsPanel.tsx`
- Modify: `src/app/admin/bracket/page.tsx`

**Interfaces:**
- Consumes: `setMatchWinner`, `refreshResults`, `setPot` (Task 7); `getOfficialBracket`/`OfficialSlot`; `db` (to read the current pot); `currentWinners`.
- Produces: a client `ResultsPanel` that, per official slot with two known contestants, offers two winner buttons (highlight the current winner) calling `setMatchWinner`; a "Refresh from feed" button calling `refreshResults`; and a pot input calling `setPot`. Rendered on `/admin/bracket` below the existing sections.

- [ ] **Step 1: Create `src/app/admin/bracket/ResultsPanel.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { setMatchWinner, refreshResults, setPot } from '@/app/actions/results';

type SlotRow = { slot: number; round: string; teamA: string | null; teamB: string | null; winner: string | null };

export default function ResultsPanel({
  slots,
  potDollars,
}: {
  slots: SlotRow[];
  potDollars: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [pot, setPotValue] = useState<string>(String(potDollars));

  function run(action: () => Promise<{ error?: string; updated?: number }>) {
    setMsg(null);
    start(async () => {
      const res = await action();
      if (res?.error) setMsg(res.error);
      else if (typeof res?.updated === 'number') setMsg(`Updated ${res.updated} game(s) from feed.`);
      else setMsg('Saved.');
    });
  }

  function winnerButton(slot: number, team: string | null, current: string | null) {
    const selected = team !== null && current === team;
    return (
      <button
        type="button"
        disabled={pending || !team}
        onClick={() => run(() => setMatchWinner(slot, team))}
        style={{
          minWidth: 80,
          fontWeight: selected ? 700 : 400,
          background: selected ? 'var(--accent)' : 'transparent',
          color: selected ? '#06210f' : 'var(--line)',
          border: '1px solid #ffffff33',
          borderRadius: 6,
          padding: '4px 8px',
        }}
      >
        {team ?? '—'}
      </button>
    );
  }

  return (
    <section>
      <h2>Results</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button type="button" disabled={pending} onClick={() => run(refreshResults)}>
          {pending ? 'Working…' : 'Refresh from feed'}
        </button>
        <input
          type="number"
          step="0.01"
          min="0"
          value={pot}
          onChange={(e) => setPotValue(e.target.value)}
          style={{ width: 120 }}
        />
        <button type="button" disabled={pending} onClick={() => run(() => setPot(Number(pot)))}>
          Set pot ($)
        </button>
      </div>
      {msg && <p style={{ color: 'var(--accent)' }}>{msg}</p>}
      <div style={{ display: 'grid', gap: 6 }}>
        {slots.map((s) => (
          <div key={s.slot} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ opacity: 0.6, width: 70 }}>{s.round} #{s.slot}</span>
            {winnerButton(s.slot, s.teamA, s.winner)}
            <span style={{ opacity: 0.5 }}>vs</span>
            {winnerButton(s.slot, s.teamB, s.winner)}
            <button
              type="button"
              disabled={pending || !s.winner}
              onClick={() => run(() => setMatchWinner(s.slot, null))}
              style={{ marginLeft: 8, opacity: 0.7 }}
            >
              clear
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render `ResultsPanel` on `src/app/admin/bracket/page.tsx`**

Add the import at the top of `src/app/admin/bracket/page.tsx`:

```tsx
import { db } from '@/lib/db';
import ResultsPanel from './ResultsPanel';
```

(`getOfficialBracket` is already imported.) Then, immediately before the final closing `</main>` in the returned JSX, add:

```tsx
      <ResultsPanel
        slots={slots.map((s) => ({
          slot: s.slot,
          round: s.round,
          teamA: s.teamA,
          teamB: s.teamB,
          winner: s.winner,
        }))}
        potDollars={((await db.poolConfig.findUnique({ where: { id: 'default' } }))?.potCents ?? 0) / 100}
      />
```

(`slots` is the array already returned by `getOfficialBracket()` and used by the "Derived bracket" section; each element has `slot`, `round`, `teamA`, `teamB`, `winner`.)

- [ ] **Step 3: Typecheck, full suite, build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.
Run: `npx next build`
Expected: compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/bracket/ResultsPanel.tsx src/app/admin/bracket/page.tsx
git commit -m "feat: add admin results panel (winners, feed refresh, pot)"
```

---

## Self-Review

**Spec coverage (Plan 4 scope):**
- Results feed → `Match.actualWinner`, self-healing/penalty-safe via ESPN winner boolean → Task 6 (`mapEspnKnockout`/`resolveOfficialWinners`) + Task 7 (`refreshResults`). ✓
- Admin override that always wins → `winnerSource` (Task 1), `setMatchWinner` writes `'ADMIN'` (Task 7), `refreshResults` skips `'ADMIN'` slots (Task 7), admin UI (Task 9). ✓
- Round-weighted scoring (perfect = 80) → Task 2. ✓
- Leaderboard with shared ranks → Task 3 (`rankEntries`) + Task 8 assembly + home table. ✓
- Pot, admin-configurable, winners split → `PoolConfig` (Task 1), `setPot` (Task 7), `potSplit` (Task 3), shown on home (Task 8) and set in admin UI (Task 9). ✓
- Cascade integrity when a winner changes/clears → Task 5 (`applyWinner`/`reconcileWinners`, reusing `contestantsForSlot`). ✓
- Never expose other users' picks → leaderboard shows names + totals only (Task 8). ✓

**Intentionally deferred (Plan 5):** viewing other users' brackets (`/brackets`, `/brackets/[user]`), the themed bracket-tree UI. The leaderboard here is functional/unstyled.

**Placeholder scan:** No TBD/TODO; every code step is complete and transcribable as-is.

**Type consistency:** `OfficialWinners` (`Record<number, string|null>`) defined in `scoring.ts` (Task 2) and reused by `official-winners.ts` (Task 5), `results-feed.ts` (Task 6), `results.ts` (Task 7), `leaderboard.ts` (Task 8). `Picks`/`OfficialR32` come from Plan 3. `RankedEntry`/`ScoreEntry` defined in Task 3 and used in Task 8. `FeedResult` defined in Task 6 and used in its own resolver. `currentWinners`/`scoreBracket`/`rankEntries`/`potSplit`/`applyWinner`/`mapEspnKnockout`/`resolveOfficialWinners` signatures match their callers. The `asPicks` null-stripping helper is intentionally duplicated in `official-winners.ts`, `results-feed.ts`, and `results.ts` (tiny, module-local) rather than shared — acceptable given its size; a reviewer may flag it.

---

## Subsequent Plan (roadmap)

- **Plan 5 — Post-lock visibility, browse others & themed UI:** gate other users' brackets behind the lock; `/brackets` + `/brackets/[user]`; `frontend-design`-driven WC26 football theme with a real connected bracket-tree layout replacing the functional list/table UIs from Plans 2–4.
