# Multiple Brackets Per User — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user enter multiple brackets, with every bracket beyond their first admin-approved before it counts, and the pot = $50 × approved brackets.

**Architecture:** Drop the `Bracket.userId @unique` constraint and add per-bracket identity (`name`) + `status` (PENDING/APPROVED/REJECTED). User actions move from one-bracket-per-user (keyed by `userId`) to many (keyed by `bracketId`) with ownership checks; admins approve/reject pending brackets. Leaderboard, browse, and post-lock pages count and display only `APPROVED` brackets, one row per bracket.

**Tech Stack:** Next.js 15 (App Router, modified Next.js), React 19, TypeScript, Prisma 6 + Neon Postgres, Vitest 4. No new dependencies.

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (modified Next.js per `AGENTS.md`).
- **Windows/Prisma:** the dev server holds a lock on Prisma's engine DLL. No dev server may run during `prisma generate` / `prisma db push` (it was killed earlier this session — verify with `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered to `wc_ko_26`). `db push` writes to the **live Neon DB** — that is the project's established migration mechanism (`.env` holds `DATABASE_URL`/`DIRECT_URL`).
- First bracket per user → `APPROVED`; each additional → `PENDING`. Only `APPROVED` brackets count toward the pot and appear publicly.
- Pot = `entryCents × (approved bracket count)`; `entryCents` default 5000 ($50).
- Bracket name: max 32 chars, trimmed, whitespace-collapsed, control-chars stripped; empty → `"Bracket {n}"`.
- Single global lock (existing): no create/edit after lock; admin may still approve/reject after lock.
- Ownership: a user may only read/edit/delete their own brackets (server-enforced); admin actions use the existing `requireAdmin()`.
- Editing an `APPROVED` bracket does not reset its status. A user may delete only `PENDING`/`REJECTED` brackets.
- End every commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Verify commands: `npx tsc --noEmit` · `npx vitest run` · `npx next build`.
- Spec: `docs/superpowers/specs/2026-06-24-multiple-brackets-per-user-design.md`.

---

## Task 1: Schema — per-bracket identity + status

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Bracket { id, userId, name, status: BracketStatus, picks, submittedAt, approvedAt, approvedBy, createdAt, updatedAt }` (no `@unique` on `userId`; `@@index([userId])`); enum `BracketStatus { PENDING, APPROVED, REJECTED }`.

- [ ] **Step 1: Edit the `Bracket` model and add the enum**

In `prisma/schema.prisma`, replace the existing `Bracket` model with the following and add the enum next to it:

```prisma
enum BracketStatus {
  PENDING
  APPROVED
  REJECTED
}

model Bracket {
  id          String        @id @default(cuid())
  userId      String
  name        String        @default("Bracket 1")
  status      BracketStatus @default(APPROVED)
  picks       Json          @default("{}")
  submittedAt DateTime?
  approvedAt  DateTime?
  approvedBy  String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([userId])
}
```

(The `@default(APPROVED)` and `@default("Bracket 1")` backfill existing rows on `db push`. New brackets always set `status`/`name` explicitly in Task 3, so the defaults govern only the historical backfill.)

- [ ] **Step 2: Verify no dev server holds the Prisma engine lock**

Run (PowerShell): `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'wc_ko_26' } | Select-Object ProcessId`
Expected: no rows. If any, stop them before continuing.

- [ ] **Step 3: Validate, generate the client, push to the DB**

Run: `npx prisma validate`
Expected: "The schema at prisma\schema.prisma is valid 🚀".

Run: `npx prisma generate`
Expected: "Generated Prisma Client".

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." (adds `name`/`status`/`approvedAt`/`approvedBy`, drops the `userId` unique index; existing rows backfill to `status=APPROVED`, `name="Bracket 1"`.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (the regenerated client now types `Bracket.status` etc.). Code using the old shape compiles because all current reads only select existing fields.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: bracket name + status; allow many brackets per user

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure helpers — name normalization + status selection

**Files:**
- Create: `src/lib/bracket-name.ts`
- Test: `src/lib/bracket-name.test.ts`

**Interfaces:**
- Produces:
  - `normalizeBracketName(raw: string | null | undefined, fallbackIndex: number): string`
  - `statusForNewBracket(existingCount: number): 'APPROVED' | 'PENDING'`

- [ ] **Step 1: Write the failing tests** — `src/lib/bracket-name.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { normalizeBracketName, statusForNewBracket } from './bracket-name';

describe('normalizeBracketName', () => {
  it('keeps a clean name', () => {
    expect(normalizeBracketName('Long shot', 2)).toBe('Long shot');
  });
  it('trims and collapses internal whitespace', () => {
    expect(normalizeBracketName('  My   Bracket  ', 1)).toBe('My Bracket');
  });
  it('strips control characters', () => {
    expect(normalizeBracketName('Ev\u0007il', 1)).toBe('Evil');
  });
  it('caps length at 32 characters', () => {
    const long = 'x'.repeat(50);
    expect(normalizeBracketName(long, 1)).toHaveLength(32);
  });
  it('falls back to "Bracket {n}" when empty/blank/nullish', () => {
    expect(normalizeBracketName('', 3)).toBe('Bracket 3');
    expect(normalizeBracketName('   ', 4)).toBe('Bracket 4');
    expect(normalizeBracketName(null, 5)).toBe('Bracket 5');
    expect(normalizeBracketName(undefined, 6)).toBe('Bracket 6');
  });
});

describe('statusForNewBracket', () => {
  it('auto-approves the first bracket, makes the rest pending', () => {
    expect(statusForNewBracket(0)).toBe('APPROVED');
    expect(statusForNewBracket(1)).toBe('PENDING');
    expect(statusForNewBracket(5)).toBe('PENDING');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/bracket-name.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/bracket-name.ts`

```ts
const MAX_LEN = 32;

/** Clean a user-supplied bracket label; blank/invalid → "Bracket {fallbackIndex}". */
export function normalizeBracketName(raw: string | null | undefined, fallbackIndex: number): string {
  const cleaned = (raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '') // strip control chars
    .replace(/\s+/g, ' ')                  // collapse whitespace runs
    .trim()
    .slice(0, MAX_LEN);
  return cleaned.length > 0 ? cleaned : `Bracket ${fallbackIndex}`;
}

/** A user's first bracket is auto-approved; every later one needs admin approval. */
export function statusForNewBracket(existingCount: number): 'APPROVED' | 'PENDING' {
  return existingCount === 0 ? 'APPROVED' : 'PENDING';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/bracket-name.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-name.ts src/lib/bracket-name.test.ts
git commit -m "feat: bracket-name normalization + first-auto-approve status helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: User bracket actions (many per user)

**Files:**
- Modify: `src/app/actions/bracket-entry.ts` (full rewrite)

**Interfaces:**
- Consumes: `normalizeBracketName`, `statusForNewBracket` (Task 2); existing `getOfficialBracket`, `officialR32FromSlots`/`officialR32IsSet`, `validateSubmission`, `isLocked`, `TOTAL_SLOTS`, `Picks`.
- Produces:
  - `type BracketStatusStr = 'PENDING' | 'APPROVED' | 'REJECTED'`
  - `type MyBracketRow = { id: string; name: string; status: BracketStatusStr; submittedAt: string | null }`
  - `type LockInfo = { locked: boolean; lockTimeIso: string | null; officialReady: boolean }`
  - `type BracketView = { id: string; name: string; status: BracketStatusStr; picks: Picks; submittedAt: string | null; lockTimeIso: string | null; locked: boolean; officialReady: boolean }`
  - `listMyBrackets(): Promise<{ error?: string; brackets?: MyBracketRow[]; lock?: LockInfo }>`
  - `createBracket(name: string): Promise<{ error?: string; id?: string }>`
  - `getBracket(id: string): Promise<{ error?: string; view?: BracketView }>`
  - `saveBracket(id: string, picks: Picks): Promise<{ error?: string }>`
  - `deleteBracket(id: string): Promise<{ error?: string }>`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `src/app/actions/bracket-entry.ts` with:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots, officialR32IsSet } from '@/lib/official-r32';
import { validateSubmission } from '@/lib/bracket-validate';
import { isLocked } from '@/lib/lock';
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { normalizeBracketName, statusForNewBracket } from '@/lib/bracket-name';
import type { Picks } from '@/lib/bracket-picks';

export type BracketStatusStr = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MyBracketRow = { id: string; name: string; status: BracketStatusStr; submittedAt: string | null };
export type LockInfo = { locked: boolean; lockTimeIso: string | null; officialReady: boolean };
export type BracketView = {
  id: string;
  name: string;
  status: BracketStatusStr;
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

async function lockInfo(): Promise<LockInfo> {
  const official = await getOfficialBracket();
  return {
    locked: isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null),
    lockTimeIso: official.lockTimeIso,
    officialReady: officialR32IsSet(officialR32FromSlots(official.slots)),
  };
}

export async function listMyBrackets(): Promise<{ error?: string; brackets?: MyBracketRow[]; lock?: LockInfo }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const lock = await lockInfo();
  const rows = await db.bracket.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, status: true, submittedAt: true },
  });
  return {
    brackets: rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status as BracketStatusStr,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    })),
    lock,
  };
}

export async function createBracket(name: string): Promise<{ error?: string; id?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const lock = await lockInfo();
  if (!lock.officialReady) return { error: 'The bracket isn’t open yet.' };
  if (lock.locked) return { error: 'Brackets are locked — no new entries.' };

  const existingCount = await db.bracket.count({ where: { userId } });
  const status = statusForNewBracket(existingCount);
  const cleanName = normalizeBracketName(name, existingCount + 1);

  const created = await db.bracket.create({
    data: { userId, name: cleanName, status, picks: {} },
    select: { id: true },
  });
  revalidatePath('/bracket');
  return { id: created.id };
}

export async function getBracket(id: string): Promise<{ error?: string; view?: BracketView }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const row = await db.bracket.findUnique({ where: { id } });
  if (!row || row.userId !== userId) return { error: 'Bracket not found.' };
  const lock = await lockInfo();
  return {
    view: {
      id: row.id,
      name: row.name,
      status: row.status as BracketStatusStr,
      picks: coercePicks(row.picks),
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      lockTimeIso: lock.lockTimeIso,
      locked: lock.locked,
      officialReady: lock.officialReady,
    },
  };
}

export async function saveBracket(id: string, picks: Picks): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const row = await db.bracket.findUnique({ where: { id }, select: { userId: true } });
  if (!row || row.userId !== userId) return { error: 'Bracket not found.' };

  const official = await getOfficialBracket();
  const locked = isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null);
  if (locked) return { error: 'Brackets are locked — no more edits.' };

  const officialR32 = officialR32FromSlots(official.slots);
  const check = validateSubmission(officialR32, picks);
  if (!check.ok) return { error: check.error };

  const normalized: Picks = {};
  for (let s = 1; s <= TOTAL_SLOTS; s++) normalized[s] = picks[s];

  await db.bracket.update({ where: { id }, data: { picks: normalized, submittedAt: new Date() } });
  revalidatePath('/bracket');
  return {};
}

export async function deleteBracket(id: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const row = await db.bracket.findUnique({ where: { id }, select: { userId: true, status: true } });
  if (!row || row.userId !== userId) return { error: 'Bracket not found.' };
  if (row.status === 'APPROVED') return { error: 'Approved brackets can’t be deleted.' };
  await db.bracket.delete({ where: { id } });
  revalidatePath('/bracket');
  return {};
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files that still call the old `getMyBracket()`/`saveBracket(picks)` signatures (`src/app/bracket/page.tsx`, `src/app/bracket/BracketFill.tsx`). Those are rewritten in Task 6. Confirm there are no errors inside `bracket-entry.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/bracket-entry.ts
git commit -m "feat: per-bracket user actions (list/create/get/save/delete) with ownership

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Admin approve/reject bracket actions

**Files:**
- Modify: `src/app/actions/admin.ts` (append two actions)

**Interfaces:**
- Consumes: existing `requireAdmin()` in the same file.
- Produces:
  - `approveBracket(bracketId: string): Promise<{ error?: string }>`
  - `rejectBracket(bracketId: string): Promise<{ error?: string }>`

- [ ] **Step 1: Append the actions** to `src/app/actions/admin.ts`

```ts
export async function approveBracket(bracketId: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  await db.bracket.update({
    where: { id: bracketId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: session.user.id },
  });
  revalidatePath('/admin');
  return {};
}

export async function rejectBracket(bracketId: string): Promise<{ error?: string }> {
  await requireAdmin();
  await db.bracket.update({ where: { id: bracketId }, data: { status: 'REJECTED' } });
  revalidatePath('/admin');
  return {};
}
```

(`db`, `revalidatePath`, and `requireAdmin` are already imported at the top of this file.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors in `admin.ts` (pre-existing Task-6 page errors may still show until Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/admin.ts
git commit -m "feat: admin approveBracket/rejectBracket actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Read side — leaderboard + browse count only APPROVED, per bracket

**Files:**
- Modify: `src/app/actions/leaderboard.ts`
- Modify: `src/app/actions/browse.ts`

**Interfaces:**
- Consumes: existing `rankEntries`/`potSplit`, `scoreBracket`, `currentWinners`, `buildBracketView`, `canViewUserBracket`, `coercePicks`.
- Produces (changed shapes):
  - `browse.ts`: `BracketsIndex.entries: { username: string; name: string; total: number; count: number }[]` (one row per user with ≥1 approved bracket; `total` = their best approved score, `count` = number of approved brackets).
  - `browse.ts`: `UserBracketView.brackets: { id: string; name: string; total: number; slots: SlotView[] }[]` (replaces the single `total`/`slots`).

- [ ] **Step 1: Update `leaderboard.ts`** — count approved brackets, key rows by bracketId

In `src/app/actions/leaderboard.ts`, replace the body of `getLeaderboard` (the query + scoring + pot lines) so it reads:

```ts
export async function getLeaderboard(): Promise<LeaderboardData> {
  const [brackets, winners, config] = await Promise.all([
    db.bracket.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, userId: true, name: true, picks: true },
    }),
    currentWinners(),
    db.poolConfig.findUnique({ where: { id: 'default' } }),
  ]);

  const userIds = brackets.map((b) => b.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, username: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.username ?? u.name]));

  // One leaderboard row per approved bracket, keyed by bracket id.
  const scored = brackets.map((b) => ({
    key: b.id,
    name: `${nameById.get(b.userId) ?? 'Unknown'} — ${b.name}`,
    total: scoreBracket(coercePicks(b.picks), winners),
  }));

  const entries = rankEntries(scored);
  const entryCents = config?.entryCents ?? 5000;
  const players = brackets.length; // approved brackets = paid entries
  const potCents = entryCents * players;
  const { winners: winEntries, shareCents } = potSplit(entries, potCents);

  return {
    entries,
    potCents,
    entryCents,
    players,
    winnerKeys: winEntries.map((w) => w.key),
    shareCents,
  };
}
```

(The `LeaderboardData` type and `coercePicks` helper above it are unchanged.)

- [ ] **Step 2: Update `browse.ts`** — index per user (approved), user page stacks approved brackets

Replace `getBracketsIndex` and `getUserBracketView` (and the `BracketsIndex`/`UserBracketView` types) in `src/app/actions/browse.ts` with:

```ts
export type BracketsIndex = {
  locked: boolean;
  entries: { username: string; name: string; total: number; count: number }[];
};

export async function getBracketsIndex(): Promise<BracketsIndex> {
  const { locked } = await lockedNow();
  if (!locked) return { locked: false, entries: [] };

  const [brackets, winners] = await Promise.all([
    db.bracket.findMany({ where: { status: 'APPROVED' }, select: { userId: true, picks: true } }),
    currentWinners(),
  ]);
  const users = await db.user.findMany({
    where: { id: { in: brackets.map((b) => b.userId) } },
    select: { id: true, name: true, username: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  // Group approved brackets by user: best score + how many.
  const perUser = new Map<string, { username: string; name: string; total: number; count: number }>();
  for (const b of brackets) {
    const u = byId.get(b.userId);
    const username = u?.username ?? '';
    if (!username) continue;
    const total = scoreBracket(coercePicks(b.picks), winners);
    const cur = perUser.get(b.userId);
    if (!cur) {
      perUser.set(b.userId, { username, name: u?.username ?? u?.name ?? 'Unknown', total, count: 1 });
    } else {
      cur.total = Math.max(cur.total, total);
      cur.count += 1;
    }
  }

  const entries = [...perUser.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { locked: true, entries };
}

export type UserBracketView = {
  visible: boolean;
  locked: boolean;
  isOwner: boolean;
  name: string | null;
  brackets: { id: string; name: string; total: number; slots: SlotView[] }[];
};

export async function getUserBracketView(username: string): Promise<UserBracketView> {
  const session = (await auth()) as AppSession | null;
  const viewerId = session?.user?.id ?? null;
  const { locked } = await lockedNow();

  const target = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: { id: true, name: true, username: true },
  });
  if (!target) {
    return { visible: false, locked, isOwner: false, name: null, brackets: [] };
  }

  const isOwner = viewerId === target.id;
  if (!canViewUserBracket({ isOwner, locked })) {
    return { visible: false, locked, isOwner, name: target.username ?? target.name, brackets: [] };
  }

  const [rows, winners, official] = await Promise.all([
    db.bracket.findMany({
      where: { userId: target.id, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, picks: true },
    }),
    currentWinners(),
    getOfficialBracket(),
  ]);
  const officialR32 = officialR32FromSlots(official.slots);

  return {
    visible: true,
    locked,
    isOwner,
    name: target.username ?? target.name,
    brackets: rows.map((r) => {
      const picks = coercePicks(r.picks);
      return { id: r.id, name: r.name, total: scoreBracket(picks, winners), slots: buildBracketView(officialR32, picks, winners) };
    }),
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: a NEW error only in `src/app/brackets/[user]/page.tsx` (it reads the old `view.total`/`view.slots`) — fixed in Task 8. No errors inside `leaderboard.ts`/`browse.ts`. The home page (`/`) consumes `LeaderboardData` unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/leaderboard.ts src/app/actions/browse.ts
git commit -m "feat: count/show only APPROVED brackets; one row per bracket

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: UI — "My brackets" list + per-bracket edit page

**Files:**
- Modify: `src/app/bracket/page.tsx` (becomes the list)
- Create: `src/app/bracket/[id]/page.tsx` (edit one bracket)
- Create: `src/app/bracket/MyBrackets.tsx` (client: new-bracket form + delete buttons)
- Modify: `src/app/bracket/BracketFill.tsx` (take a `bracketId`, save to it)

**Interfaces:**
- Consumes: `listMyBrackets`, `createBracket`, `deleteBracket`, `getBracket`, `saveBracket` (Task 3); `getOfficialBracket`, `officialR32FromSlots`, `MarchMadnessBracket`/`BracketFill`.

- [ ] **Step 1: Read the App Router client/server guidance**

Read `node_modules/next/dist/docs/` for server vs client components + `useRouter`. `page.tsx` files stay server components; `MyBrackets.tsx` and `BracketFill.tsx` are `'use client'`.

- [ ] **Step 2: Rewrite `src/app/bracket/page.tsx`** as the list

```tsx
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { listMyBrackets } from '@/app/actions/bracket-entry';
import MyBrackets from './MyBrackets';

export const dynamic = 'force-dynamic';

export default async function BracketPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const res = await listMyBrackets();
  const lock = res.lock;

  if (!lock || !lock.officialReady) {
    return (
      <main className="shell">
        <p className="eyebrow">Your picks</p>
        <h1>Your brackets</h1>
        <div className="panel" style={{ marginTop: 16 }}>
          <p className="muted">The bracket isn&apos;t open yet — the Round-of-32 matchups haven&apos;t been set. Check back soon.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Your picks</p>
        <h1>Your brackets</h1>
        <p className="lead">
          Your first bracket counts right away; each extra one needs an admin OK before it joins the pool.
          {lock.locked && ' Brackets are locked.'}
        </p>
      </header>
      <MyBrackets brackets={res.brackets ?? []} locked={lock.locked} />
    </main>
  );
}
```

- [ ] **Step 3: Create `src/app/bracket/MyBrackets.tsx`** (client list + actions)

```tsx
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBracket, deleteBracket, type MyBracketRow } from '@/app/actions/bracket-entry';

function badge(status: MyBracketRow['status']) {
  const cls = status === 'APPROVED' ? 'ok' : status === 'REJECTED' ? 'bad' : 'warn';
  return <span className={`badge ${cls}`}>{status.toLowerCase()}</span>;
}

export default function MyBrackets({ brackets, locked }: { brackets: MyBracketRow[]; locked: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      const res = await createBracket(name);
      if (res?.error) { setError(res.error); return; }
      setName('');
      if (res.id) router.push(`/bracket/${res.id}`);
      else router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const res = await deleteBracket(id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="panel reveal reveal-2">
      {brackets.length === 0 ? (
        <p className="muted">No brackets yet — create your first below.</p>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/bracket/${b.id}`}>{b.name}</Link></td>
                <td>{badge(b.status)}</td>
                <td>
                  <div className="row-actions">
                    <Link href={`/bracket/${b.id}`} className="btn btn-sm">Edit</Link>
                    {b.status !== 'APPROVED' && !locked && (
                      <button type="button" className="btn btn-sm" disabled={pending} onClick={() => remove(b.id)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!locked && (
        <div className="savebar" style={{ marginTop: 14 }}>
          <input
            type="text"
            value={name}
            maxLength={32}
            placeholder="New bracket name (optional)"
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button type="button" disabled={pending} onClick={add}>{pending ? 'Working…' : '+ New bracket'}</button>
        </div>
      )}
      {error && <p className="banner error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/bracket/[id]/page.tsx`** (edit one bracket)

```tsx
import { redirect, notFound } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getBracket } from '@/app/actions/bracket-entry';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import BracketFill from '../BracketFill';

export const dynamic = 'force-dynamic';

export default async function EditBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const [{ view, error }, official] = await Promise.all([getBracket(id), getOfficialBracket()]);
  if (error || !view) notFound();

  const officialR32 = officialR32FromSlots(official.slots);

  return (
    <main className="shell">
      <header className="reveal" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Your picks · {view.name}</p>
        <h1>{view.name}</h1>
        <p className="lead">
          Click a team to advance it through every round to the Final.
          {view.status === 'PENDING' && ' This bracket is awaiting admin approval.'}
          {view.locked && ' Brackets are locked.'}
        </p>
      </header>
      <div className="panel reveal reveal-2" style={{ padding: 14 }}>
        <BracketFill bracketId={view.id} officialR32={officialR32} initialPicks={view.picks} locked={view.locked} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Update `BracketFill.tsx`** to take a `bracketId` and save to it

Change the component props and the `save()` call. Edit the props type and the `saveBracket` call:

```tsx
export default function BracketFill({
  bracketId,
  officialR32,
  initialPicks,
  locked,
}: {
  bracketId: string;
  officialR32: OfficialR32;
  initialPicks: Picks;
  locked: boolean;
}) {
```

and inside `save()` change the call from `saveBracket(picks)` to:

```tsx
      const res = await saveBracket(bracketId, picks);
```

(Everything else in `BracketFill.tsx` — the pick logic, the savebar — stays as is.)

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; routes include `/bracket` and `/bracket/[id]`.

- [ ] **Step 7: Commit**

```bash
git add src/app/bracket/page.tsx src/app/bracket/MyBrackets.tsx src/app/bracket/[id]/page.tsx src/app/bracket/BracketFill.tsx
git commit -m "feat: My Brackets list + per-bracket edit page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: UI — admin bracket-approval queue

**Files:**
- Modify: `src/app/admin/page.tsx` (add a "Bracket entries" section)

**Interfaces:**
- Consumes: `approveBracket`, `rejectBracket` (Task 4); existing `ActionButton`; `db`.

- [ ] **Step 1: Add the pending-brackets query + section** to `src/app/admin/page.tsx`

Add the import:

```tsx
import { approveUser, rejectUser, setAdmin, removeUser, approveBracket, rejectBracket } from '@/app/actions/admin';
```

After the `const all = await db.user.findMany(...)` line, add:

```tsx
  const pendingBrackets = await db.bracket.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, userId: true },
  });
  const bracketOwners = await db.user.findMany({
    where: { id: { in: pendingBrackets.map((b) => b.userId) } },
    select: { id: true, name: true, username: true },
  });
  const ownerById = new Map(bracketOwners.map((u) => [u.id, u]));
```

Then insert this section between the "Pending approval" `</section>` and the "All members" `<section>`:

```tsx
      <section className="panel reveal reveal-3" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h2>Bracket entries awaiting approval</h2>
          <span className="pill">{pendingBrackets.length} waiting</span>
        </div>
        {pendingBrackets.length === 0 ? (
          <p className="muted">No extra brackets waiting.</p>
        ) : (
          <table>
            <thead><tr><th>Player</th><th>Bracket</th><th></th></tr></thead>
            <tbody>
              {pendingBrackets.map((b) => {
                const u = ownerById.get(b.userId);
                return (
                  <tr key={b.id}>
                    <td>{u?.username ?? u?.name ?? 'Unknown'}</td>
                    <td className="muted">{b.name}</td>
                    <td>
                      <div className="row-actions">
                        <ActionButton label="Approve" variant="primary" action={approveBracket.bind(null, b.id)} />
                        <ActionButton label="Reject" action={rejectBracket.bind(null, b.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/admin` compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: admin bracket-approval queue

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: UI — public browse (per-user, stacked approved brackets)

**Files:**
- Modify: `src/app/brackets/page.tsx` (index: per-user rows + count)
- Modify: `src/app/brackets/[user]/page.tsx` (stack all approved brackets)

**Interfaces:**
- Consumes: `getBracketsIndex` (now `{ username, name, total, count }[]`), `getUserBracketView` (now `{ ..., brackets: {id,name,total,slots}[] }`) from Task 5; `MarchMadnessBracket`.

- [ ] **Step 1: Update the index table** in `src/app/brackets/page.tsx`

Replace the `<thead>`/`<tbody>` of the table (the `index.entries.map(...)` block) with a version that shows the bracket count:

```tsx
            <thead>
              <tr><th>#</th><th>Player</th><th>Brackets</th><th style={{ textAlign: 'right' }}>Best</th></tr>
            </thead>
            <tbody>
              {index.entries.map((e, i) => (
                <tr key={e.username}>
                  <td className="muted">{i + 1}</td>
                  <td><Link href={`/brackets/${encodeURIComponent(e.username)}`}>{e.name}</Link></td>
                  <td className="muted">{e.count}</td>
                  <td style={{ textAlign: 'right' }}>{e.total}</td>
                </tr>
              ))}
            </tbody>
```

- [ ] **Step 2: Update `src/app/brackets/[user]/page.tsx`** to stack approved brackets

Replace the final `return (...)` (the visible branch that renders one `MarchMadnessBracket`) with:

```tsx
  return (
    <main className="shell">
      <h1>{view.name}</h1>
      {view.brackets.length === 0 ? (
        <p className="muted">No approved brackets.</p>
      ) : (
        view.brackets.map((b) => (
          <section key={b.id} className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <h2>{b.name}</h2>
              <span className="pill">{b.total} pts{view.isOwner ? ' · yours' : ''}</span>
            </div>
            <MarchMadnessBracket slots={b.slots} />
          </section>
        ))
      )}
    </main>
  );
```

(The earlier `!view.name` and `!view.visible` branches stay unchanged.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/brackets` and `/brackets/[user]` compile.

- [ ] **Step 4: Commit**

```bash
git add src/app/brackets/page.tsx src/app/brackets/[user]/page.tsx
git commit -m "feat: browse shows each user's approved brackets, stacked

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Full verification

**Files:** none.

- [ ] **Step 1: Gate**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: all pass; vitest includes the new `bracket-name` suite; build compiles `/bracket`, `/bracket/[id]`, `/admin`, `/brackets`, `/brackets/[user]`, `/` (leaderboard).

- [ ] **Step 2: Manual end-to-end (logged in)**

`npm run dev`, log in as admin (`gondaniel852@gmail.com`). On `/bracket`: confirm your existing bracket appears as **approved**; create a second bracket → it shows **pending** and opens its edit page; fill + save it. On `/admin`: the second bracket appears under "Bracket entries awaiting approval" → Approve it. On `/` (home): pot = $50 × approved-bracket count, and the second bracket appears as its own leaderboard row "name — bracketname". Create a third bracket, leave it pending, and confirm it does NOT affect the pot or leaderboard, and that you can Delete it.

- [ ] **Step 3: Confirm lock behavior**

If the bracket is locked, confirm `/bracket` hides the "New bracket" input and Delete buttons, and that `createBracket`/`saveBracket`/`deleteBracket` reject server-side.

---

## Self-review (done while writing)

- **Spec coverage:** data model + enum + backfill → Task 1; name/status helpers → Task 2; per-bracket user actions w/ ownership, first-auto-approve, delete rules, lock → Task 3; admin approve/reject → Task 4; pot = $50 × approved + per-bracket leaderboard rows + per-user browse (stacked) → Task 5; My-brackets list + edit page → Task 6; admin queue → Task 7; public browse → Task 8; verification → Task 9. Decisions #1–#8 all map to tasks.
- **Placeholder scan:** clean — every code step shows complete code; no "add validation/error handling" hand-waves. Task 3/5 typecheck steps explicitly name the cross-task errors the implementer will (correctly) see until the consuming page is updated.
- **Type consistency:** `MyBracketRow`/`BracketView`/`LockInfo` defined in Task 3 consumed by Task 6; `approveBracket`/`rejectBracket` (Task 4) consumed by Task 7; `BracketsIndex.entries{username,name,total,count}` + `UserBracketView.brackets[]` (Task 5) consumed by Task 8; `BracketFill` gains `bracketId` (Task 6 Step 5) and every caller passes it (Task 6 Step 4). `saveBracket` is `(id, picks)` everywhere after Task 3.
