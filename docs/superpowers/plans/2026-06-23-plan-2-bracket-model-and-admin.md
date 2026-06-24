# WC26 Knockout — Plan 2: Bracket Model & Official-Bracket Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Model the 32-team knockout bracket (teams + the 31-game official bracket), let an admin enter the Round-of-32 skeleton + kickoffs, and compute the global lock time with a PST countdown.

**Architecture:** A natural-key Prisma schema (`Team.code`, `Match.slot 1–31`) plus pure, unit-tested structural libraries: `bracket-structure.ts` derives each slot's round, feeder children, and contestants arithmetically (no feeder columns in the DB), and `lock.ts` computes the lock time = (earliest R32 kickoff − 1h). Admin sets the R32 skeleton via a guarded server action; a client countdown renders the lock time in Pacific time.

**Tech Stack:** Next.js 15.5 (App Router), Prisma 6 / PostgreSQL, TypeScript, Vitest 4. Builds on Plan 1 (auth, `@/lib/db`, admin guard).

## Global Constraints

- Builds on Plan 1; reuse its patterns: `@/lib/db` Prisma singleton, `requireAdmin()` from `@/app/actions/admin`, path alias `@/*` → `./src/*`, colocated `*.test.ts` run with `npx vitest run`, no `*.tsbuildinfo` / `.next/` / `.superpowers/` committed.
- The DB has no live connection in this environment (DB smoke test is deferred): verify with `npx prisma validate`, `npx prisma generate` (set a dummy `DATABASE_URL` if it insists — generate does not contact the DB), `npx tsc --noEmit`, `npx vitest run`, and `npx next build`. Do NOT run `prisma db push` or `prisma db seed`.
- Bracket geometry is FIXED: 31 games — R32 = slots 1–16, R16 = 17–24, QF = 25–28, SF = 29–30, FINAL = 31.
- Round points (used by Plan 4 scoring; defined here as structural truth): R32 = 1, R16 = 2, QF = 4, SF = 8, FINAL = 16. A perfect bracket = 80.
- Lock time = (earliest R32 kickoff) − 1 hour, displayed in `America/Los_Angeles` (Pacific). Server is the source of truth for lock state.
- No 3rd-place match. `Bracket`/`BracketPick` (user predictions) are intentionally OUT of scope here — they arrive in Plan 3.
- Commit after each task.

---

### Task 1: Schema — Round enum, Team and Match models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma enum `Round { R32 R16 QF SF FINAL }`; model `Team { code @id, name, color }`; model `Match { slot @id (Int 1–31), round, teamA?, teamB?, actualWinner?, kickoff?, feedRef?, updatedAt }`. Team codes are stored as plain strings on `Match` (validated at the app layer, no FK relation — mirrors wc26's loose-code approach).

- [ ] **Step 1: Add the enum and models to `prisma/schema.prisma`**

Append these to the existing schema (after the `PasswordResetToken` model; do NOT remove anything already there):

```prisma
enum Round {
  R32
  R16
  QF
  SF
  FINAL
}

model Team {
  code  String @id // FIFA code, e.g. "ARG"
  name  String
  color String     // hex, e.g. "#6cace4"
}

model Match {
  slot         Int       @id // fixed bracket position, 1..31
  round        Round
  teamA        String?       // team code; set for R32, derived for later rounds
  teamB        String?       // team code; set for R32, derived for later rounds
  actualWinner String?       // team code; null until decided
  kickoff      DateTime?
  feedRef      String?       // external results-feed id (used in Plan 4)
  updatedAt    DateTime  @updatedAt
}
```

- [ ] **Step 2: Validate and generate**

Run: `npx prisma validate`
Expected: "The schema at prisma\schema.prisma is valid."
Run: `npx prisma generate`
Expected: "Generated Prisma Client". (If it errors on a missing `DATABASE_URL`, set a dummy one for the command only — generation reads the schema, not the DB.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the generated client now exports `Round`, `Team`, `Match` types).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Team and Match (bracket) models"
```

---

### Task 2: Team data + seed script

**Files:**
- Create: `src/lib/teams.ts`
- Create: `src/lib/teams.test.ts`
- Create: `prisma/seed.ts`

**Interfaces:**
- Produces: `interface TeamData { code: string; name: string; color: string }` and `export const TEAMS: TeamData[]` (the 48 WC2026 teams) from `@/lib/teams`. `prisma/seed.ts` upserts every `TEAMS` entry into the `Team` table.

- [ ] **Step 1: Create `src/lib/teams.ts` by merging the two wc26 source files**

Port the team list from `C:\Users\Oswaldo\wc26\lib\teams.ts` (each entry's `code` + `name`) joined with its color from `C:\Users\Oswaldo\wc26\lib\team-colors.ts` (the `TEAM_COLORS` map, keyed by code). Read BOTH of those exact files, then produce one merged array. Drop the `aliases` field (not needed here). The result must have exactly 48 entries, one per code, each with a non-empty `name` and a hex `color` (every code in the wc26 teams list has a corresponding key in `TEAM_COLORS`).

The file shape:

```ts
// The 48 WC2026 teams: FIFA code, display name, and a representative color.
// Ported from wc26's lib/teams.ts (code+name) and lib/team-colors.ts (color).
export interface TeamData {
  code: string;
  name: string;
  color: string;
}

export const TEAMS: TeamData[] = [
  { code: 'ALG', name: 'Algeria', color: '#1Fa85c' },
  { code: 'ARG', name: 'Argentina', color: '#6cace4' },
  // ... all 48, in the same order as wc26's lib/teams.ts ...
];
```

Fill in all 48 rows from the two source files. Do not invent teams or colors — copy them.

- [ ] **Step 2: Write the integrity test**

`src/lib/teams.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { TEAMS } from './teams';

describe('TEAMS', () => {
  it('has exactly 48 teams', () => {
    expect(TEAMS).toHaveLength(48);
  });

  it('has unique codes', () => {
    const codes = TEAMS.map((t) => t.code);
    expect(new Set(codes).size).toBe(48);
  });

  it('every team has a name and a hex color', () => {
    for (const t of TEAMS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('uses 3-letter uppercase FIFA codes', () => {
    for (const t of TEAMS) {
      expect(t.code).toMatch(/^[A-Z]{3}$/);
    }
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/lib/teams.test.ts`
Expected: PASS (4 passed). If the color regex fails, check the ported hex values — every color must be `#` + 6 hex digits. (Note: the wc26 source has some colors written with mixed case like `#1Fa85c`; that is valid hex and the regex allows it.)

- [ ] **Step 4: Create `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { TEAMS } from '../src/lib/teams';

const db = new PrismaClient();

async function main() {
  for (const t of TEAMS) {
    await db.team.upsert({
      where: { code: t.code },
      update: { name: t.name, color: t.color },
      create: { code: t.code, name: t.name, color: t.color },
    });
  }
  console.log(`Seeded ${TEAMS.length} teams.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
```

(The seed RUNS later when the DB is provisioned, via `npm run db:seed`. Do not run it now.)

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.
```bash
git add src/lib/teams.ts src/lib/teams.test.ts prisma/seed.ts
git commit -m "feat: add 48-team data and seed script"
```

---

### Task 3: Bracket-structure library (slots, rounds, feeders, points) — TDD

**Files:**
- Create: `src/lib/bracket-structure.ts`
- Create: `src/lib/bracket-structure.test.ts`

**Interfaces:**
- Produces from `@/lib/bracket-structure`:
  - `TOTAL_SLOTS = 31`
  - `roundForSlot(slot: number): Round` — throws `RangeError` outside 1–31.
  - `slotsForRound(round: Round): number[]`
  - `feedersForSlot(slot: number): [number, number] | null` — `null` for R32 slots (1–16); the two child slots otherwise.
  - `ROUND_POINTS: Record<Round, number>` = R32:1, R16:2, QF:4, SF:8, FINAL:16.
  - `type SlotResult = { teamA: string | null; teamB: string | null; winner: string | null }`
  - `participantsForSlot(slot: number, matches: Record<number, SlotResult>): { teamA: string | null; teamB: string | null }` — for R32 returns the stored teams; for later rounds returns the winners of the two feeder slots (either may be `null` if undecided).
  - Imports `Round` as a type from `@prisma/client`.

- [ ] **Step 1: Write the failing test**

`src/lib/bracket-structure.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  TOTAL_SLOTS,
  roundForSlot,
  slotsForRound,
  feedersForSlot,
  ROUND_POINTS,
  participantsForSlot,
} from './bracket-structure';

describe('roundForSlot', () => {
  it('maps slot ranges to rounds', () => {
    expect(roundForSlot(1)).toBe('R32');
    expect(roundForSlot(16)).toBe('R32');
    expect(roundForSlot(17)).toBe('R16');
    expect(roundForSlot(24)).toBe('R16');
    expect(roundForSlot(25)).toBe('QF');
    expect(roundForSlot(28)).toBe('QF');
    expect(roundForSlot(29)).toBe('SF');
    expect(roundForSlot(30)).toBe('SF');
    expect(roundForSlot(31)).toBe('FINAL');
  });
  it('throws outside 1..31', () => {
    expect(() => roundForSlot(0)).toThrow(RangeError);
    expect(() => roundForSlot(32)).toThrow(RangeError);
  });
});

describe('slotsForRound', () => {
  it('returns the slots of each round', () => {
    expect(slotsForRound('R32')).toHaveLength(16);
    expect(slotsForRound('R32')[0]).toBe(1);
    expect(slotsForRound('R16')).toEqual([17, 18, 19, 20, 21, 22, 23, 24]);
    expect(slotsForRound('QF')).toEqual([25, 26, 27, 28]);
    expect(slotsForRound('SF')).toEqual([29, 30]);
    expect(slotsForRound('FINAL')).toEqual([31]);
  });
});

describe('feedersForSlot', () => {
  it('returns null for R32', () => {
    expect(feedersForSlot(1)).toBeNull();
    expect(feedersForSlot(16)).toBeNull();
  });
  it('wires R16 from R32 pairs', () => {
    expect(feedersForSlot(17)).toEqual([1, 2]);
    expect(feedersForSlot(24)).toEqual([15, 16]);
  });
  it('wires QF, SF, FINAL', () => {
    expect(feedersForSlot(25)).toEqual([17, 18]);
    expect(feedersForSlot(28)).toEqual([23, 24]);
    expect(feedersForSlot(29)).toEqual([25, 26]);
    expect(feedersForSlot(30)).toEqual([27, 28]);
    expect(feedersForSlot(31)).toEqual([29, 30]);
  });
});

describe('ROUND_POINTS', () => {
  it('is round-weighted, perfect bracket = 80', () => {
    expect(ROUND_POINTS).toEqual({ R32: 1, R16: 2, QF: 4, SF: 8, FINAL: 16 });
    const perfect =
      16 * ROUND_POINTS.R32 +
      8 * ROUND_POINTS.R16 +
      4 * ROUND_POINTS.QF +
      2 * ROUND_POINTS.SF +
      1 * ROUND_POINTS.FINAL;
    expect(perfect).toBe(80);
  });
});

describe('participantsForSlot', () => {
  it('returns stored teams for R32', () => {
    const matches = { 1: { teamA: 'ARG', teamB: 'BRA', winner: null } };
    expect(participantsForSlot(1, matches)).toEqual({ teamA: 'ARG', teamB: 'BRA' });
  });
  it('derives R16 participants from feeder winners', () => {
    const matches = {
      1: { teamA: 'ARG', teamB: 'BRA', winner: 'ARG' },
      2: { teamA: 'ESP', teamB: 'FRA', winner: 'FRA' },
    };
    expect(participantsForSlot(17, matches)).toEqual({ teamA: 'ARG', teamB: 'FRA' });
  });
  it('returns nulls when feeders are undecided', () => {
    const matches = {
      1: { teamA: 'ARG', teamB: 'BRA', winner: null },
      2: { teamA: 'ESP', teamB: 'FRA', winner: 'FRA' },
    };
    expect(participantsForSlot(17, matches)).toEqual({ teamA: null, teamB: 'FRA' });
  });
  it('returns nulls when a feeder slot is missing', () => {
    expect(participantsForSlot(31, {})).toEqual({ teamA: null, teamB: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bracket-structure.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/bracket-structure.ts`:
```ts
import type { Round } from '@prisma/client';

export const TOTAL_SLOTS = 31;

// Fixed bracket geometry: [round, firstSlot, lastSlot, prevRoundFirstSlot].
// prevRoundFirstSlot is the first slot of the feeding round (unused for R32).
const LAYERS: { round: Round; first: number; last: number; prevFirst: number }[] = [
  { round: 'R32', first: 1, last: 16, prevFirst: 0 },
  { round: 'R16', first: 17, last: 24, prevFirst: 1 },
  { round: 'QF', first: 25, last: 28, prevFirst: 17 },
  { round: 'SF', first: 29, last: 30, prevFirst: 25 },
  { round: 'FINAL', first: 31, last: 31, prevFirst: 29 },
];

function layerForSlot(slot: number) {
  const layer = LAYERS.find((l) => slot >= l.first && slot <= l.last);
  if (!layer) throw new RangeError(`slot out of range: ${slot}`);
  return layer;
}

export function roundForSlot(slot: number): Round {
  return layerForSlot(slot).round;
}

export function slotsForRound(round: Round): number[] {
  const layer = LAYERS.find((l) => l.round === round)!;
  const slots: number[] = [];
  for (let s = layer.first; s <= layer.last; s++) slots.push(s);
  return slots;
}

export function feedersForSlot(slot: number): [number, number] | null {
  const layer = layerForSlot(slot);
  if (layer.round === 'R32') return null;
  const localIndex = slot - layer.first; // 0-based within the layer
  const a = layer.prevFirst + 2 * localIndex;
  return [a, a + 1];
}

export const ROUND_POINTS: Record<Round, number> = {
  R32: 1,
  R16: 2,
  QF: 4,
  SF: 8,
  FINAL: 16,
};

export type SlotResult = { teamA: string | null; teamB: string | null; winner: string | null };

export function participantsForSlot(
  slot: number,
  matches: Record<number, SlotResult>,
): { teamA: string | null; teamB: string | null } {
  const feeders = feedersForSlot(slot);
  if (feeders === null) {
    const m = matches[slot];
    return { teamA: m?.teamA ?? null, teamB: m?.teamB ?? null };
  }
  const [a, b] = feeders;
  return { teamA: matches[a]?.winner ?? null, teamB: matches[b]?.winner ?? null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bracket-structure.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-structure.ts src/lib/bracket-structure.test.ts
git commit -m "feat: add bracket-structure (slots, feeders, points)"
```

---

### Task 4: Lock-time library — TDD

**Files:**
- Create: `src/lib/lock.ts`
- Create: `src/lib/lock.test.ts`

**Interfaces:**
- Produces from `@/lib/lock`:
  - `LOCK_LEAD_MS = 3600_000` (1 hour).
  - `computeLockTime(r32Kickoffs: (Date | null)[]): Date | null` — earliest non-null kickoff minus 1h; `null` if there are no kickoffs.
  - `isLocked(now: Date, lockTime: Date | null): boolean` — `true` iff `lockTime` is set and `now >= lockTime`.
  - `formatLockTimePT(lockTime: Date): string` — formats the instant in `America/Los_Angeles` with a short time-zone name (e.g. contains "9:00" and "PDT").

- [ ] **Step 1: Write the failing test**

`src/lib/lock.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { LOCK_LEAD_MS, computeLockTime, isLocked, formatLockTimePT } from './lock';

describe('computeLockTime', () => {
  it('returns earliest kickoff minus one hour', () => {
    const a = new Date('2026-07-01T18:00:00Z');
    const b = new Date('2026-07-01T16:00:00Z'); // earliest
    const c = new Date('2026-07-02T16:00:00Z');
    const lock = computeLockTime([a, b, c]);
    expect(lock?.toISOString()).toBe('2026-07-01T15:00:00.000Z');
  });
  it('ignores null kickoffs', () => {
    const b = new Date('2026-07-01T16:00:00Z');
    expect(computeLockTime([null, b, null])?.toISOString()).toBe('2026-07-01T15:00:00.000Z');
  });
  it('returns null when there are no kickoffs', () => {
    expect(computeLockTime([])).toBeNull();
    expect(computeLockTime([null, null])).toBeNull();
  });
});

describe('isLocked', () => {
  const lock = new Date('2026-07-01T15:00:00Z');
  it('is false before lock', () => {
    expect(isLocked(new Date('2026-07-01T14:59:59Z'), lock)).toBe(false);
  });
  it('is true at/after lock', () => {
    expect(isLocked(new Date('2026-07-01T15:00:00Z'), lock)).toBe(true);
    expect(isLocked(new Date('2026-07-01T15:00:01Z'), lock)).toBe(true);
  });
  it('is false when lockTime is null', () => {
    expect(isLocked(new Date(), null)).toBe(false);
  });
});

describe('LOCK_LEAD_MS', () => {
  it('is one hour', () => {
    expect(LOCK_LEAD_MS).toBe(3600_000);
  });
});

describe('formatLockTimePT', () => {
  it('formats in Pacific time with a zone label', () => {
    // 2026-07-01T16:00:00Z is 09:00 PDT (UTC-7 in July).
    const s = formatLockTimePT(new Date('2026-07-01T16:00:00Z'));
    expect(s).toContain('9:00');
    expect(s).toMatch(/P[DS]T/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/lock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/lock.ts`:
```ts
export const LOCK_LEAD_MS = 3600_000; // 1 hour

/** Earliest non-null R32 kickoff minus one hour; null if there are no kickoffs. */
export function computeLockTime(r32Kickoffs: (Date | null)[]): Date | null {
  const times = r32Kickoffs.filter((d): d is Date => d !== null).map((d) => d.getTime());
  if (times.length === 0) return null;
  return new Date(Math.min(...times) - LOCK_LEAD_MS);
}

export function isLocked(now: Date, lockTime: Date | null): boolean {
  return lockTime !== null && now.getTime() >= lockTime.getTime();
}

/** Format an instant in Pacific time, e.g. "Jul 1, 2026, 9:00 AM PDT". */
export function formatLockTimePT(lockTime: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(lockTime);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/lock.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lock.ts src/lib/lock.test.ts
git commit -m "feat: add lock-time computation and PT formatting"
```

---

### Task 5: Countdown component + remaining-time formatter — TDD

**Files:**
- Create: `src/lib/format-remaining.ts`
- Create: `src/lib/format-remaining.test.ts`
- Create: `src/app/_components/Countdown.tsx`

**Interfaces:**
- Produces: `formatRemaining(ms: number): string` from `@/lib/format-remaining` — `"2d 3h 4m 5s"`, clamping negatives to `"0d 0h 0m 0s"`, omitting nothing (always all four units for stable width). And a client component `Countdown` (default export) from `@/app/_components/Countdown` taking `{ lockTimeIso: string | null; lockLabel: string | null }`, ticking each second.

- [ ] **Step 1: Write the failing test**

`src/lib/format-remaining.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatRemaining } from './format-remaining';

describe('formatRemaining', () => {
  it('breaks ms into d/h/m/s', () => {
    const ms = (((2 * 24 + 3) * 60 + 4) * 60 + 5) * 1000; // 2d 3h 4m 5s
    expect(formatRemaining(ms)).toBe('2d 3h 4m 5s');
  });
  it('clamps negatives to zero', () => {
    expect(formatRemaining(-5000)).toBe('0d 0h 0m 0s');
  });
  it('handles exact zero', () => {
    expect(formatRemaining(0)).toBe('0d 0h 0m 0s');
  });
  it('formats sub-minute correctly', () => {
    expect(formatRemaining(45 * 1000)).toBe('0d 0h 0m 45s');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format-remaining.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the formatter**

`src/lib/format-remaining.ts`:
```ts
/** Format a millisecond duration as "Dd Hh Mm Ss", clamped at zero. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format-remaining.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Write the `Countdown` client component**

`src/app/_components/Countdown.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { formatRemaining } from '@/lib/format-remaining';

export default function Countdown({
  lockTimeIso,
  lockLabel,
}: {
  lockTimeIso: string | null;
  lockLabel: string | null;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!lockTimeIso) {
    return <p>Brackets are not open yet.</p>;
  }

  const lockMs = new Date(lockTimeIso).getTime();
  const remaining = lockMs - now;

  if (remaining <= 0) {
    return <p><strong>Brackets are locked.</strong></p>;
  }

  return (
    <p>
      Brackets lock in <strong>{formatRemaining(remaining)}</strong>
      {lockLabel ? <> — {lockLabel}</> : null}
    </p>
  );
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.
```bash
git add src/lib/format-remaining.ts src/lib/format-remaining.test.ts src/app/_components/Countdown.tsx
git commit -m "feat: add countdown component and remaining-time formatter"
```

---

### Task 6: R32-skeleton validator (TDD) + official-bracket server actions

**Files:**
- Create: `src/lib/r32-skeleton.ts`
- Create: `src/lib/r32-skeleton.test.ts`
- Create: `src/app/actions/bracket.ts`

**Interfaces:**
- Produces from `@/lib/r32-skeleton`:
  - `type R32Entry = { slot: number; teamA: string; teamB: string; kickoff: string | null }`
  - `validateR32Skeleton(entries: R32Entry[], knownCodes: Set<string>): { ok: true } | { ok: false; error: string }` — requires exactly 16 entries covering slots 1–16 once each, both teams known and distinct, kickoff (if present) a valid ISO datetime.
- Produces from `@/app/actions/bracket`:
  - `setR32Skeleton(entries: R32Entry[]): Promise<{ error?: string }>` — admin-guarded; validates, then upserts Match slots 1–16 (round R32, teams, kickoff) and ensures slots 17–31 exist with their correct round and null teams; `revalidatePath('/admin/bracket')` and `revalidatePath('/')`.
  - `type OfficialSlot = { slot: number; round: Round; teamA: string | null; teamB: string | null; winner: string | null; kickoff: string | null }`
  - `getOfficialBracket(): Promise<{ slots: OfficialSlot[]; lockTimeIso: string | null }>` — reads all Match rows, derives later-round participants via `participantsForSlot`, computes lock time from R32 kickoffs.

- [ ] **Step 1: Write the failing validator test**

`src/lib/r32-skeleton.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateR32Skeleton, type R32Entry } from './r32-skeleton';

const KNOWN = new Set(['ARG', 'BRA', 'ESP', 'FRA']);

function entry(slot: number, teamA = 'ARG', teamB = 'BRA'): R32Entry {
  return { slot, teamA, teamB, kickoff: null };
}

function fullValid(): R32Entry[] {
  return Array.from({ length: 16 }, (_, i) => entry(i + 1));
}

describe('validateR32Skeleton', () => {
  it('accepts 16 valid entries', () => {
    expect(validateR32Skeleton(fullValid(), KNOWN)).toEqual({ ok: true });
  });
  it('rejects the wrong number of entries', () => {
    expect(validateR32Skeleton(fullValid().slice(0, 15), KNOWN).ok).toBe(false);
  });
  it('rejects a slot outside 1..16', () => {
    const e = fullValid();
    e[0] = entry(17);
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('rejects duplicate slots', () => {
    const e = fullValid();
    e[1] = entry(1);
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('rejects an unknown team code', () => {
    const e = fullValid();
    e[0] = entry(1, 'ZZZ', 'BRA');
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('rejects a team playing itself', () => {
    const e = fullValid();
    e[0] = entry(1, 'ARG', 'ARG');
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('rejects an invalid kickoff', () => {
    const e = fullValid();
    e[0] = { slot: 1, teamA: 'ARG', teamB: 'BRA', kickoff: 'not-a-date' };
    expect(validateR32Skeleton(e, KNOWN).ok).toBe(false);
  });
  it('accepts a valid ISO kickoff', () => {
    const e = fullValid();
    e[0] = { slot: 1, teamA: 'ARG', teamB: 'BRA', kickoff: '2026-07-01T16:00:00.000Z' };
    expect(validateR32Skeleton(e, KNOWN)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/r32-skeleton.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the validator**

`src/lib/r32-skeleton.ts`:
```ts
export type R32Entry = { slot: number; teamA: string; teamB: string; kickoff: string | null };

export function validateR32Skeleton(
  entries: R32Entry[],
  knownCodes: Set<string>,
): { ok: true } | { ok: false; error: string } {
  if (entries.length !== 16) {
    return { ok: false, error: 'Exactly 16 Round-of-32 matchups are required.' };
  }
  const seen = new Set<number>();
  for (const e of entries) {
    if (!Number.isInteger(e.slot) || e.slot < 1 || e.slot > 16) {
      return { ok: false, error: `Slot ${e.slot} is not a valid Round-of-32 slot (1–16).` };
    }
    if (seen.has(e.slot)) {
      return { ok: false, error: `Slot ${e.slot} is listed more than once.` };
    }
    seen.add(e.slot);
    if (!knownCodes.has(e.teamA) || !knownCodes.has(e.teamB)) {
      return { ok: false, error: `Slot ${e.slot} has an unknown team code.` };
    }
    if (e.teamA === e.teamB) {
      return { ok: false, error: `Slot ${e.slot} has the same team on both sides.` };
    }
    if (e.kickoff !== null && Number.isNaN(Date.parse(e.kickoff))) {
      return { ok: false, error: `Slot ${e.slot} has an invalid kickoff time.` };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/r32-skeleton.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Write the server actions**

`src/app/actions/bracket.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import type { Round } from '@prisma/client';
import { db } from '@/lib/db';
import { requireAdmin } from '@/app/actions/admin';
import { TEAMS } from '@/lib/teams';
import { validateR32Skeleton, type R32Entry } from '@/lib/r32-skeleton';
import {
  TOTAL_SLOTS,
  roundForSlot,
  participantsForSlot,
  type SlotResult,
} from '@/lib/bracket-structure';
import { computeLockTime } from '@/lib/lock';

export type { R32Entry };

export async function setR32Skeleton(entries: R32Entry[]): Promise<{ error?: string }> {
  await requireAdmin();
  const known = new Set(TEAMS.map((t) => t.code));
  const check = validateR32Skeleton(entries, known);
  if (!check.ok) return { error: check.error };

  // Upsert the 16 R32 matchups.
  for (const e of entries) {
    await db.match.upsert({
      where: { slot: e.slot },
      update: {
        round: 'R32',
        teamA: e.teamA,
        teamB: e.teamB,
        kickoff: e.kickoff ? new Date(e.kickoff) : null,
      },
      create: {
        slot: e.slot,
        round: 'R32',
        teamA: e.teamA,
        teamB: e.teamB,
        kickoff: e.kickoff ? new Date(e.kickoff) : null,
      },
    });
  }

  // Ensure the later-round slots (17..31) exist with the right round.
  for (let slot = 17; slot <= TOTAL_SLOTS; slot++) {
    const round = roundForSlot(slot);
    await db.match.upsert({
      where: { slot },
      update: { round },
      create: { slot, round },
    });
  }

  revalidatePath('/admin/bracket');
  revalidatePath('/');
  return {};
}

export type OfficialSlot = {
  slot: number;
  round: Round;
  teamA: string | null;
  teamB: string | null;
  winner: string | null;
  kickoff: string | null;
};

export async function getOfficialBracket(): Promise<{
  slots: OfficialSlot[];
  lockTimeIso: string | null;
}> {
  const rows = await db.match.findMany({ orderBy: { slot: 'asc' } });

  const bySlot: Record<number, SlotResult> = {};
  for (const r of rows) {
    bySlot[r.slot] = { teamA: r.teamA, teamB: r.teamB, winner: r.actualWinner };
  }

  const slots: OfficialSlot[] = [];
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const row = rows.find((r) => r.slot === slot);
    if (!row) continue;
    const { teamA, teamB } = participantsForSlot(slot, bySlot);
    slots.push({
      slot,
      round: row.round,
      teamA,
      teamB,
      winner: row.actualWinner,
      kickoff: row.kickoff ? row.kickoff.toISOString() : null,
    });
  }

  const r32Kickoffs = rows
    .filter((r) => r.round === 'R32')
    .map((r) => r.kickoff);
  const lockTime = computeLockTime(r32Kickoffs);

  return { slots, lockTimeIso: lockTime ? lockTime.toISOString() : null };
}
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/r32-skeleton.ts src/lib/r32-skeleton.test.ts src/app/actions/bracket.ts
git commit -m "feat: add R32-skeleton validator and official-bracket actions"
```

---

### Task 7: Admin bracket page — set R32 skeleton + view tree

**Files:**
- Create: `src/app/admin/bracket/page.tsx`
- Create: `src/app/admin/bracket/R32SkeletonForm.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `setR32Skeleton`, `getOfficialBracket` (Task 6), `auth`/`AppSession`, `db`, `TEAMS`.
- Produces: `/admin/bracket` route (admin-guarded server component) with a 16-row form to set the R32 skeleton and a read-only view of the derived official bracket. Adds an `/admin/bracket` link to `/admin`.

- [ ] **Step 1: Create the client form `src/app/admin/bracket/R32SkeletonForm.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { setR32Skeleton, type R32Entry } from '@/app/actions/bracket';

type Team = { code: string; name: string };

type Row = { teamA: string; teamB: string; kickoff: string };

export default function R32SkeletonForm({
  teams,
  initial,
}: {
  teams: Team[];
  initial: Row[]; // length 16, slot i+1
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit() {
    setError(null);
    setOk(false);
    const entries: R32Entry[] = rows.map((r, i) => ({
      slot: i + 1,
      teamA: r.teamA,
      teamB: r.teamB,
      kickoff: r.kickoff ? new Date(r.kickoff).toISOString() : null,
    }));
    start(async () => {
      const res = await setR32Skeleton(entries);
      if (res?.error) setError(res.error);
      else setOk(true);
    });
  }

  return (
    <div>
      <table>
        <thead>
          <tr><th>R32</th><th>Team A</th><th>Team B</th><th>Kickoff (local)</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <select value={r.teamA} onChange={(e) => update(i, { teamA: e.target.value })}>
                  <option value="">—</option>
                  {teams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </td>
              <td>
                <select value={r.teamB} onChange={(e) => update(i, { teamB: e.target.value })}>
                  <option value="">—</option>
                  {teams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </td>
              <td>
                <input
                  type="datetime-local"
                  value={r.kickoff}
                  onChange={(e) => update(i, { kickoff: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p style={{ color: '#ff8080' }}>{error}</p>}
      {ok && <p style={{ color: 'var(--accent)' }}>Saved.</p>}
      <button disabled={pending} onClick={submit}>{pending ? 'Saving…' : 'Save R32 skeleton'}</button>
    </div>
  );
}
```

- [ ] **Step 2: Create the page `src/app/admin/bracket/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { TEAMS } from '@/lib/teams';
import { getOfficialBracket } from '@/app/actions/bracket';
import R32SkeletonForm from './R32SkeletonForm';

export const dynamic = 'force-dynamic';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  // datetime-local wants "YYYY-MM-DDTHH:mm"; trim the ISO seconds/zone.
  return iso.slice(0, 16);
}

export default async function AdminBracketPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) redirect('/');

  const r32 = await db.match.findMany({ where: { round: 'R32' }, orderBy: { slot: 'asc' } });
  const initial = Array.from({ length: 16 }, (_, i) => {
    const row = r32.find((m) => m.slot === i + 1);
    return {
      teamA: row?.teamA ?? '',
      teamB: row?.teamB ?? '',
      kickoff: toLocalInput(row?.kickoff ? row.kickoff.toISOString() : null),
    };
  });

  const { slots } = await getOfficialBracket();

  return (
    <main style={{ maxWidth: 860, margin: '24px auto', padding: 16 }}>
      <h1>Official bracket</h1>
      <section>
        <h2>Set Round-of-32 matchups</h2>
        <R32SkeletonForm teams={TEAMS} initial={initial} />
      </section>
      <section>
        <h2>Derived bracket</h2>
        {slots.length === 0 ? (
          <p>No bracket yet — set the R32 matchups above.</p>
        ) : (
          <ul>
            {slots.map((s) => (
              <li key={s.slot}>
                [{s.round} #{s.slot}] {s.teamA ?? '?'} vs {s.teamB ?? '?'}
                {s.winner ? ` → ${s.winner}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Add a link to `/admin/bracket` from `src/app/admin/page.tsx`**

In `src/app/admin/page.tsx`, add a link near the top of the returned JSX, right after the `<h1>Admin</h1>` line:

```tsx
      <p><a href="/admin/bracket">→ Official bracket setup</a></p>
```

- [ ] **Step 4: Typecheck, full suite, and build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.
Run: `npx next build`
Expected: compiles successfully; `/admin/bracket` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/bracket/page.tsx src/app/admin/bracket/R32SkeletonForm.tsx src/app/admin/page.tsx
git commit -m "feat: add admin official-bracket setup page"
```

---

### Task 8: Show the lock countdown on the home page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getOfficialBracket` (Task 6), `formatLockTimePT` (Task 4), `Countdown` (Task 5).
- Produces: the home page renders the `Countdown` with the official bracket's lock time and a PT label.

- [ ] **Step 1: Update `src/app/page.tsx`**

```tsx
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { formatLockTimePT } from '@/lib/lock';
import Countdown from '@/app/_components/Countdown';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  const { lockTimeIso } = await getOfficialBracket();
  const lockLabel = lockTimeIso ? formatLockTimePT(new Date(lockTimeIso)) : null;

  return (
    <main style={{ padding: 24 }}>
      <h1>WC26 Knockout Bracket</h1>
      {session?.user ? (
        <p>Welcome, {session.user.name}.</p>
      ) : (
        <p>Request an account to join the pool.</p>
      )}
      <Countdown lockTimeIso={lockTimeIso} lockLabel={lockLabel} />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck, full suite, and build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.
Run: `npx next build`
Expected: compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: show lock countdown on home page"
```

---

## Self-Review

**Spec coverage (Plan 2 scope):**
- `Team` model + 48-team data ported from wc26 → Tasks 1, 2. ✓
- `Match` model (31 slots, round, teamA/teamB, actualWinner, kickoff, feedRef) → Task 1. ✓
- Fixed bracket geometry + feeder wiring (computed, not stored) + round points → Task 3. ✓
- Admin sets R32 skeleton (16 matchups + kickoffs); later slots ensured → Tasks 6, 7. ✓
- Derived later-round participants (bracket tree) → Task 3 (`participantsForSlot`) used by Task 6 (`getOfficialBracket`). ✓
- Lock time = earliest R32 kickoff − 1h, server-computed → Task 4, surfaced in Task 6. ✓
- PST countdown timer on home → Tasks 4, 5, 8. ✓
- Admin-only enforcement (server guard + `requireAdmin()` in actions) → Tasks 6, 7. ✓

**Intentionally deferred (not in Plan 2):** `Bracket`/`BracketPick` user-prediction models + bracket fill UI (Plan 3); results feed + scoring + leaderboard (Plan 4); post-lock visibility + themed UI (Plan 5). The `feedRef` column is added now but only used in Plan 4.

**Placeholder scan:** The only "fill in" is Task 2 Step 1, which is a data port from two named source files with an integrity test pinning the result (48 unique teams, hex colors) — data, not logic. No TBD/TODO in logic steps; every code step shows complete code.

**Type consistency:** `Round`, `SlotResult`, `R32Entry`, `OfficialSlot`, `TeamData` are defined once and reused with identical shapes. `participantsForSlot(slot, matches)` signature matches its caller in `getOfficialBracket`. `computeLockTime((Date|null)[])` matches its caller (R32 `kickoff` values). `Countdown`'s `{ lockTimeIso, lockLabel }` props match the home-page usage. `setR32Skeleton(R32Entry[])` matches the form's call.

---

## Subsequent Plans (roadmap)

- **Plan 3 — User bracket UI & lock:** `Bracket`/`BracketPick` models; interactive fill of all 31 predictions; submit + server-enforced lock at the Plan 2 lock time.
- **Plan 4 — Results feed, scoring & leaderboard:** ported wc26 results-source (self-healing) → `Match.actualWinner` (+ admin override); pure round-weighted scoring (perfect = 80, using `ROUND_POINTS`); leaderboard with shared ranks + pot.
- **Plan 5 — Post-lock visibility, browse others & themed UI:** post-lock visibility gate; `/brackets` + `/brackets/[user]`; `frontend-design`-driven WC26 football theme (including a real bracket-tree layout).
