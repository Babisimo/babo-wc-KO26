# Home Dashboard + Live Games (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page's lock countdown / "make your picks" CTA / stage meter with a personal dashboard built around a live/upcoming "Next up" games strip that shows each player their own pick and ✓/✗.

**Architecture:** Pure libs parse the ESPN scoreboard, choose which games to show, and resolve each game to the signed-in user's bracket pick + result. A `getNextGames` server action composes them (scoreboard + official draw + winners + the user's top bracket). A client `NextGames` component renders the strip and polls a `GET /api/next-games` route ~30s for live updates. `HomeContent` is restructured into the dashboard; the standing line is server-rendered from the leaderboard the page already fetches.

**Tech Stack:** Next.js 15.5 App Router (stock), React 19, Vitest 4, the existing ESPN scoreboard feed, `flag-icons`/`TeamFlag`, the `i18n.ts` dictionary.

**Scope:** Phase 1 only (spec: `docs/superpowers/specs/2026-06-27-home-dashboard-live-games-design.md`). Phase 2 (movement + "what just happened", with the `previousRank`/`ResultEvent` migration) is a separate plan written after P1 ships. No schema change in P1.

## Global Constraints

- **i18n drift-guard:** every new user-facing string is added to BOTH `en` and `es` blocks in `src/lib/i18n.ts` (a missing/extra key is a compile error). Public-facing Spanish is casual northern-Mexican (Sonoran) — tú/ustedes, keep loanwords like "picks", team names untranslated.
- **Team codes:** internal codes come from `TEAMS` (`src/lib/teams.ts`); resolve ESPN names via `resolveCode` (`src/lib/team-resolve.ts`).
- **Pure libs are unit-tested (TDD); glue/components/routes are not unit-tested** (verified by `tsc`/`lint`/`build` + manual check).
- **Verification gate per the project:** `npx tsc --noEmit`, `npx vitest run`, `npx next lint`, `npx next build` must all be clean before a task is done.
- **Commits:** author `Oswaldo Gonzalez <Oswaldo@calvada.local>`; end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Use `git -c user.name=... -c user.email=...`.
- **Windows/Prisma:** N/A in P1 (no schema). Tests/build run with the dev server stopped if it's holding `.next`.

---

### Task 1: Scoreboard → games mapper

**Files:**
- Create: `src/lib/next-games.ts`
- Test: `src/lib/next-games.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `type GameState = 'pre' | 'in' | 'post'`
  - `type Game = { teamA: string; teamB: string; kickoffIso: string; state: GameState; scoreA: number | null; scoreB: number | null }`
  - `mapScoreboardGames(json: unknown, resolve: (abbr?: string, name?: string) => string | null): Game[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/next-games.test.ts
import { describe, it, expect } from 'vitest';
import { mapScoreboardGames, type Game } from './next-games';

const resolve = (abbr?: string) => {
  const known = new Set(['RSA', 'CAN', 'GER', 'PAR']);
  return abbr && known.has(abbr) ? abbr : null;
};

describe('mapScoreboardGames', () => {
  it('maps scheduled, live, and final events with scores', () => {
    const json = {
      events: [
        { date: '2026-06-28T19:00Z', competitions: [{ status: { type: { state: 'pre' } },
          competitors: [{ team: { abbreviation: 'RSA' }, score: '0' }, { team: { abbreviation: 'CAN' }, score: '0' }] }] },
        { date: '2026-06-29T20:30Z', competitions: [{ status: { type: { state: 'in' } },
          competitors: [{ team: { abbreviation: 'GER' }, score: '1' }, { team: { abbreviation: 'PAR' }, score: '2' }] }] },
      ],
    };
    expect(mapScoreboardGames(json, resolve)).toEqual<Game[]>([
      { teamA: 'RSA', teamB: 'CAN', kickoffIso: '2026-06-28T19:00Z', state: 'pre', scoreA: null, scoreB: null },
      { teamA: 'GER', teamB: 'PAR', kickoffIso: '2026-06-29T20:30Z', state: 'in', scoreA: 1, scoreB: 2 },
    ]);
  });

  it('skips placeholder/unresolved competitors and dedupes', () => {
    const json = {
      events: [
        { date: '2026-06-28T19:00Z', competitions: [{ status: { type: { state: 'pre' } },
          competitors: [{ team: { abbreviation: 'RD32', displayName: 'Round of 32 1 Winner' } }, { team: { abbreviation: 'GER' } }] }] },
        { date: '2026-06-28T19:00Z', competitions: [{ status: { type: { state: 'pre' } },
          competitors: [{ team: { abbreviation: 'RSA' } }, { team: { abbreviation: 'CAN' } }] }] },
        { date: '2026-06-28T19:00Z', competitions: [{ status: { type: { state: 'pre' } },
          competitors: [{ team: { abbreviation: 'CAN' } }, { team: { abbreviation: 'RSA' } }] }] },
      ],
    };
    expect(mapScoreboardGames(json, resolve).map((g) => [g.teamA, g.teamB])).toEqual([['RSA', 'CAN']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/next-games.test.ts`
Expected: FAIL — `Cannot find module './next-games'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/next-games.ts
export type GameState = 'pre' | 'in' | 'post';
export type Game = {
  teamA: string; teamB: string; kickoffIso: string;
  state: GameState; scoreA: number | null; scoreB: number | null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Parse an ESPN scoreboard payload into resolved games. `resolve` maps a competitor's
 *  (abbreviation, displayName) to an internal code or null (placeholder/unknown → skipped). */
export function mapScoreboardGames(
  json: unknown,
  resolve: (abbr?: string, name?: string) => string | null,
): Game[] {
  const events = Array.isArray((json as { events?: unknown[] })?.events) ? (json as { events: unknown[] }).events : [];
  const out: Game[] = [];
  const seen = new Set<string>();
  for (const ev of events as Array<{ date?: string; competitions?: Array<{ status?: { type?: { state?: string } }; competitors?: Array<{ team?: { abbreviation?: string; displayName?: string }; score?: unknown }> }> }>) {
    const comp = ev?.competitions?.[0];
    const cs = comp?.competitors ?? [];
    if (cs.length !== 2) continue;
    const a = resolve(cs[0]?.team?.abbreviation, cs[0]?.team?.displayName);
    const b = resolve(cs[1]?.team?.abbreviation, cs[1]?.team?.displayName);
    if (!a || !b) continue;
    const key = [a, b].sort().join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    const st = comp?.status?.type?.state;
    const state: GameState = st === 'in' ? 'in' : st === 'post' ? 'post' : 'pre';
    out.push({
      teamA: a, teamB: b, kickoffIso: ev?.date ?? '', state,
      scoreA: state === 'pre' ? null : num(cs[0]?.score),
      scoreB: state === 'pre' ? null : num(cs[1]?.score),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/next-games.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/next-games.ts src/lib/next-games.test.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): scoreboard->games mapper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Game selection (`pickGames`)

**Files:**
- Modify: `src/lib/next-games.ts`
- Test: `src/lib/next-games.test.ts`

**Interfaces:**
- Consumes: `Game` (Task 1).
- Produces: `pickGames(games: Game[], limit?: number): Game[]` — live first, then soonest upcoming (kickoff asc), then most-recent finals (kickoff desc); capped at `limit` (default 3).

- [ ] **Step 1: Write the failing test** (append to `src/lib/next-games.test.ts`)

```ts
import { pickGames } from './next-games';

describe('pickGames', () => {
  const g = (teamA: string, teamB: string, kickoffIso: string, state: 'pre' | 'in' | 'post') =>
    ({ teamA, teamB, kickoffIso, state, scoreA: null, scoreB: null });

  it('orders live first, then soonest upcoming, then recent finals, capped at 3', () => {
    const games = [
      g('A', 'B', '2026-06-30T00:00Z', 'pre'),
      g('C', 'D', '2026-06-29T00:00Z', 'pre'),
      g('E', 'F', '2026-06-29T12:00Z', 'in'),
      g('G', 'H', '2026-06-28T00:00Z', 'post'),
      g('I', 'J', '2026-06-27T00:00Z', 'post'),
    ];
    expect(pickGames(games).map((x) => x.teamA)).toEqual(['E', 'C', 'A']);
  });

  it('falls back to finals when nothing is upcoming or live', () => {
    const games = [g('G', 'H', '2026-06-28T00:00Z', 'post'), g('I', 'J', '2026-06-29T00:00Z', 'post')];
    expect(pickGames(games, 1).map((x) => x.teamA)).toEqual(['I']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/next-games.test.ts`
Expected: FAIL — `pickGames is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/next-games.ts`)

```ts
const ms = (iso: string): number => {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
};

/** Up to `limit` games to surface: live first, then soonest upcoming, then most-recent finals. */
export function pickGames(games: Game[], limit = 3): Game[] {
  const live = games.filter((g) => g.state === 'in');
  const upcoming = games.filter((g) => g.state === 'pre').sort((a, b) => ms(a.kickoffIso) - ms(b.kickoffIso));
  const finals = games.filter((g) => g.state === 'post').sort((a, b) => ms(b.kickoffIso) - ms(a.kickoffIso));
  return [...live, ...upcoming, ...finals].slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/next-games.test.ts`
Expected: PASS (4 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/next-games.ts src/lib/next-games.test.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): pickGames selection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Game → slot → your pick (`gameSlotPick`)

**Files:**
- Create: `src/lib/game-slot.ts`
- Test: `src/lib/game-slot.test.ts`

**Interfaces:**
- Consumes: nothing (pure); takes plain inputs.
- Produces:
  - `type SlotParticipants = { slot: number; teamA: string | null; teamB: string | null }`
  - `type PickResult = 'pending' | 'won' | 'busted'`
  - `gameSlotPick(slots, game, picks, winners): { slot: number | null; yourPick: string | null; result: PickResult | null }`
    - `game: { teamA: string; teamB: string }`, `picks: Record<number, string>`, `winners: Record<number, string | null>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/game-slot.test.ts
import { describe, it, expect } from 'vitest';
import { gameSlotPick, type SlotParticipants } from './game-slot';

const slots: SlotParticipants[] = [
  { slot: 1, teamA: 'RSA', teamB: 'CAN' },
  { slot: 2, teamA: 'GER', teamB: 'PAR' },
];

describe('gameSlotPick', () => {
  it('matches a fixture to its slot regardless of team order and returns the user pick', () => {
    const r = gameSlotPick(slots, { teamA: 'PAR', teamB: 'GER' }, { 2: 'GER' }, {});
    expect(r).toEqual({ slot: 2, yourPick: 'GER', result: 'pending' });
  });

  it('marks won/busted once the slot has a winner', () => {
    expect(gameSlotPick(slots, { teamA: 'GER', teamB: 'PAR' }, { 2: 'GER' }, { 2: 'GER' }).result).toBe('won');
    expect(gameSlotPick(slots, { teamA: 'GER', teamB: 'PAR' }, { 2: 'PAR' }, { 2: 'GER' }).result).toBe('busted');
  });

  it('returns nulls when the fixture has no slot or the user has no pick there', () => {
    expect(gameSlotPick(slots, { teamA: 'BRA', teamB: 'JPN' }, { 2: 'GER' }, {})).toEqual({ slot: null, yourPick: null, result: null });
    expect(gameSlotPick(slots, { teamA: 'GER', teamB: 'PAR' }, {}, {})).toEqual({ slot: 2, yourPick: null, result: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/game-slot.test.ts`
Expected: FAIL — `Cannot find module './game-slot'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/game-slot.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/game-slot.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game-slot.ts src/lib/game-slot.test.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): gameSlotPick resolver

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: My standing (`myStanding`)

**Files:**
- Create: `src/lib/standing.ts`
- Test: `src/lib/standing.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `type StandingEntry = { key: string; total: number; rank: number }`
  - `myStanding(entries: StandingEntry[], myKeys: string[]): { rank: number; total: number } | null` — the user's best-ranked bracket, or null if none.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/standing.test.ts
import { describe, it, expect } from 'vitest';
import { myStanding, type StandingEntry } from './standing';

const entries: StandingEntry[] = [
  { key: 'a', total: 28, rank: 1 },
  { key: 'b', total: 24, rank: 2 },
  { key: 'c', total: 24, rank: 2 },
];

describe('myStanding', () => {
  it('returns the best-ranked of the user’s brackets', () => {
    expect(myStanding(entries, ['b', 'c'])).toEqual({ rank: 2, total: 24 });
    expect(myStanding(entries, ['a', 'b'])).toEqual({ rank: 1, total: 28 });
  });
  it('returns null when the user has no entry on the board', () => {
    expect(myStanding(entries, ['z'])).toBeNull();
    expect(myStanding(entries, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/standing.test.ts`
Expected: FAIL — `Cannot find module './standing'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/standing.ts
export type StandingEntry = { key: string; total: number; rank: number };

/** The signed-in user's best-ranked official bracket on the leaderboard, or null. */
export function myStanding(
  entries: StandingEntry[],
  myKeys: string[],
): { rank: number; total: number } | null {
  const mine = entries.filter((e) => myKeys.includes(e.key));
  if (mine.length === 0) return null;
  const best = mine.reduce((a, b) => (b.rank < a.rank ? b : a));
  return { rank: best.rank, total: best.total };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/standing.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/standing.ts src/lib/standing.test.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): myStanding selector

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `getNextGames` action + `/api/next-games` route

**Files:**
- Create: `src/app/actions/next-games.ts`
- Create: `src/app/api/next-games/route.ts`

**Interfaces:**
- Consumes: `mapScoreboardGames`/`pickGames` (Tasks 1-2), `gameSlotPick` (Task 3); existing `getOfficialBracket` (`src/app/actions/bracket.ts`), `currentWinners` (`src/app/actions/results.ts`), `scoreBracket` (`src/lib/scoring.ts`), `coercePicks` pattern, `formatLockTimePT` (`src/lib/lock.ts`), `TEAMS`, `resolveCode`, `auth`.
- Produces:
  - `type GameRow = { teamA: string; teamB: string; kickoffIso: string; state: GameState; scoreA: number | null; scoreB: number | null; yourPick: string | null; result: PickResult | null }`
  - `getNextGames(): Promise<{ games: GameRow[]; lockNote: string | null }>` — reads the session itself; resolves "your pick" against the user's top-scoring official bracket.

- [ ] **Step 1: Write the action**

```ts
// src/app/actions/next-games.ts
'use server';

import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getOfficialBracket } from '@/app/actions/bracket';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { formatLockTimePT } from '@/lib/lock';
import { TEAMS } from '@/lib/teams';
import { resolveCode } from '@/lib/team-resolve';
import { mapScoreboardGames, pickGames, type GameState } from '@/lib/next-games';
import { gameSlotPick, type SlotParticipants, type PickResult } from '@/lib/game-slot';
import type { Picks } from '@/lib/bracket-picks';

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
// Knockout window (UTC). One request covers the whole range.
const DATES = '20260628-20260720';

const KNOWN = new Set(TEAMS.map((t) => t.code));
const resolveTeam = (abbr?: string, name?: string): string | null => {
  if (abbr && KNOWN.has(abbr)) return abbr;
  const r = resolveCode(name ?? abbr ?? '');
  return r && KNOWN.has(r) ? r : null;
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

export type GameRow = {
  teamA: string; teamB: string; kickoffIso: string; state: GameState;
  scoreA: number | null; scoreB: number | null;
  yourPick: string | null; result: PickResult | null;
};

export async function getNextGames(): Promise<{ games: GameRow[]; lockNote: string | null }> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id ?? null;

  const [{ slots, lockTimeIso }, winners] = await Promise.all([getOfficialBracket(), currentWinners()]);
  const slotParticipants: SlotParticipants[] = slots.map((s) => ({ slot: s.slot, teamA: s.teamA, teamB: s.teamB }));

  // The user's top-scoring official bracket supplies "your pick".
  let topPicks: Picks = {};
  if (userId) {
    const brackets = await db.bracket.findMany({ where: { userId, official: true }, select: { picks: true } });
    let best = -1;
    for (const b of brackets) {
      const picks = coercePicks(b.picks);
      const score = scoreBracket(picks, winners);
      if (score > best) { best = score; topPicks = picks; }
    }
  }

  let games: GameRow[] = [];
  try {
    const res = await fetch(`${SCOREBOARD}?dates=${DATES}`, { cache: 'no-store' });
    if (res.ok) {
      const parsed = pickGames(mapScoreboardGames(await res.json(), resolveTeam));
      games = parsed.map((g) => {
        const { yourPick, result } = gameSlotPick(slotParticipants, g, topPicks, winners);
        return { ...g, yourPick, result };
      });
    }
  } catch {
    games = []; // feed unreachable → empty strip; page is unaffected
  }

  const lockMs = lockTimeIso ? Date.parse(lockTimeIso) : NaN;
  const lockNote = Number.isFinite(lockMs) && Date.now() < lockMs ? formatLockTimePT(new Date(lockMs)) : null;

  return { games, lockNote };
}
```

- [ ] **Step 2: Write the polling route**

```ts
// src/app/api/next-games/route.ts
import { NextResponse } from 'next/server';
import { getNextGames } from '@/app/actions/next-games';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getNextGames());
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: clean (no errors; resolve any unused-import warnings).

- [ ] **Step 4: Manual smoke check**

Run: `npx tsx --env-file=.env -e "import('./src/app/actions/next-games.ts').then(async m => { console.log(JSON.stringify(await m.getNextGames(), null, 2)); process.exit(0); })"`
Expected: prints `{ games: [...up to 3...], lockNote: "Jun 28, 2026, 11:00 AM PDT" }`. (`yourPick` is null when run without a session — that's expected here; per-user resolution is exercised in the UI.)

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/next-games.ts src/app/api/next-games/route.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): getNextGames action + polling route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `NextGames` strip component (+ polling)

**Files:**
- Create: `src/app/_components/NextGames.tsx`
- Modify: `src/lib/i18n.ts` (add the strip's keys to `en` and `es`)

**Interfaces:**
- Consumes: `GameRow` (Task 5), `useT`/`LangProvider`, `TeamFlag` (`src/app/_components/TeamFlag.tsx`), `teamName` (`src/lib/team-name.ts`), `formatRemaining` (`src/lib/format-remaining.ts`).
- Produces: `export default function NextGames({ initial }: { initial: { games: GameRow[]; lockNote: string | null } })` — renders the strip and refreshes from `/api/next-games` every 30s.

- [ ] **Step 1: Add i18n keys** — insert into the `en` block (near other `home.*`) and the matching `es` block:

```ts
// en
'home.nextUp': 'Next up',
'home.live': 'LIVE',
'home.final': 'Final',
'home.kickoffIn': 'in {when}',
'home.yourPick': 'your pick',
'home.pickWon': 'survived',
'home.pickBusted': 'busted',
'home.picksLockAt': 'Picks lock {when}',
'home.noGames': 'Schedule unavailable right now.',
```

```ts
// es
'home.nextUp': 'Próximos',
'home.live': 'EN VIVO',
'home.final': 'Final',
'home.kickoffIn': 'en {when}',
'home.yourPick': 'tu pick',
'home.pickWon': 'la libró',
'home.pickBusted': 'se cayó',
'home.picksLockAt': 'Los picks cierran {when}',
'home.noGames': 'No hay horario por ahorita.',
```

- [ ] **Step 2: Write the component**

```tsx
// src/app/_components/NextGames.tsx
'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/app/_components/LangProvider';
import TeamFlag from '@/app/_components/TeamFlag';
import { teamName } from '@/lib/team-name';
import { formatRemaining } from '@/lib/format-remaining';
import type { GameRow } from '@/app/actions/next-games';

type Data = { games: GameRow[]; lockNote: string | null };

export default function NextGames({ initial }: { initial: Data }) {
  const t = useT();
  const [data, setData] = useState<Data>(initial);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/next-games', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch { /* keep last-known on transient errors */ }
    }, 30000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, []);

  return (
    <section className="nextup reveal">
      <p className="eyebrow">{t('home.nextUp')}</p>
      {data.games.length === 0 ? (
        <p className="muted">{t('home.noGames')}</p>
      ) : (
        <ul className="nextup-list">
          {data.games.map((g) => (
            <li key={`${g.teamA}-${g.teamB}`} className={`nextup-game state-${g.state}`}>
              <span className="ng-team"><TeamFlag code={g.teamA} /> {teamName(g.teamA)}</span>
              <span className="ng-mid">
                {g.state === 'pre'
                  ? <span className="ng-when">{t('home.kickoffIn', { when: formatRemaining(Math.max(0, Date.parse(g.kickoffIso) - now)) })}</span>
                  : <span className="ng-score">{g.scoreA ?? 0}–{g.scoreB ?? 0}{g.state === 'in' ? <em className="ng-live"> {t('home.live')}</em> : <em className="ng-final"> {t('home.final')}</em>}</span>}
              </span>
              <span className="ng-team ng-team-b">{teamName(g.teamB)} <TeamFlag code={g.teamB} /></span>
              {g.yourPick && (
                <span className={`ng-pick result-${g.result}`}>
                  {t('home.yourPick')}: {teamName(g.yourPick)}
                  {g.result === 'won' && ' ✓'}
                  {g.result === 'busted' && ' ✗'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.lockNote && <p className="nextup-lock muted">{t('home.picksLockAt', { when: data.lockNote })}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Add minimal styles** — append to `src/app/globals.css`:

```css
.nextup { margin-bottom: 18px; }
.nextup-list { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; }
.nextup-game {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;
  padding: 10px 14px; border: 1px solid var(--chalk); border-radius: var(--radius-sm);
  background: rgba(255,255,255,0.02);
}
.nextup-game.state-in { border-color: rgba(255,210,63,0.5); }
.ng-team { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.ng-team-b { justify-content: flex-end; }
.ng-mid { text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ng-live { color: var(--gold); font-style: normal; font-weight: 700; }
.ng-final { color: var(--line-dim); font-style: normal; }
.ng-pick { grid-column: 1 / -1; text-align: center; font-size: 0.84rem; color: var(--line-dim); }
.ng-pick.result-won { color: var(--grass); }
.ng-pick.result-busted { color: var(--crimson); }
.nextup-lock { margin: 8px 0 0; font-size: 0.82rem; text-align: center; }
```

- [ ] **Step 4: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: clean; 212 prior + new pure tests all pass; i18n drift-guard passes (both `en`/`es` have the new keys).

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/NextGames.tsx src/lib/i18n.ts src/app/globals.css
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): NextGames strip with live polling

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Restructure `HomeContent` into the dashboard

**Files:**
- Modify: `src/app/page.tsx` (fetch next games + the user's official bracket keys; compute standing)
- Modify: `src/app/HomeContent.tsx` (new composition; drop CTA/Countdown/StageTracker; add NextGames + standing)
- Modify: `src/lib/i18n.ts` (add `home.youStanding`)

**Interfaces:**
- Consumes: `getNextGames` (Task 5), `NextGames` (Task 6), `myStanding` (Task 4), existing `getLeaderboard`, `auth`, `db`.
- Produces: a home page where signed-in users see standing + games strip; signed-out users see the games strip + the join CTA.

- [ ] **Step 1: Add the standing i18n key** — `en`: `'home.youStanding': 'You: {rank} · {points} pts',` and `es`: `'home.youStanding': 'Tú: {rank} · {points} pts',`.

- [ ] **Step 2: Update `src/app/page.tsx`** to fetch games + standing and pass them down:

```tsx
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getLeaderboard } from '@/app/actions/leaderboard';
import { getNextGames } from '@/app/actions/next-games';
import { myStanding } from '@/lib/standing';
import HomeContent from './HomeContent';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id ?? null;
  const [board, nextGames] = await Promise.all([getLeaderboard(), getNextGames()]);

  let standing: { rank: number; total: number } | null = null;
  if (userId && board.stage.started) {
    const myKeys = (await db.bracket.findMany({ where: { userId, official: true }, select: { id: true } })).map((b) => b.id);
    standing = myStanding(board.entries, myKeys);
  }

  return (
    <HomeContent
      userName={session?.user?.name ?? null}
      signedIn={!!userId}
      board={board}
      nextGames={nextGames}
      standing={standing}
    />
  );
}
```

- [ ] **Step 3: Rewrite `src/app/HomeContent.tsx`** composition (drop `Countdown`, `StageTracker`, the signed-in play CTA; keep the leaderboard + signed-out CTA):

```tsx
'use client';

import Link from 'next/link';
import NextGames from '@/app/_components/NextGames';
import { useT } from '@/app/_components/LangProvider';
import type { LeaderboardData } from '@/app/actions/leaderboard';
import type { getNextGames } from '@/app/actions/next-games';

function dollars(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }

type NextGamesData = Awaited<ReturnType<typeof getNextGames>>;

export default function HomeContent({
  userName, signedIn, board, nextGames, standing,
}: {
  userName: string | null;
  signedIn: boolean;
  board: LeaderboardData;
  nextGames: NextGamesData;
  standing: { rank: number; total: number } | null;
}) {
  const t = useT();
  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 18 }}>
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1>{t('home.title')}</h1>
        {standing && (
          <p className="lead">{t('home.youStanding', { rank: standing.rank, points: standing.total })}</p>
        )}
      </header>

      <NextGames initial={nextGames} />

      {!signedIn && (
        <section className="cta reveal" style={{ marginTop: 4, marginBottom: 18 }}>
          <div className="cta-text">
            <p className="eyebrow">{t('home.ctaEyebrow')}</p>
            <h2>{t('home.ctaTitle')}</h2>
            <p className="muted">{t('home.ctaLead')}</p>
          </div>
          <div className="cta-actions">
            <Link href="/login" className="btn">{t('nav.login')}</Link>
            <Link href="/signup" className="btn btn-ghost">{t('nav.requestAccount')}</Link>
          </div>
        </section>
      )}

      {signedIn && (
        <section className="panel reveal reveal-2">
          <div className="panel-head">
            <h2>{t('home.leaderboard')}</h2>
            <span className="pill gold">
              {t('home.pot', { amount: dollars(board.potCents) })}
              {board.winnerKeys.length > 0 && board.shareCents > 0 && (
                <> · {board.winnerKeys.length === 1
                  ? t('home.leaderTakes', { amount: dollars(board.shareCents) })
                  : t('home.split', { n: board.winnerKeys.length, amount: dollars(board.shareCents) })}</>
              )}
            </span>
          </div>
          {board.entries.length === 0 ? (
            <p className="muted">{t('home.empty')}</p>
          ) : (
            <table>
              <thead><tr>
                <th style={{ width: 56 }}>{t('home.rank')}</th>
                <th>{t('home.player')}</th>
                <th className="num">{t('home.points')}</th>
              </tr></thead>
              <tbody>
                {board.entries.map((e) => {
                  const winner = board.winnerKeys.includes(e.key);
                  return (
                    <tr key={e.key} className={e.username ? 'row-link' : undefined}>
                      <td><span className={`rank${e.rank <= 3 ? ` r${e.rank}` : ''}`}>{e.rank}</span></td>
                      <td>
                        {e.username
                          ? <Link href={`/brackets/${encodeURIComponent(e.username)}`} className="lb-name">{e.name}</Link>
                          : e.name}
                        {winner && <span className="pill gold btn-sm" style={{ marginLeft: 8, padding: '2px 9px' }}>{t('home.leaderBadge')}</span>}
                      </td>
                      <td className="num"><span className="score">{e.total}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Champion banner placement** — the champion banner currently renders at the top of `HomeContent`. Keep it: re-add `import ChampionBanner from '@/app/_components/ChampionBanner';` and render `<ChampionBanner champions={board.champions} />` as the first child of `<main className="shell">` (above the header), unchanged from current behavior.

- [ ] **Step 5: Verify the full gate**

Run: `npx tsc --noEmit && npx vitest run && npx next lint && npx next build`
Expected: all clean; `next build` lists the routes incl. `/api/next-games`. Confirm `Countdown`/`StageTracker` are no longer imported by `HomeContent` (they remain in the repo, just unused by `/`).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/HomeContent.tsx src/lib/i18n.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(home): dashboard layout — standing + games strip, drop countdown/CTA/stage meter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (P1 sections):**
- Composition (signed-in/out, drop Countdown/StageTracker/CTA) → Task 7. ✅
- Games strip data/states/your-pick/✓-✗/lock line → Tasks 1-3, 5, 6. ✅
- Fixture→slot→pick mapping + top-ranked-bracket rule → Task 3 (mapping) + Task 5 (top-scoring bracket supplies picks). ✅
- Standing line + "hide until a game has scored" → Task 4 + Task 7 (`board.stage.started` gate). ✅
- Live polling (~30s, keep-last-on-error) → Task 6. ✅
- ESPN unreachable → empty strip, page unaffected → Task 5 (try/catch → `[]`) + Task 6 (`noGames`). ✅
- i18n EN+ES → Tasks 6, 7. ✅
- Pure units unit-tested; glue not → Tasks 1-4 tested; 5-7 not. ✅
- P2 items (movement, ResultEvent, "what just happened", schema) → intentionally **not** in this plan (separate plan). ✅

**Placeholder scan:** none — every code step is complete. ✅

**Type consistency:** `Game`/`GameState` (Task 1) reused in 2,5,6; `SlotParticipants`/`PickResult` (Task 3) reused in 5; `GameRow` (Task 5) reused in 6,7; `StandingEntry`/`myStanding` (Task 4) reused in 7. `getNextGames` returns `{ games, lockNote }` consistently across 5/6/7. ✅

**Note on "top-ranked" bracket:** the spec says "top-ranked official bracket (highest leaderboard rank)"; the plan implements this as the user's **highest-scoring** official bracket (Task 5), which yields the same bracket as leaderboard rank (rank is by total). Equivalent, and avoids threading the full leaderboard into the action.
