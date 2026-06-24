# WC26 Knockout — Plan 3: User Bracket Fill & Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an approved, logged-in user fill out their single NCAA-style bracket (predict the winner of all 31 games, winners advancing), and submit it — with edits server-enforced to close at the global lock time.

**Architecture:** One `Bracket` row per user storing predictions as a `picks` JSON map (`{ slot: teamCode }`). A pure `bracket-picks.ts` library handles the advancement cascade (setting a pick clears now-invalid downstream picks) and completeness, reusing Plan 2's `participantsForSlot`. A pure validator guards submissions; a `submitBracket` server action enforces auth + lock + validity. An interactive client component renders the fillable bracket; `/bracket` is the page.

**Tech Stack:** Next.js 15.5 (App Router), Prisma 6 / PostgreSQL, React 19, TypeScript, Vitest 4. Builds on Plan 1 (auth) and Plan 2 (Team/Match models, bracket-structure, lock).

## Global Constraints

- Builds on Plans 1–2. Reuse: `@/lib/db`; `@/lib/auth` (`auth`, `AppSession`); `@/lib/bracket-structure` (`TOTAL_SLOTS`, `roundForSlot`, `feedersForSlot`, `participantsForSlot`, `SlotResult`); `@/lib/lock` (`computeLockTime`, `isLocked`); `@/app/actions/bracket` (`getOfficialBracket`, `OfficialSlot`).
- Path alias `@/*` → `./src/*`. Colocated `*.test.ts`, run `npx vitest run`. Commit after each task. Never commit `.superpowers/`, `*.tsbuildinfo`, `.next/`.
- No live DB in this environment: verify with `npx prisma validate`/`generate` (dummy `DATABASE_URL` only if generate insists; never `db push`/`db seed`), `npx tsc --noEmit`, `npx vitest run`, `npx next build`.
- **One bracket per user** (`Bracket.userId` is unique).
- Predictions are stored as a `picks` JSON map: keys are slot numbers as strings ("1".."31"), values are team codes. A bracket is **complete** only when all 31 slots have a pick.
- **NCAA advancement rule:** a slot's valid contestants are (R32) the official admin-set matchup, or (later rounds) the user's own picked winners of the two feeder slots. A pick must be one of the slot's two current contestants. Changing an upstream pick clears any downstream pick that is no longer valid.
- **Lock:** the server rejects any create/edit/submit at or after the global lock time (Plan 2: earliest R32 kickoff − 1h). The client disables editing too, but the server is the source of truth.
- Auth: `/bracket` and the submit action require a logged-in session (approval is already enforced at login). Not logged in → redirect to `/login` (page) or `{ error }` (action).
- Out of scope (later plans): scoring/leaderboard (Plan 4); viewing OTHER users' brackets + themed bracket-tree UI (Plan 5). This plan shows only the current user their own bracket, with functional (unstyled) UI.

---

### Task 1: Bracket model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `Bracket { id, userId @unique, picks Json, submittedAt DateTime?, createdAt, updatedAt }`. No relation field is added to `User` (kept decoupled; `userId` is a plain unique string referencing `User.id`, consistent with how `Match` references team codes).

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Append after the `Match` model (do not alter anything existing):

```prisma
model Bracket {
  id          String    @id @default(cuid())
  userId      String    @unique
  picks       Json      @default("{}")
  submittedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

- [ ] **Step 2: Validate and generate**

Run: `npx prisma validate`
Expected: "valid".
Run: `npx prisma generate`
Expected: "Generated Prisma Client". (Dummy `DATABASE_URL` only if it insists; do NOT `db push`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Bracket model (one per user)"
```

---

### Task 2: Bracket-picks library (advancement cascade) — TDD

**Files:**
- Create: `src/lib/bracket-picks.ts`
- Create: `src/lib/bracket-picks.test.ts`

**Interfaces:**
- Consumes: `TOTAL_SLOTS`, `feedersForSlot`, `participantsForSlot`, `SlotResult` from `@/lib/bracket-structure`.
- Produces from `@/lib/bracket-picks`:
  - `type Picks = Record<number, string>` — slot → predicted winner code.
  - `type OfficialR32 = Record<number, { teamA: string | null; teamB: string | null }>` — slots 1–16 only.
  - `contestantsForSlot(slot: number, officialR32: OfficialR32, picks: Picks): { teamA: string | null; teamB: string | null }` — R32 contestants come from `officialR32`; later rounds from the user's feeder-slot picks.
  - `applyPick(officialR32: OfficialR32, picks: Picks, slot: number, winner: string): Picks` — returns a NEW picks map with `slot` set to `winner`, then clears any downstream pick that is no longer one of its slot's contestants. (Does not mutate the input.)
  - `bracketComplete(picks: Picks): boolean` — true iff every slot 1..`TOTAL_SLOTS` has a non-empty pick.

- [ ] **Step 1: Write the failing test**

`src/lib/bracket-picks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { contestantsForSlot, applyPick, bracketComplete, type OfficialR32, type Picks } from './bracket-picks';

// Minimal official R32: slot 1 = ARG vs BRA, slot 2 = ESP vs FRA. (others omitted for focused tests)
const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
};

describe('contestantsForSlot', () => {
  it('returns the official matchup for an R32 slot', () => {
    expect(contestantsForSlot(1, OFFICIAL, {})).toEqual({ teamA: 'ARG', teamB: 'BRA' });
  });
  it('returns the user feeder-pick winners for a later slot', () => {
    const picks: Picks = { 1: 'ARG', 2: 'FRA' };
    // slot 17 feeds from slots 1 and 2
    expect(contestantsForSlot(17, OFFICIAL, picks)).toEqual({ teamA: 'ARG', teamB: 'FRA' });
  });
  it('returns nulls for a later slot whose feeders are unpicked', () => {
    expect(contestantsForSlot(17, OFFICIAL, {})).toEqual({ teamA: null, teamB: null });
  });
});

describe('applyPick', () => {
  it('sets a pick without mutating the input', () => {
    const before: Picks = {};
    const after = applyPick(OFFICIAL, before, 1, 'ARG');
    expect(after).toEqual({ 1: 'ARG' });
    expect(before).toEqual({});
  });
  it('clears a downstream pick that is no longer valid after changing an upstream winner', () => {
    // User advances ARG (slot1) and FRA (slot2), then picks ARG to win slot 17.
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 1, 'ARG');
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 17, 'ARG');
    expect(picks[17]).toBe('ARG');
    // Now change slot 1 to BRA. ARG no longer reaches slot 17, so the slot-17 pick must clear.
    picks = applyPick(OFFICIAL, picks, 1, 'BRA');
    expect(picks[1]).toBe('BRA');
    expect(picks[17]).toBeUndefined();
  });
  it('keeps a downstream pick that is still valid', () => {
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 1, 'ARG');
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 17, 'FRA');
    // Change slot 1 to BRA — slot 17 pick was FRA (from slot 2), still valid.
    picks = applyPick(OFFICIAL, picks, 1, 'BRA');
    expect(picks[17]).toBe('FRA');
  });
});

describe('bracketComplete', () => {
  it('is false for an empty bracket', () => {
    expect(bracketComplete({})).toBe(false);
  });
  it('is true only when all 31 slots are picked', () => {
    const full: Picks = {};
    for (let s = 1; s <= 31; s++) full[s] = 'X';
    expect(bracketComplete(full)).toBe(true);
    delete full[31];
    expect(bracketComplete(full)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bracket-picks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/bracket-picks.ts`:
```ts
import { TOTAL_SLOTS, participantsForSlot, type SlotResult } from '@/lib/bracket-structure';

export type Picks = Record<number, string>;
export type OfficialR32 = Record<number, { teamA: string | null; teamB: string | null }>;

/** Build the SlotResult map participantsForSlot expects from the official R32 + the user's picks. */
function toSlotResults(officialR32: OfficialR32, picks: Picks): Record<number, SlotResult> {
  const map: Record<number, SlotResult> = {};
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const o = officialR32[slot];
    map[slot] = {
      teamA: o?.teamA ?? null,
      teamB: o?.teamB ?? null,
      winner: picks[slot] ?? null,
    };
  }
  return map;
}

export function contestantsForSlot(
  slot: number,
  officialR32: OfficialR32,
  picks: Picks,
): { teamA: string | null; teamB: string | null } {
  return participantsForSlot(slot, toSlotResults(officialR32, picks));
}

export function applyPick(
  officialR32: OfficialR32,
  picks: Picks,
  slot: number,
  winner: string,
): Picks {
  const next: Picks = { ...picks, [slot]: winner };
  // Sweep later slots in dependency order (slot numbers increase down the tree).
  // Clear any pick that is no longer one of its current two contestants.
  for (let s = slot + 1; s <= TOTAL_SLOTS; s++) {
    const current = next[s];
    if (current === undefined) continue;
    const { teamA, teamB } = contestantsForSlot(s, officialR32, next);
    if (current !== teamA && current !== teamB) {
      delete next[s];
    }
  }
  return next;
}

export function bracketComplete(picks: Picks): boolean {
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    if (!picks[s]) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bracket-picks.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-picks.ts src/lib/bracket-picks.test.ts
git commit -m "feat: add bracket-picks advancement cascade"
```

---

### Task 3: Submit validator — TDD

**Files:**
- Create: `src/lib/bracket-validate.ts`
- Create: `src/lib/bracket-validate.test.ts`

**Interfaces:**
- Consumes: `TOTAL_SLOTS` from `@/lib/bracket-structure`; `contestantsForSlot`, `type Picks`, `type OfficialR32` from `@/lib/bracket-picks`.
- Produces: `validateSubmission(officialR32: OfficialR32, picks: Picks): { ok: true } | { ok: false; error: string }` — requires the official R32 to be fully set (16 slots, both teams), every slot 1..31 to have a pick, and each pick to be one of that slot's two contestants (given the user's own upstream picks).

- [ ] **Step 1: Write the failing test**

`src/lib/bracket-validate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateSubmission } from './bracket-validate';
import { applyPick, contestantsForSlot, type OfficialR32, type Picks } from './bracket-picks';

// Full official R32: 16 slots, each a distinct pair. Teams T1..T32.
function fullOfficial(): OfficialR32 {
  const o: OfficialR32 = {};
  for (let s = 1; s <= 16; s++) {
    o[s] = { teamA: `T${2 * s - 1}`, teamB: `T${2 * s}` };
  }
  return o;
}

// helper to read the current teamA for a slot
function advanceA(o: OfficialR32, picks: Picks, slot: number): string {
  const c = contestantsForSlot(slot, o, picks);
  return c.teamA as string;
}

// Build a complete valid bracket by always advancing teamA of every slot.
function fullValidPicks(o: OfficialR32): Picks {
  let picks: Picks = {};
  for (let s = 1; s <= 31; s++) {
    // teamA at the moment of picking is always defined once feeders are set,
    // because we go in slot order. Use applyPick to derive the current teamA.
    picks = applyPick(o, picks, s, advanceA(o, picks, s));
  }
  return picks;
}

describe('validateSubmission', () => {
  it('accepts a complete, valid bracket', () => {
    const o = fullOfficial();
    expect(validateSubmission(o, fullValidPicks(o))).toEqual({ ok: true });
  });
  it('rejects when the official R32 is not fully set', () => {
    const o = fullOfficial();
    delete o[16];
    expect(validateSubmission(o, {}).ok).toBe(false);
  });
  it('rejects an incomplete bracket', () => {
    const o = fullOfficial();
    const picks = fullValidPicks(o);
    delete picks[31];
    expect(validateSubmission(o, picks).ok).toBe(false);
  });
  it('rejects a pick that is not one of the slot contestants', () => {
    const o = fullOfficial();
    const picks = fullValidPicks(o);
    picks[1] = 'NOPE'; // not T1/T2
    expect(validateSubmission(o, picks).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bracket-validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/bracket-validate.ts`:
```ts
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32, type Picks } from '@/lib/bracket-picks';

export function validateSubmission(
  officialR32: OfficialR32,
  picks: Picks,
): { ok: true } | { ok: false; error: string } {
  // Official R32 must be fully set: slots 1..16 with both teams.
  for (let s = 1; s <= 16; s++) {
    const o = officialR32[s];
    if (!o || !o.teamA || !o.teamB) {
      return { ok: false, error: 'The official Round-of-32 bracket is not set yet.' };
    }
  }
  // Every slot must have a pick that is one of its current contestants.
  for (let s = 1; s <= TOTAL_SLOTS; s++) {
    const pick = picks[s];
    if (!pick) return { ok: false, error: 'Your bracket is incomplete — pick every game.' };
    const { teamA, teamB } = contestantsForSlot(s, officialR32, picks);
    if (pick !== teamA && pick !== teamB) {
      return { ok: false, error: `Slot ${s} has a pick that did not reach that game.` };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bracket-validate.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-validate.ts src/lib/bracket-validate.test.ts
git commit -m "feat: add bracket submission validator"
```

---

### Task 4: Official-R32 selector helper — TDD

**Files:**
- Create: `src/lib/official-r32.ts`
- Create: `src/lib/official-r32.test.ts`

**Interfaces:**
- Consumes: `OfficialSlot` from `@/app/actions/bracket`; `type OfficialR32` from `@/lib/bracket-picks`.
- Produces: `officialR32FromSlots(slots: OfficialSlot[]): OfficialR32` — picks the R32 slots (1–16) and maps each to `{ teamA, teamB }`; and `officialR32IsSet(officialR32: OfficialR32): boolean` — true iff all 16 R32 slots have both teams. (Pure adapter between the Plan 2 reader output and the Plan 3 picks library; isolated so the server action and page share one source of truth.)

- [ ] **Step 1: Write the failing test**

`src/lib/official-r32.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { officialR32FromSlots, officialR32IsSet } from './official-r32';
import type { OfficialSlot } from '@/app/actions/bracket';

function slot(s: number, round: OfficialSlot['round'], teamA: string | null, teamB: string | null): OfficialSlot {
  return { slot: s, round, teamA, teamB, winner: null, kickoff: null };
}

describe('officialR32FromSlots', () => {
  it('keeps only R32 slots and maps to team pairs', () => {
    const slots = [slot(1, 'R32', 'ARG', 'BRA'), slot(17, 'R16', null, null)];
    const o = officialR32FromSlots(slots);
    expect(o[1]).toEqual({ teamA: 'ARG', teamB: 'BRA' });
    expect(o[17]).toBeUndefined();
  });
});

describe('officialR32IsSet', () => {
  it('is true only when all 16 R32 slots have both teams', () => {
    const o: Record<number, { teamA: string | null; teamB: string | null }> = {};
    for (let s = 1; s <= 16; s++) o[s] = { teamA: `A${s}`, teamB: `B${s}` };
    expect(officialR32IsSet(o)).toBe(true);
    o[16] = { teamA: 'A16', teamB: null };
    expect(officialR32IsSet(o)).toBe(false);
  });
  it('is false when empty', () => {
    expect(officialR32IsSet({})).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/official-r32.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/official-r32.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/official-r32.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/official-r32.ts src/lib/official-r32.test.ts
git commit -m "feat: add official-R32 selector helper"
```

---

### Task 5: Bracket-entry server actions (get + submit with lock)

**Files:**
- Create: `src/app/actions/bracket-entry.ts`

**Interfaces:**
- Consumes: `db`; `auth`/`AppSession`; `getOfficialBracket` (Plan 2); `officialR32FromSlots`/`officialR32IsSet`; `validateSubmission`; `computeLockTime`/`isLocked` (via the lock time the Plan 2 reader already returns); `type Picks`.
- Produces from `@/app/actions/bracket-entry`:
  - `type BracketView = { picks: Picks; submittedAt: string | null; lockTimeIso: string | null; locked: boolean; officialReady: boolean }`
  - `getMyBracket(): Promise<{ error?: string; view?: BracketView }>` — requires a session; returns the current user's saved picks (or empty), lock state, and whether the official R32 is set.
  - `saveBracket(picks: Picks): Promise<{ error?: string }>` — requires a session; rejects if locked; validates via `validateSubmission`; upserts the user's `Bracket` with `picks` and stamps `submittedAt`. `revalidatePath('/bracket')`.

- [ ] **Step 1: Create `src/app/actions/bracket-entry.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots, officialR32IsSet } from '@/lib/official-r32';
import { validateSubmission } from '@/lib/bracket-validate';
import { isLocked } from '@/lib/lock';
import type { Picks } from '@/lib/bracket-picks';

export type BracketView = {
  picks: Picks;
  submittedAt: string | null;
  lockTimeIso: string | null;
  locked: boolean;
  officialReady: boolean;
};

async function requireUserId(): Promise<string | null> {
  const session = (await auth()) as AppSession | null;
  return session?.user?.id ?? null;
}

/** Coerce a stored JSON picks blob into a numeric-keyed Picks map. */
function coercePicks(raw: unknown): Picks {
  const out: Picks = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const slot = Number(k);
      if (Number.isInteger(slot) && typeof v === 'string') out[slot] = v;
    }
  }
  return out;
}

export async function getMyBracket(): Promise<{ error?: string; view?: BracketView }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };

  const official = await getOfficialBracket();
  const officialReady = officialR32IsSet(officialR32FromSlots(official.slots));
  const locked = isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null);

  const row = await db.bracket.findUnique({ where: { userId } });

  return {
    view: {
      picks: coercePicks(row?.picks),
      submittedAt: row?.submittedAt ? row.submittedAt.toISOString() : null,
      lockTimeIso: official.lockTimeIso,
      locked,
      officialReady,
    },
  };
}

export async function saveBracket(picks: Picks): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };

  const official = await getOfficialBracket();
  const locked = isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null);
  if (locked) return { error: 'Brackets are locked — no more edits.' };

  const officialR32 = officialR32FromSlots(official.slots);
  const check = validateSubmission(officialR32, picks);
  if (!check.ok) return { error: check.error };

  await db.bracket.upsert({
    where: { userId },
    update: { picks, submittedAt: new Date() },
    create: { userId, picks, submittedAt: new Date() },
  });
  revalidatePath('/bracket');
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
git add src/app/actions/bracket-entry.ts
git commit -m "feat: add bracket-entry actions (get + save with lock)"
```

---

### Task 6: Interactive bracket-fill client component

**Files:**
- Create: `src/app/bracket/BracketFill.tsx`

**Interfaces:**
- Consumes: `applyPick`, `bracketComplete`, `contestantsForSlot`, `type Picks`, `type OfficialR32` from `@/lib/bracket-picks`; `roundForSlot`, `slotsForRound` from `@/lib/bracket-structure`; `saveBracket` from `@/app/actions/bracket-entry`.
- Produces: default-export client component `BracketFill` taking `{ officialR32: OfficialR32; initialPicks: Picks; locked: boolean }`. Renders each round's games; clicking a contestant sets the pick (cascading downstream clears); a Save button posts via `saveBracket`. Disabled entirely when `locked`.

- [ ] **Step 1: Create `src/app/bracket/BracketFill.tsx`**

```tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyPick, bracketComplete, contestantsForSlot, type Picks, type OfficialR32 } from '@/lib/bracket-picks';
import { slotsForRound } from '@/lib/bracket-structure';
import type { Round } from '@prisma/client';
import { saveBracket } from '@/app/actions/bracket-entry';

const ROUNDS: { round: Round; label: string }[] = [
  { round: 'R32', label: 'Round of 32' },
  { round: 'R16', label: 'Round of 16' },
  { round: 'QF', label: 'Quarterfinals' },
  { round: 'SF', label: 'Semifinals' },
  { round: 'FINAL', label: 'Final' },
];

export default function BracketFill({
  officialR32,
  initialPicks,
  locked,
}: {
  officialR32: OfficialR32;
  initialPicks: Picks;
  locked: boolean;
}) {
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const complete = useMemo(() => bracketComplete(picks), [picks]);

  function pick(slot: number, team: string | null) {
    if (locked || !team) return;
    setOk(false);
    setError(null);
    setPicks((prev) => applyPick(officialR32, prev, slot, team));
  }

  function save() {
    setError(null);
    setOk(false);
    start(async () => {
      const res = await saveBracket(picks);
      if (res?.error) setError(res.error);
      else setOk(true);
    });
  }

  function teamButton(slot: number, team: string | null) {
    const selected = team !== null && picks[slot] === team;
    return (
      <button
        type="button"
        disabled={locked || !team}
        onClick={() => pick(slot, team)}
        style={{
          minWidth: 90,
          padding: '4px 8px',
          fontWeight: selected ? 700 : 400,
          background: selected ? 'var(--accent)' : 'transparent',
          color: selected ? '#06210f' : 'var(--line)',
          border: '1px solid #ffffff33',
          borderRadius: 6,
        }}
      >
        {team ?? '—'}
      </button>
    );
  }

  return (
    <div>
      {ROUNDS.map(({ round, label }) => (
        <section key={round} style={{ marginBottom: 16 }}>
          <h3>{label}</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {slotsForRound(round).map((slot) => {
              const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
              return (
                <div key={slot} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ opacity: 0.6, width: 28 }}>#{slot}</span>
                  {teamButton(slot, teamA)}
                  <span style={{ opacity: 0.5 }}>vs</span>
                  {teamButton(slot, teamB)}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {error && <p style={{ color: '#ff8080' }}>{error}</p>}
      {ok && <p style={{ color: 'var(--accent)' }}>Bracket saved.</p>}
      {!locked && (
        <button type="button" disabled={pending || !complete} onClick={save}>
          {pending ? 'Saving…' : complete ? 'Save bracket' : 'Pick every game to save'}
        </button>
      )}
      {locked && <p><strong>Brackets are locked.</strong></p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/bracket/BracketFill.tsx
git commit -m "feat: add interactive bracket-fill component"
```

---

### Task 7: `/bracket` page + nav link

**Files:**
- Create: `src/app/bracket/page.tsx`
- Modify: `src/app/Nav.tsx`

**Interfaces:**
- Consumes: `auth`/`AppSession`; `getMyBracket`; `getOfficialBracket`; `officialR32FromSlots`; `BracketFill`.
- Produces: `/bracket` route (login-guarded). Loads the official R32 + the user's picks + lock state, and renders `BracketFill` (or a "not open yet" / "locked" message). Adds a `/bracket` link to the nav for logged-in users.

- [ ] **Step 1: Create `src/app/bracket/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { getMyBracket } from '@/app/actions/bracket-entry';
import { officialR32FromSlots } from '@/lib/official-r32';
import BracketFill from './BracketFill';

export const dynamic = 'force-dynamic';

export default async function BracketPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const [official, mine] = await Promise.all([getOfficialBracket(), getMyBracket()]);
  const view = mine.view;

  if (!view || !view.officialReady) {
    return (
      <main style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
        <h1>Your bracket</h1>
        <p>The bracket isn’t open yet — the Round-of-32 matchups haven’t been set. Check back soon.</p>
      </main>
    );
  }

  const officialR32 = officialR32FromSlots(official.slots);

  return (
    <main style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
      <h1>Your bracket</h1>
      {view.submittedAt && !view.locked && <p style={{ opacity: 0.7 }}>Saved — you can keep editing until lock.</p>}
      <BracketFill officialR32={officialR32} initialPicks={view.picks} locked={view.locked} />
    </main>
  );
}
```

- [ ] **Step 2: Add a `/bracket` link to `src/app/Nav.tsx`**

In `src/app/Nav.tsx`, inside the logged-in branch (`session?.user ? (...)`), add a bracket link before the Admin link. Change:

```tsx
        <>
          {session.user.isAdmin && <Link href="/admin">Admin</Link>}
          <form action={logout}>
            <button type="submit">Log out</button>
          </form>
        </>
```

to:

```tsx
        <>
          <Link href="/bracket">My bracket</Link>
          {session.user.isAdmin && <Link href="/admin">Admin</Link>}
          <form action={logout}>
            <button type="submit">Log out</button>
          </form>
        </>
```

- [ ] **Step 3: Typecheck, full suite, build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.
Run: `npx next build`
Expected: compiles; `/bracket` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/bracket/page.tsx src/app/Nav.tsx
git commit -m "feat: add /bracket page and nav link"
```

---

## Self-Review

**Spec coverage (Plan 3 scope):**
- `Bracket`/prediction storage (one per user) → Task 1 (`Bracket` model, `userId @unique`, `picks` JSON). ✓
- NCAA-style fill with advancement (winners advance; invalid downstream picks cleared) → Task 2 (`applyPick` cascade), Task 6 (UI). ✓
- One bracket per user → Task 1 (`@unique`) + Task 5 (`upsert` by `userId`). ✓
- Submit + server-enforced lock → Task 5 (`saveBracket` checks `isLocked` before validating/writing). ✓
- Submission validity (no tampering) → Task 3 (`validateSubmission`) used by Task 5. ✓
- `/bracket` page, login-guarded, read-only after lock → Task 7 (redirect if no session; `BracketFill` disabled when `locked`). ✓
- "Not open yet" when admin hasn't set R32 → Task 4 (`officialR32IsSet`) + Task 7. ✓

**Intentionally deferred (not Plan 3):** scoring + leaderboard (Plan 4); viewing OTHER users' brackets + themed bracket-tree UI (Plan 5). This plan renders only the current user's own bracket with functional, unstyled UI.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The Task 3 test builds its fixtures via the real `applyPick`/`contestantsForSlot` (not a placeholder — it exercises the actual advancement logic to construct a valid full bracket).

**Type consistency:** `Picks` (`Record<number,string>`) and `OfficialR32` are defined once in `bracket-picks.ts` and reused by `bracket-validate.ts`, `official-r32.ts`, `bracket-entry.ts`, and `BracketFill.tsx`. `contestantsForSlot(slot, officialR32, picks)` signature is identical across all callers. `OfficialSlot` is imported from `@/app/actions/bracket` (Plan 2). `saveBracket(picks: Picks)` matches its call in `BracketFill`. `getMyBracket()`'s `BracketView` shape matches the page's usage (`view.picks`, `view.locked`, `view.officialReady`, `view.submittedAt`).

---

## Subsequent Plans (roadmap)

- **Plan 4 — Results feed, scoring & leaderboard:** ported wc26 results-source (self-healing) → `Match.actualWinner` (+ admin override); pure round-weighted scoring (perfect = 80, reusing `ROUND_POINTS` and each user's `picks` vs the official winners); leaderboard with shared ranks + pot.
- **Plan 5 — Post-lock visibility, browse others & themed UI:** post-lock visibility gate; `/brackets` + `/brackets/[user]` (only after lock); `frontend-design`-driven WC26 football theme with a real connected bracket-tree layout (replacing the functional list UIs from Plans 2–3).
