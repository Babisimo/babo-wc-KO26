# Home Results Drama (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standing **movement** (▲/▼) and a one-line **"what just happened"** drama note to the home dashboard, driven by a results-change snapshot.

**Architecture:** When official winners change (in `refreshResults`/`setMatchWinner`), snapshot each official bracket's pre-change rank into `Bracket.previousRank` and write structured `ResultEvent` rows (slot, winner, loser, bustedCount, newLeader) — all inside the existing winner-persist transaction. Pure libs compute the delta and the movement; the home page server-renders the movement indicator and the latest event.

**Tech Stack:** Next.js 15.5 App Router, Prisma 6 + Neon, React 19, Vitest 4, the existing `scoring`/`leaderboard-rank` pure libs.

**Scope:** Phase 2 of the spec `docs/superpowers/specs/2026-06-27-home-dashboard-live-games-design.md`. Phase 1 (the games strip, standing line, lock gate) is merged. Movement and the drama line are **server-rendered** here (update on navigation/refresh), consistent with how P1's standing line works; live-polling them is a deliberate out-of-scope follow-up.

## Global Constraints

- **i18n drift-guard:** every new user-facing string is added to BOTH `en` and `es` blocks in `src/lib/i18n.ts` (a missing/extra key is a compile error). Public Spanish is casual northern-Mexican (Sonoran); team names untranslated.
- **Ranking parity:** rank with the SAME entries the leaderboard uses — `{ key: bracketId, name: "display — bracketName", total }`, via `rankEntries` (`src/lib/leaderboard-rank.ts`), where `display = username (firstName)` exactly as `leaderboard.ts` builds it. Score with `scoreBracket` (`src/lib/scoring.ts`).
- **Pure libs are unit-tested (TDD); glue/components/migrations are not unit-tested** (verified by `tsc`/`lint`/`build` + manual check).
- **Verification gate:** `npx tsc --noEmit`, `npx vitest run`, `npx next lint` clean before a task is done (build where noted).
- **⚠ Windows/Prisma:** stop the dev server before `prisma generate`/`prisma db push` (it locks `query_engine-windows.dll.node`). `db push` writes the live Neon DB — that is the project's migration mechanism. Both schema additions are **additive and nullable/new-table**, so no data loss and no backfill.
- **Commits:** author `Oswaldo Gonzalez <Oswaldo@calvada.local>`; end every message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (use `git -c user.name=... -c user.email=...`).

---

### Task 1: Schema — `Bracket.previousRank` + `ResultEvent`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Bracket.previousRank: Int?` and a `ResultEvent` model (`id`, `slot Int`, `winner String`, `loser String`, `bustedCount Int`, `newLeader String?`, `createdAt DateTime`). The generated client exposes `db.resultEvent` and `bracket.previousRank`.

- [ ] **Step 1: Add the field + model** — in `prisma/schema.prisma`, add `previousRank Int?` to `Bracket` (after `official`), and append a new model:

```prisma
model ResultEvent {
  id          String   @id @default(cuid())
  slot        Int
  winner      String
  loser       String
  bustedCount Int
  newLeader   String?
  createdAt   DateTime @default(now())

  @@index([createdAt])
}
```

And the Bracket change:

```prisma
  official    Boolean   @default(false) // designated paid entry; counts in pot/leaderboard
  previousRank Int?                      // rank just before the latest results change; for movement ▲/▼
```

- [ ] **Step 2: Push schema + regenerate client** (stop the dev server first)

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema" and "Generated Prisma Client". (Writes the live Neon DB; the additions are additive.)

- [ ] **Step 3: Verify the client types compile**

Run: `npx tsc --noEmit`
Expected: clean (the new model/field are now typed).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(db): add Bracket.previousRank + ResultEvent for results drama

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `movement()` (pure)

**Files:**
- Modify: `src/lib/standing.ts`
- Test: `src/lib/standing.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `movement(previousRank: number | null, currentRank: number): { dir: 'up' | 'down' | 'same' | 'none'; places: number }` — `none` when `previousRank` is null; `up`/`down` with the absolute number of places moved; `same` when equal.

- [ ] **Step 1: Write the failing test** (append to `src/lib/standing.test.ts`)

```ts
import { movement } from './standing';

describe('movement', () => {
  it('reports no movement when there is no previous rank', () => {
    expect(movement(null, 3)).toEqual({ dir: 'none', places: 0 });
  });
  it('reports upward movement (lower rank number is better)', () => {
    expect(movement(5, 3)).toEqual({ dir: 'up', places: 2 });
  });
  it('reports downward movement', () => {
    expect(movement(2, 6)).toEqual({ dir: 'down', places: 4 });
  });
  it('reports no change when the rank is unchanged', () => {
    expect(movement(4, 4)).toEqual({ dir: 'same', places: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/standing.test.ts`
Expected: FAIL — `movement is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/standing.ts`)

```ts
/** Rank delta for the standing line. Lower rank number is better, so prev > cur means "up". */
export function movement(
  previousRank: number | null,
  currentRank: number,
): { dir: 'up' | 'down' | 'same' | 'none'; places: number } {
  if (previousRank === null) return { dir: 'none', places: 0 };
  if (previousRank > currentRank) return { dir: 'up', places: previousRank - currentRank };
  if (previousRank < currentRank) return { dir: 'down', places: currentRank - previousRank };
  return { dir: 'same', places: 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/standing.test.ts`
Expected: PASS (all standing tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/standing.ts src/lib/standing.test.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): movement() rank-delta helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `resultDelta()` (pure)

**Files:**
- Create: `src/lib/result-delta.ts`
- Test: `src/lib/result-delta.test.ts`

**Interfaces:**
- Consumes: `scoreBracket` (`src/lib/scoring.ts`), `rankEntries` (`src/lib/leaderboard-rank.ts`).
- Produces:
  - `type WinnerMap = Record<number, string | null>`
  - `type SlotTeams = Record<number, { teamA: string | null; teamB: string | null }>`
  - `type DeltaBracket = { display: string; rankName: string; picks: Record<number, string> }`
  - `type ResultEventData = { slot: number; winner: string; loser: string; bustedCount: number }`
  - `resultDelta(oldW: WinnerMap, newW: WinnerMap, slots: SlotTeams, brackets: DeltaBracket[]): { events: ResultEventData[]; newLeader: string | null }`
    - `events`: one per slot that went from no-winner → a winner; `loser` = that slot's other participant; `bustedCount` = official brackets whose pick for the slot was the loser.
    - `newLeader`: the new rank-1 player `display` IF the leader changed from before to after (else null).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/result-delta.test.ts
import { describe, it, expect } from 'vitest';
import { resultDelta, type SlotTeams, type DeltaBracket } from './result-delta';

const slots: SlotTeams = {
  1: { teamA: 'USA', teamB: 'BIH' },
  2: { teamA: 'GER', teamB: 'PAR' },
};
// ROUND_POINTS for R32 slots is the same for slots 1 and 2, so scores compare cleanly.
const brackets: DeltaBracket[] = [
  { display: 'ana (Ana)', rankName: 'ana (Ana) — A', picks: { 1: 'USA', 2: 'GER' } },
  { display: 'beto (Beto)', rankName: 'beto (Beto) — B', picks: { 1: 'BIH', 2: 'GER' } },
];

describe('resultDelta', () => {
  it('emits an event per newly-decided slot with loser + busted count', () => {
    const { events } = resultDelta({}, { 1: 'USA' }, slots, brackets);
    expect(events).toEqual([{ slot: 1, winner: 'USA', loser: 'BIH', bustedCount: 1 }]); // beto picked BIH
  });

  it('ignores slots that were already decided', () => {
    const { events } = resultDelta({ 1: 'USA' }, { 1: 'USA', 2: 'GER' }, slots, brackets);
    expect(events.map((e) => e.slot)).toEqual([2]);
  });

  it('reports a new leader when the top of the board changes', () => {
    // before: nothing decided → tie at 0 → leader is ana by name. After slot 1 (USA): ana leads alone.
    // After slot 2 also won by both, ana still leads. Force a flip: only beto is right on slot 1.
    const flip = resultDelta({}, { 1: 'BIH' }, slots, brackets);
    expect(flip.newLeader).toBe('beto (Beto)'); // beto picked BIH, ana didn't → beto jumps to #1
  });

  it('returns null newLeader when the leader does not change', () => {
    const { newLeader } = resultDelta({}, { 2: 'GER' }, slots, brackets); // both picked GER → tie unchanged
    expect(newLeader).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/result-delta.test.ts`
Expected: FAIL — `Cannot find module './result-delta'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/result-delta.ts
import { scoreBracket } from '@/lib/scoring';
import { rankEntries } from '@/lib/leaderboard-rank';

export type WinnerMap = Record<number, string | null>;
export type SlotTeams = Record<number, { teamA: string | null; teamB: string | null }>;
export type DeltaBracket = { display: string; rankName: string; picks: Record<number, string> };
export type ResultEventData = { slot: number; winner: string; loser: string; bustedCount: number };

/** Display name of the rank-1 bracket's owner under a given winner map (null if no brackets). */
function leaderDisplay(brackets: DeltaBracket[], winners: WinnerMap): string | null {
  if (brackets.length === 0) return null;
  const ranked = rankEntries(
    brackets.map((b) => ({ key: b.rankName, name: b.rankName, total: scoreBracket(b.picks, winners) })),
  );
  const topName = ranked[0].name;
  return brackets.find((b) => b.rankName === topName)?.display ?? null;
}

/**
 * What changed between two winner maps: a ResultEvent per newly-decided slot (winner appeared),
 * plus the new leader's display when the top of the board flipped.
 */
export function resultDelta(
  oldW: WinnerMap,
  newW: WinnerMap,
  slots: SlotTeams,
  brackets: DeltaBracket[],
): { events: ResultEventData[]; newLeader: string | null } {
  const events: ResultEventData[] = [];
  for (let slot = 1; slot <= 31; slot++) {
    const before = oldW[slot] ?? null;
    const after = newW[slot] ?? null;
    if (before || !after) continue; // only no-winner → winner
    const teams = slots[slot] ?? { teamA: null, teamB: null };
    const loser = (teams.teamA === after ? teams.teamB : teams.teamA) ?? '';
    const bustedCount = loser ? brackets.filter((b) => b.picks[slot] === loser).length : 0;
    events.push({ slot, winner: after, loser, bustedCount });
  }

  const before = leaderDisplay(brackets, oldW);
  const after = leaderDisplay(brackets, newW);
  const newLeader = after && after !== before ? after : null;

  return { events, newLeader };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/result-delta.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/result-delta.ts src/lib/result-delta.test.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): resultDelta — newly-decided events + busted count + leader change

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Snapshot + record on winner change (glue)

**Files:**
- Create: `src/app/actions/results-delta.ts`
- Modify: `src/app/actions/results.ts` (call the helper inside both `setMatchWinner` and `refreshResults` transactions)

**Interfaces:**
- Consumes: `resultDelta` (Task 3), `scoreBracket`, `rankEntries`, `getOfficialBracket` (for slot participants), `db`, `Prisma`.
- Produces: `buildResultDeltaOps(before: WinnerMap, after: WinnerMap): Promise<Prisma.PrismaPromise<unknown>[]>` — returns the writes (each official bracket's `previousRank` set to its pre-change rank; one `resultEvent.create` per newly-decided slot, each carrying the batch's `newLeader`) to splice into the caller's `$transaction`. Returns `[]` when there are no newly-decided slots.

- [ ] **Step 1: Write the helper**

```ts
// src/app/actions/results-delta.ts
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getOfficialBracket } from '@/app/actions/bracket';
import { scoreBracket } from '@/lib/scoring';
import { rankEntries } from '@/lib/leaderboard-rank';
import { resultDelta, type WinnerMap, type SlotTeams, type DeltaBracket } from '@/lib/result-delta';
import type { Picks } from '@/lib/bracket-picks';

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

/**
 * Writes to record after winners change: each official bracket's pre-change rank → previousRank,
 * and a ResultEvent per newly-decided slot. Returns [] when nothing was newly decided.
 */
export async function buildResultDeltaOps(
  before: WinnerMap,
  after: WinnerMap,
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const rows = await db.bracket.findMany({ where: { official: true }, select: { id: true, userId: true, name: true, picks: true } });
  if (rows.length === 0) {
    // No brackets to rank, but still record events so the drama line works.
    return recordEventsOnly(before, after);
  }

  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, username: true, firstName: true },
  });
  const displayOf = new Map(users.map((u) => {
    const handle = u.username ?? u.name;
    return [u.id, u.firstName ? `${handle} (${u.firstName})` : handle];
  }));

  const brackets: (DeltaBracket & { id: string })[] = rows.map((r) => {
    const display = displayOf.get(r.userId) ?? 'Unknown';
    return { id: r.id, display, rankName: `${display} — ${r.name}`, picks: coercePicks(r.picks) };
  });

  // Pre-change ranks (same entries the leaderboard uses, scored under the OLD winners).
  const ranked = rankEntries(brackets.map((b) => ({ key: b.id, name: b.rankName, total: scoreBracket(b.picks, before) })));
  const rankById = new Map(ranked.map((e) => [e.key, e.rank]));

  const { slots } = await getOfficialBracket();
  const slotTeams: SlotTeams = {};
  for (const s of slots) slotTeams[s.slot] = { teamA: s.teamA, teamB: s.teamB };

  const { events, newLeader } = resultDelta(before, after, slotTeams, brackets);
  if (events.length === 0) return [];

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const b of brackets) {
    ops.push(db.bracket.update({ where: { id: b.id }, data: { previousRank: rankById.get(b.id) ?? null } }));
  }
  for (const e of events) {
    ops.push(db.resultEvent.create({ data: { slot: e.slot, winner: e.winner, loser: e.loser, bustedCount: e.bustedCount, newLeader } }));
  }
  return ops;
}

/** Record events with no bracket ranking (no official brackets yet). */
async function recordEventsOnly(before: WinnerMap, after: WinnerMap): Promise<Prisma.PrismaPromise<unknown>[]> {
  const { slots } = await getOfficialBracket();
  const slotTeams: SlotTeams = {};
  for (const s of slots) slotTeams[s.slot] = { teamA: s.teamA, teamB: s.teamB };
  const { events } = resultDelta(before, after, slotTeams, []);
  return events.map((e) =>
    db.resultEvent.create({ data: { slot: e.slot, winner: e.winner, loser: e.loser, bustedCount: e.bustedCount, newLeader: null } }),
  );
}
```

- [ ] **Step 2: Wire into `setMatchWinner`** — in `src/app/actions/results.ts`, in `setMatchWinner`, replace the persist block (currently `if (persistOps.length > 0) { await db.$transaction(persistOps); }`) with:

```ts
  const deltaOps = await buildResultDeltaOps(before, after);
  if (persistOps.length > 0 || deltaOps.length > 0) {
    await db.$transaction([...persistOps, ...deltaOps]);
  }
```

And add the import at the top: `import { buildResultDeltaOps } from '@/app/actions/results-delta';`

- [ ] **Step 3: Wire into `refreshResults`** — in the same file, in `refreshResults`, replace the persist block (`if (changes.length > 0) { await db.$transaction(changes.map(...)) }`) with:

```ts
  const after: OfficialWinners = { ...existing };
  for (const c of changes) after[c.slot] = c.next;
  const deltaOps = await buildResultDeltaOps(existing, after);
  if (changes.length > 0 || deltaOps.length > 0) {
    await db.$transaction([
      ...changes.map((c) =>
        db.match.update({ where: { slot: c.slot }, data: { actualWinner: c.next, winnerSource: c.next === null ? null : 'FEED' } }),
      ),
      ...deltaOps,
    ]);
  }
```

(`existing` is the pre-change winner map already built in `refreshResults`; `after` applies the `changes`.)

- [ ] **Step 4: Verify types + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/results-delta.ts src/app/actions/results.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): snapshot previousRank + write ResultEvents on winner change

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Surface movement + "what just happened" on home

**Files:**
- Create: `src/app/_components/WhatHappened.tsx`
- Modify: `src/app/page.tsx` (compute movement for the user's top bracket; fetch the latest ResultEvent)
- Modify: `src/app/HomeContent.tsx` (movement indicator in the standing line; render `WhatHappened`)
- Modify: `src/lib/i18n.ts` (movement + drama keys, en + es)

**Interfaces:**
- Consumes: `movement` (Task 2), `db.resultEvent` (Task 1), existing `myStanding`, `getNextGames`, `getLeaderboard`.
- Produces: a home page that shows `You: 3rd · 24 pts ▲2` and a `⚡ {winner} beat {loser} — {n} busted · {leader} takes #1` line when a recent event exists.

- [ ] **Step 1: Add i18n keys** — insert into `en` (near `home.youStanding`) and the matching `es` block:

```ts
// en
'home.moveUp': '▲{n}',
'home.moveDown': '▼{n}',
'home.bustedLine': '⚡ {winner} beat {loser} — {n} busted',
'home.takesFirst': '{leader} takes #1',
```

```ts
// es
'home.moveUp': '▲{n}',
'home.moveDown': '▼{n}',
'home.bustedLine': '⚡ {winner} le ganó a {loser} — {n} se cayeron',
'home.takesFirst': '{leader} agarra el #1',
```

- [ ] **Step 2: Write `WhatHappened`**

```tsx
// src/app/_components/WhatHappened.tsx
'use client';

import { useT } from '@/app/_components/LangProvider';
import { teamName } from '@/lib/team-name';

export type ResultEventView = { winner: string; loser: string; bustedCount: number; newLeader: string | null };

/** One-line drama note about the most recent finished game. Renders nothing when there's none. */
export default function WhatHappened({ event }: { event: ResultEventView | null }) {
  const t = useT();
  if (!event) return null;
  return (
    <p className="whathappened reveal" role="status">
      {t('home.bustedLine', { winner: teamName(event.winner), loser: teamName(event.loser), n: event.bustedCount })}
      {event.newLeader && <> · {t('home.takesFirst', { leader: event.newLeader })}</>}
    </p>
  );
}
```

- [ ] **Step 3: Add a style** — append to `src/app/globals.css`:

```css
.whathappened {
  margin: 0 0 18px; padding: 10px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--chalk); background: rgba(255,255,255,0.02);
  color: var(--line-dim); font-size: 0.9rem; text-align: center; text-wrap: balance;
}
```

- [ ] **Step 4: Update `page.tsx`** — compute movement for the user's top bracket and fetch the latest event. Replace the standing block and add the event fetch:

```tsx
import { movement } from '@/lib/standing';
import { db } from '@/lib/db';
// ...existing imports...

  let standing: { rank: number; total: number } | null = null;
  let move: { dir: 'up' | 'down' | 'same' | 'none'; places: number } = { dir: 'none', places: 0 };
  if (userId && board.stage.started) {
    const myBrackets = await db.bracket.findMany({ where: { userId, official: true }, select: { id: true, previousRank: true } });
    const myKeys = myBrackets.map((b) => b.id);
    standing = myStanding(board.entries, myKeys);
    if (standing) {
      const topKey = board.entries.filter((e) => myKeys.includes(e.key)).reduce((a, b) => (b.rank < a.rank ? b : a)).key;
      const prev = myBrackets.find((b) => b.id === topKey)?.previousRank ?? null;
      move = movement(prev, standing.rank);
    }
  }

  const latest = await db.resultEvent.findFirst({ orderBy: { createdAt: 'desc' } });
  const event = latest
    ? { winner: latest.winner, loser: latest.loser, bustedCount: latest.bustedCount, newLeader: latest.newLeader }
    : null;
```

And pass `move` and `event` to `HomeContent`:

```tsx
  return (
    <HomeContent
      signedIn={!!userId}
      board={board}
      nextGames={nextGames}
      standing={standing}
      move={move}
      event={event}
    />
  );
```

- [ ] **Step 5: Update `HomeContent.tsx`** — accept the new props, show movement in the standing line, render `WhatHappened` above the leaderboard:

Add imports:
```tsx
import WhatHappened, { type ResultEventView } from '@/app/_components/WhatHappened';
```
Extend the props type with:
```tsx
  move: { dir: 'up' | 'down' | 'same' | 'none'; places: number };
  event: ResultEventView | null;
```
Replace the standing line with:
```tsx
        {standing && (
          <p className="lead">
            {t('home.youStanding', { rank: standing.rank, points: standing.total })}
            {move.dir === 'up' && <span className="move move-up"> {t('home.moveUp', { n: move.places })}</span>}
            {move.dir === 'down' && <span className="move move-down"> {t('home.moveDown', { n: move.places })}</span>}
          </p>
        )}
```
And render the drama line just before the signed-in leaderboard `<section className="panel ...">`:
```tsx
      <WhatHappened event={event} />
```

- [ ] **Step 6: Add movement styles** — append to `src/app/globals.css`:

```css
.move { font-weight: 700; font-size: 0.92em; }
.move-up { color: var(--grass); }
.move-down { color: var(--crimson); }
```

- [ ] **Step 7: Verify the full gate**

Run: `npx tsc --noEmit && npx vitest run && npx next lint && (rm -rf .next && npx next build)`
Expected: all clean; build lists the routes. (If `next build` throws a `PageNotFoundError` on unrelated pages, that's the known stale-`.next` flake — re-run `rm -rf .next && npx next build`.)

- [ ] **Step 8: Commit**

```bash
git add src/app/_components/WhatHappened.tsx src/app/page.tsx src/app/HomeContent.tsx src/lib/i18n.ts src/app/globals.css
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): standing movement + what-just-happened drama line

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (P2 sections):**
- `Bracket.previousRank` + `ResultEvent` model → Task 1. ✅
- Snapshot pre-change ranks when winners change, in the results actions → Task 4 (`buildResultDeltaOps` in both `setMatchWinner` and `refreshResults`, ranking under the OLD winners). ✅
- `ResultEvent` structured (slot/winner/loser/bustedCount/newLeader), rendered via i18n → Task 1 (model) + Task 3 (compute) + Task 5 (render). ✅
- `bustedCount` = official brackets that had the loser advancing from that slot → Task 3. ✅
- `newLeader` set only when #1 changed → Task 3 `leaderDisplay` before vs after. ✅
- Movement = previousRank − currentRank (▲/▼/—) → Task 2 + Task 5. ✅
- Home reads the latest event; renders nothing if none → Task 5 (`findFirst orderBy createdAt desc`; `WhatHappened` returns null). ✅
- i18n en+es → Task 5. ✅
- Pure libs tested; glue not → Tasks 2,3 tested; 1,4,5 not. ✅

**Placeholder scan:** none — every code step is complete. ✅

**Type consistency:** `WinnerMap`/`SlotTeams`/`DeltaBracket`/`ResultEventData` (Task 3) reused in Task 4; `movement` return shape (Task 2) reused in Task 5 `move`; `ResultEventView` (Task 5 component) matches the `event` object built in `page.tsx`. `buildResultDeltaOps(before, after)` signature consistent across Task 4 call sites. Ranking uses `{key,name,total}` + `rankEntries` consistently with `leaderboard.ts`. ✅

**Note on live updates:** movement + drama line are server-rendered (update on navigation/refresh), matching P1's server-rendered standing line. Live-polling them is a deliberate follow-up, called out in Scope.
