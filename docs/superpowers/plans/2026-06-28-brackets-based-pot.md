# Brackets-Based Pot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Size the pot by official brackets entered (`$50 × brackets in`) instead of credits, and remove the confusing "players" count from the header pill.

**Architecture:** Rework the pure `computePoolStats` to be brackets-based; `getPoolStats` (header pill) and `getLeaderboard` (home pot) size the pot from the count of official brackets they already fetch; `PoolPill` + i18n drop the players line and relabel to "brackets in".

**Tech Stack:** Next.js 15.5 App Router, Prisma 6 + Neon, React 19, Vitest 4. Spec: `docs/superpowers/specs/2026-06-28-brackets-based-pot-design.md`.

## Global Constraints

- **No "players"** anywhere in the pot/pill code after this change.
- **i18n drift-guard:** `src/lib/i18n.ts` types `es` as `Record<StringKey, string>` where `StringKey = keyof typeof en`. Removing a key requires removing it from BOTH `en` and `es` (and from all call sites), or `tsc`/the `i18n.test.ts` parity test fail. Public Spanish is casual Sonoran.
- **`computePoolStats` is pure and unit-tested (TDD);** `pool.ts`/`leaderboard.ts`/`PoolPill.tsx` are glue/UI verified by `tsc`/`lint`/`build`.
- **No schema change, no migration.**
- **Commits:** author `Oswaldo Gonzalez <Oswaldo@calvada.local>`; end every message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (use `git -c user.name=... -c user.email=...`).

---

### Task 1: Brackets-based `computePoolStats`

**Files:**
- Modify: `src/lib/pool-stats.ts`
- Test: `src/lib/pool-stats.test.ts`

**Interfaces:**
- Consumes: `coercePicks` (`@/lib/picks-json`) — unchanged.
- Produces:
  - `type PoolStats = { bracketsIn: number; potCents: number }`
  - `type PoolHeaderStats = PoolStats & { filled: number; entryCents: number }`
  - `computePoolStats(bracketsIn: number, entryCents: number): PoolStats` — `potCents = bracketsIn × entryCents`.
  - `countFilledBrackets(brackets: { picks: unknown }[]): number` — unchanged.

- [ ] **Step 1: Rewrite the test** — replace the `describe('computePoolStats', …)` block in `src/lib/pool-stats.test.ts` (lines 6-27) with the brackets-based version. Leave the `countFilledBrackets` block and the `picks` helper unchanged.

```ts
describe('computePoolStats', () => {
  it('is empty when no brackets are in', () => {
    expect(computePoolStats(0, 5000)).toEqual({ bracketsIn: 0, potCents: 0 });
  });

  it('prices the pot as brackets-in times the entry price', () => {
    expect(computePoolStats(3, 5000)).toEqual({ bracketsIn: 3, potCents: 15000 });
  });

  it('uses the configured entry price', () => {
    expect(computePoolStats(2, 2500)).toEqual({ bracketsIn: 2, potCents: 5000 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/pool-stats.test.ts`
Expected: FAIL — the current `computePoolStats(users, entryCents)` returns `{ players, entries, potCents }`, so the new `computePoolStats(0, 5000)` call / `{ bracketsIn, potCents }` expectations don't match (type/shape mismatch).

- [ ] **Step 3: Rewrite `src/lib/pool-stats.ts`** to the brackets-based version (keep `countFilledBrackets`):

```ts
import { coercePicks } from '@/lib/picks-json';

export type PoolStats = {
  bracketsIn: number; // official brackets entered into the pool
  potCents: number;   // bracketsIn * entryCents
};

/** Header view: the brackets-based pot plus how many are filled and the unit price. */
export type PoolHeaderStats = PoolStats & {
  filled: number;     // official brackets with every game picked
  entryCents: number; // unit price, so the header can show the "in × $50" breakdown
};

const TOTAL_GAMES = 31; // R32 → Final

/** Count official brackets that have all 31 games picked — the "filled" half of filled-vs-in. */
export function countFilledBrackets(brackets: { picks: unknown }[]): number {
  return brackets.reduce((n, b) => {
    const made = Object.values(coercePicks(b.picks)).filter((v) => typeof v === 'string' && v).length;
    return made >= TOTAL_GAMES ? n + 1 : n;
  }, 0);
}

/** Pot from entered brackets: a player is "in" once they enter (mark official) a bracket. */
export function computePoolStats(bracketsIn: number, entryCents: number): PoolStats {
  return { bracketsIn, potCents: bracketsIn * entryCents };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/pool-stats.test.ts`
Expected: PASS (computePoolStats 3 + countFilledBrackets 4 = 7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pool-stats.ts src/lib/pool-stats.test.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(pool): brackets-based computePoolStats (pot = brackets-in x entry)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wire the pot from official brackets

**Files:**
- Modify: `src/app/actions/pool.ts`
- Modify: `src/app/actions/leaderboard.ts`

**Interfaces:**
- Consumes: `computePoolStats`/`countFilledBrackets`/`PoolHeaderStats` (Task 1).
- Produces: `getPoolStats()` returns `{ bracketsIn, filled, potCents, entryCents }`; `LeaderboardData` no longer has `players`; both pots = `officialBrackets.length × entryCents`.

- [ ] **Step 1: Rewrite `src/app/actions/pool.ts`** — drop the credit-users query; size from official brackets:

```ts
'use server';

import { db } from '@/lib/db';
import { computePoolStats, countFilledBrackets, type PoolHeaderStats } from '@/lib/pool-stats';

/** Headline pool numbers (brackets in / filled / pot) for the global header. */
export async function getPoolStats(): Promise<PoolHeaderStats> {
  const [official, config] = await Promise.all([
    db.bracket.findMany({ where: { official: true }, select: { picks: true } }),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);
  const entryCents = config?.entryCents ?? 5000;
  const stats = computePoolStats(official.length, entryCents);
  return { ...stats, filled: countFilledBrackets(official), entryCents };
}
```

- [ ] **Step 2: Update `src/app/actions/leaderboard.ts`** — three edits.

(a) Remove `players` from the `LeaderboardData` type (delete line `  players: number;`):
```ts
export type LeaderboardData = {
  entries: RankedEntry[];
  potCents: number;
  entryCents: number;
  winnerKeys: string[];
  shareCents: number;
  stage: Stage;
  champions: { names: string[]; shareCents: number } | null;
};
```

(b) Drop the `creditUsers` query from the `Promise.all` (it becomes a 3-element destructure):
```ts
  const [brackets, winners, config] = await Promise.all([
    db.bracket.findMany({
      where: { official: true }, // only designated, paid entries are ranked on the board
      select: { id: true, userId: true, name: true, picks: true },
    }),
    currentWinners(),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);
```

(c) Size the pot from the official-bracket count and drop `players` (replace the `const pool = … const { players, potCents } = pool;` lines):
```ts
  const entryCents = config?.entryCents ?? 5000;
  const { potCents } = computePoolStats(brackets.length, entryCents); // pot = brackets in × entry
  const { winners: winEntries, shareCents } = potSplit(entries, potCents);
```
And remove `players,` from the returned object.

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: clean. (If `tsc` flags `players` anywhere, it's an unremoved reference — fix it. `HomeContent`/`page.tsx` read `board.potCents`/`board.entries`/`board.stage`, not `board.players`, so they need no change.)

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/pool.ts src/app/actions/leaderboard.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(pool): size pot from official brackets; drop players

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: PoolPill + i18n (drop players, relabel "brackets in")

**Files:**
- Modify: `src/app/_components/PoolPill.tsx`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `PoolHeaderStats` (Task 1) — `pool.bracketsIn`/`pool.filled`/`pool.potCents`/`pool.entryCents`.

- [ ] **Step 1: Update the i18n keys** — in `src/lib/i18n.ts`, in the `en` block replace the five `nav.pool*` lines (the `{entries}` ones + `nav.poolPlayers`) with these four (note: `nav.poolPlayers` is DELETED):

```ts
  'nav.pool': '{amount} · {filled}/{bracketsIn}',
  'nav.poolAria': '{amount} pot, {filled} of {bracketsIn} brackets filled',
  'nav.poolBreakdown': '{bracketsIn} brackets × {entry} = {amount}',
  'nav.poolFilled': '{filled} of {bracketsIn} brackets filled',
```

And in the `es` block, replace the matching five lines with these four (delete `nav.poolPlayers`):

```ts
  'nav.pool': '{amount} · {filled}/{bracketsIn}',
  'nav.poolAria': 'bolsa {amount}, {filled} de {bracketsIn} brackets llenos',
  'nav.poolBreakdown': '{bracketsIn} brackets × {entry} = {amount}',
  'nav.poolFilled': '{filled} de {bracketsIn} brackets llenos',
```

(Leave `nav.poolView` unchanged.)

- [ ] **Step 2: Update `src/app/_components/PoolPill.tsx`** — switch the i18n vars to `bracketsIn` and remove the players line. Replace the `label`/`aria` lines and the popover body.

The label/aria (currently using `entries: pool.entries`):
```tsx
  const label = t('nav.pool', { amount, filled: pool.filled, bracketsIn: pool.bracketsIn });
  const aria = t('nav.poolAria', { amount, filled: pool.filled, bracketsIn: pool.bracketsIn });
```

The popover body — replace the three `<p>`s (breakdown / filled / players) with two (drop players):
```tsx
          <p style={{ margin: 0, fontWeight: 600 }}>{t('nav.poolBreakdown', { bracketsIn: pool.bracketsIn, entry, amount })}</p>
          <p className="muted" style={{ margin: '4px 0 8px' }}>{t('nav.poolFilled', { filled: pool.filled, bracketsIn: pool.bracketsIn })}</p>
          <Link href="/brackets" onClick={() => { setOpen(false); onNavigate?.(); }}>{t('nav.poolView')} →</Link>
```

(There must be no remaining reference to `pool.players`, `pool.entries`, or `nav.poolPlayers` in the file.)

- [ ] **Step 3: Verify the full gate**

Run: `npx tsc --noEmit && npx vitest run && npx next lint`
Expected: tsc + lint clean; all tests pass incl. the i18n parity test (`i18n.test.ts`) — the four updated keys exist in both `en` and `es`, and `nav.poolPlayers` is gone from both. The controller separately runs `rm -rf .next && npx next build`.

- [ ] **Step 4: Commit**

```bash
git add src/app/_components/PoolPill.tsx src/lib/i18n.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(pool): header pill shows brackets in; drop players line

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `computePoolStats(bracketsIn, entryCents) → { bracketsIn, potCents }`, `PoolStats`/`PoolHeaderStats` reshaped, `countFilledBrackets` unchanged → Task 1. ✅
- `getPoolStats`: bracketsIn = official.length, pot from count, drop users/credits query → Task 2 Step 1. ✅
- `leaderboard.ts`: pot = brackets.length × entryCents, drop creditUsers + `players` field → Task 2 Step 2. ✅
- `PoolPill` + i18n: `filled/in`, breakdown, drop players line + `nav.poolPlayers`, "brackets in" wording EN+ES → Task 3. ✅
- Home leaderboard pot pill unchanged (reads `board.potCents`) → confirmed in Task 2 Step 3 note. ✅
- TDD `computePoolStats`; update `pool-stats.test.ts`; keep `countFilledBrackets` tests → Task 1. ✅
- No schema/migration → Global Constraints. ✅
- Behavior: unused paid credit no longer inflates the pot (pot now counts official brackets) → implicit in Task 2 (count of official rows, not sum of credits). ✅

**Placeholder scan:** none — every step has complete code/commands. ✅

**Type consistency:** `PoolStats`/`PoolHeaderStats` (Task 1) are consumed by `getPoolStats` (Task 2) and `PoolPill` (Task 3). `computePoolStats(number, number)` call sites in Task 2 (`official.length`, `brackets.length`) match the Task 1 signature. The i18n `bracketsIn` variable (Task 3 Step 1) matches the `PoolPill` calls (Task 3 Step 2). `LeaderboardData` minus `players` (Task 2) has no remaining consumer (HomeContent/page read other fields). ✅
