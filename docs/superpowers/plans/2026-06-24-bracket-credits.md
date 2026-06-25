# Bracket Credits + Member Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-bracket approval with a credit allowance (1 credit = 1 bracket = $50, no refunds/deletion), and show members by username + first name (all four fields in admin).

**Architecture:** Add `User.credits`; drop `Bracket.status`/`approvedAt`/`approvedBy`. Approving a signup grants 1 credit; the admin grants more via +1/−1 buttons; `createBracket` is allowed only while `bracketCount < credits`. Leaderboard/browse/pot count every bracket and display `username (firstName)`. Remove the bracket-approval queue, the `approve/rejectBracket` actions, the user Delete button, and bracket status.

**Tech Stack:** Next.js 15 (App Router, modified — see `AGENTS.md`), React 19, Prisma 6 + Neon, Vitest. No new dependencies.

## Global Constraints

- Read `node_modules/next/dist/docs/` before Next.js code (modified Next.js).
- **Windows/Prisma:** no dev server during `prisma generate`/`db push` (engine DLL lock). `db push` writes the **live Neon DB** (project's migration mechanism).
- **Credits = hard allowance (max brackets), no refunds, no user deletion.** Create allowed iff `bracketCount < credits`. At-cap copy (verbatim, both server + client): `You've used all your brackets — buy another to add one.`
- Approving a signup grants **1 credit**; admin grants more via **+1 / −1** (`credits = max(0, credits ± 1)`). Pot = `entryCents × (total brackets)`.
- Public handle = `username (firstName)` when firstName set, else `username`. Admin members table shows **username, first name, last name, email, credits** + actions.
- This **removes** parts of the merged multi-bracket feature: `Bracket.status`/`approvedAt`/`approvedBy` + `BracketStatus` enum, `approveBracket`/`rejectBracket`, the admin bracket-approval queue, `deleteBracket`, `statusForNewBracket`, and the `status:'APPROVED'` filters.
- End every commit with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Verify: `npx tsc --noEmit` · `npx vitest run` · `npx next build`.
- Spec: `docs/superpowers/specs/2026-06-24-bracket-credits-design.md`.

---

## Task 1: Schema — credits, drop bracket status; backfill

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/backfill-credits.ts`

**Interfaces:** Produces `User.credits Int @default(0)`; `Bracket` without `status`/`approvedAt`/`approvedBy`; `BracketStatus` enum removed.

- [ ] **Step 1: Edit `prisma/schema.prisma`**

Add `credits Int @default(0)` to the `User` model (e.g. after `isAdmin`). Replace the `Bracket` model with:

```prisma
model Bracket {
  id          String    @id @default(cuid())
  userId      String
  name        String    @default("Bracket 1")
  picks       Json      @default("{}")
  submittedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId])
}
```

Delete the `enum BracketStatus { … }` block entirely.

- [ ] **Step 2: Create the backfill script** — `prisma/backfill-credits.ts`

```ts
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Give every APPROVED user credits = max(their current bracket count, 1), so no
// existing bracket exceeds the new cap and approved users get at least their first.
async function main() {
  const users = await db.user.findMany({ where: { status: 'APPROVED' }, select: { id: true } });
  for (const u of users) {
    const count = await db.bracket.count({ where: { userId: u.id } });
    await db.user.update({ where: { id: u.id }, data: { credits: Math.max(count, 1) } });
  }
  console.log(`backfilled credits for ${users.length} approved users`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
```

- [ ] **Step 3: Verify no dev server, then generate + push**

Run (PowerShell): `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'wc_ko_26' } | Select-Object ProcessId` → expect none.
Run: `npx prisma validate` → valid.
Run: `npx prisma generate` → Generated.
Run: `npx prisma db push` → "in sync" (adds `credits`, drops the 3 bracket columns + enum).

- [ ] **Step 4: Run the backfill**

Run: `npx tsx --env-file=.env prisma/backfill-credits.ts`
Expected: "backfilled credits for N approved users" (N ≥ 1 — the admin).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in files that still reference `Bracket.status`/`approveBracket`/`deleteBracket`/`statusForNewBracket` (fixed in Tasks 2–7). Confirm the schema/client itself is consistent.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/backfill-credits.ts
git commit -m "feat: User.credits; drop bracket approval status (schema + backfill)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure helper — canCreateBracket; drop statusForNewBracket

**Files:**
- Create: `src/lib/bracket-credits.ts`
- Test: `src/lib/bracket-credits.test.ts`
- Modify: `src/lib/bracket-name.ts` (remove `statusForNewBracket`)
- Modify: `src/lib/bracket-name.test.ts` (remove its `statusForNewBracket` tests)

**Interfaces:** Produces `canCreateBracket(used: number, credits: number): boolean` (true iff `used < credits`).

- [ ] **Step 1: Write the failing test** — `src/lib/bracket-credits.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { canCreateBracket } from './bracket-credits';

describe('canCreateBracket', () => {
  it('allows a create only while used < credits', () => {
    expect(canCreateBracket(0, 1)).toBe(true);   // approved, no bracket yet
    expect(canCreateBracket(1, 1)).toBe(false);  // at cap
    expect(canCreateBracket(1, 2)).toBe(true);   // bought a second
    expect(canCreateBracket(2, 2)).toBe(false);  // at cap again
  });
  it('blocks when the user has no credits', () => {
    expect(canCreateBracket(0, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/bracket-credits.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/bracket-credits.ts`

```ts
/** A user may create another bracket only while they hold fewer than their credit cap. */
export function canCreateBracket(used: number, credits: number): boolean {
  return used < credits;
}
```

- [ ] **Step 4: Remove `statusForNewBracket`**

In `src/lib/bracket-name.ts`, delete the `statusForNewBracket` function (keep `normalizeBracketName` and `MAX_LEN`). In `src/lib/bracket-name.test.ts`, delete the entire `describe('statusForNewBracket', …)` block and its import usage (keep the `normalizeBracketName` import + tests).

- [ ] **Step 5: Run the helper + name tests**

Run: `npx vitest run src/lib/bracket-credits.test.ts src/lib/bracket-name.test.ts`
Expected: PASS (bracket-credits new; bracket-name still green without the dropped block).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bracket-credits.ts src/lib/bracket-credits.test.ts src/lib/bracket-name.ts src/lib/bracket-name.test.ts
git commit -m "feat: canCreateBracket helper; drop statusForNewBracket

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Credit grants — auth signup + admin actions

**Files:**
- Modify: `src/app/actions/auth.ts` (bootstrap admin gets 1 credit)
- Modify: `src/app/actions/admin.ts` (approveUser grants 1; add grantCredits; remove approve/rejectBracket)

**Interfaces:** Produces `grantCredits(targetUserId: string, delta: number): Promise<{ error?: string }>`.

- [ ] **Step 1: Bootstrap admin credit in `auth.ts`**

In the `db.user.create({ data: { … } })` call in `signup`, add `credits: isBootstrapAdmin ? 1 : 0,` alongside the existing `status`/`approvedAt` fields.

- [ ] **Step 2: Edit `admin.ts`** — approveUser grants the first credit; add grantCredits; remove the bracket actions

Change `approveUser`'s `db.user.update` data to also set `credits: 1`:

```ts
export async function approveUser(targetUserId: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  await db.user.update({
    where: { id: targetUserId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: session.user.id, credits: 1 },
  });
  revalidatePath('/admin');
  return {};
}
```

Add a grant action:

```ts
export async function grantCredits(targetUserId: string, delta: number): Promise<{ error?: string }> {
  await requireAdmin();
  const user = await db.user.findUnique({ where: { id: targetUserId }, select: { credits: true } });
  if (!user) return { error: 'User not found.' };
  const next = Math.max(0, user.credits + delta);
  await db.user.update({ where: { id: targetUserId }, data: { credits: next } });
  revalidatePath('/admin');
  return {};
}
```

**Delete** the `approveBracket` and `rejectBracket` functions from this file.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: a NEW error in `src/app/admin/page.tsx` (it imports `approveBracket`/`rejectBracket`) — fixed in Task 7. No errors inside `auth.ts`/`admin.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/auth.ts src/app/actions/admin.ts
git commit -m "feat: grant 1 credit on approval; grantCredits action; drop bracket approval

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Credit-gated bracket actions

**Files:**
- Modify: `src/app/actions/bracket-entry.ts`

**Interfaces:**
- Consumes: `canCreateBracket` (Task 2).
- Produces: `MyBracketRow` (drops `status`); `listMyBrackets` returns `{ brackets, lock, credits, used }`; `createBracket` credit-gated; `BracketView` drops `status`; **`deleteBracket` removed**.

- [ ] **Step 1: Edit `bracket-entry.ts`**

- Add `import { canCreateBracket } from '@/lib/bracket-credits';`. Remove the `statusForNewBracket` import (keep `normalizeBracketName`).
- `MyBracketRow`: remove the `status` field (now `{ id; name; submittedAt }`). `BracketStatusStr` type + `status` on `BracketView`: remove.
- `listMyBrackets`: also load the user's credits and bracket count; return them:

```ts
export async function listMyBrackets(): Promise<{ error?: string; brackets?: MyBracketRow[]; lock?: LockInfo; credits?: number; used?: number }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const lock = await lockInfo();
  const [rows, user] = await Promise.all([
    db.bracket.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, submittedAt: true } }),
    db.user.findUnique({ where: { id: userId }, select: { credits: true } }),
  ]);
  return {
    brackets: rows.map((r) => ({ id: r.id, name: r.name, submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null })),
    lock,
    credits: user?.credits ?? 0,
    used: rows.length,
  };
}
```

- `createBracket`: gate on credits instead of first-auto-approve; created brackets carry no status:

```ts
export async function createBracket(name: string): Promise<{ error?: string; id?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: 'Not signed in.' };
  const lock = await lockInfo();
  if (!lock.officialReady) return { error: "The bracket isn't open yet." };
  if (lock.locked) return { error: 'Brackets are locked — no new entries.' };

  const [used, user] = await Promise.all([
    db.bracket.count({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { credits: true } }),
  ]);
  if (!canCreateBracket(used, user?.credits ?? 0)) {
    return { error: "You've used all your brackets — buy another to add one." };
  }
  const cleanName = normalizeBracketName(name, used + 1);
  const created = await db.bracket.create({ data: { userId, name: cleanName, picks: {} }, select: { id: true } });
  revalidatePath('/bracket');
  return { id: created.id };
}
```

- `getBracket`: drop `status` from the returned `BracketView` (remove the `status: row.status …` line; keep id/name/picks/submittedAt/lock fields).
- **Delete the entire `deleteBracket` function.**

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: NEW errors only in `src/app/bracket/MyBrackets.tsx` (uses `status`/`deleteBracket`) and `src/app/bracket/[id]/page.tsx` (uses `view.status`) — fixed in Task 6. No errors inside `bracket-entry.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/bracket-entry.ts
git commit -m "feat: credit-gate createBracket; drop status + deleteBracket

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Read side — count all brackets; username (firstName)

**Files:**
- Modify: `src/app/actions/leaderboard.ts`
- Modify: `src/app/actions/browse.ts`

**Interfaces:** No type changes — only the query filter and the display label.

- [ ] **Step 1: `leaderboard.ts`** — drop the APPROVED filter; add firstName to the handle

In `getLeaderboard`, change the bracket query to `db.bracket.findMany({ select: { id: true, userId: true, name: true, picks: true } })` (no `where`). Change the user query select to include `firstName`, and build the handle:

```ts
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, username: true, firstName: true },
  });
  const handleById = new Map(users.map((u) => {
    const handle = u.username ?? u.name;
    return [u.id, u.firstName ? `${handle} (${u.firstName})` : handle];
  }));

  const scored = brackets.map((b) => ({
    key: b.id,
    name: `${handleById.get(b.userId) ?? 'Unknown'} — ${b.name}`,
    total: scoreBracket(coercePicks(b.picks), winners),
  }));
```

(`players = brackets.length`, `potCents = entryCents * players` stay — now over all brackets.)

- [ ] **Step 2: `browse.ts`** — drop both APPROVED filters; add firstName

- `getBracketsIndex`: change the bracket query to `db.bracket.findMany({ select: { userId: true, picks: true } })` (no `where`); add `firstName` to the user select; in the per-user `Map`, set `name` to the handle: `const handle = u?.username ?? u?.name ?? 'Unknown'; const display = u?.firstName ? `${handle} (${u.firstName})` : handle;` and store `name: display`. Keep `username` (the link target) = `u?.username ?? ''`.
- `getUserBracketView`: change the bracket query to `db.bracket.findMany({ where: { userId: target.id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, picks: true } })` (drop `status`); add `firstName` to the target select and set `name` (the page heading) to `target.firstName ? `${target.username ?? target.name} (${target.firstName})` : (target.username ?? target.name)`.

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors in these two files; suite green. (NEW page errors remain only for Task 6/7 files.)

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/leaderboard.ts src/app/actions/browse.ts
git commit -m "feat: count all brackets; show username (firstName)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: User UI — credits in My Brackets; drop status/delete

**Files:**
- Modify: `src/app/bracket/MyBrackets.tsx`
- Modify: `src/app/bracket/page.tsx`
- Modify: `src/app/bracket/[id]/page.tsx`

**Interfaces:** Consumes `listMyBrackets` `{ brackets, lock, credits, used }`, `MyBracketRow` (no status), `createBracket`.

- [ ] **Step 1: Rewrite `MyBrackets.tsx`** (no status badge, no delete, credit-gated create)

```tsx
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBracket, type MyBracketRow } from '@/app/actions/bracket-entry';

export default function MyBrackets({
  brackets,
  locked,
  credits,
  used,
}: {
  brackets: MyBracketRow[];
  locked: boolean;
  credits: number;
  used: number;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const atCap = used >= credits;

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

  return (
    <div className="panel reveal reveal-2">
      <div className="panel-head">
        <h2>Your brackets</h2>
        <span className="pill">{used} of {credits} brackets</span>
      </div>

      {brackets.length === 0 ? (
        <p className="muted">No brackets yet — create your first below.</p>
      ) : (
        <table>
          <thead><tr><th>Name</th><th></th></tr></thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/bracket/${b.id}`}>{b.name}</Link></td>
                <td><Link href={`/bracket/${b.id}`} className="btn btn-sm">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!locked && !atCap && (
        <div className="savebar" style={{ marginTop: 14 }}>
          <input type="text" value={name} maxLength={32} placeholder="New bracket name (optional)" onChange={(e) => setName(e.target.value)} style={{ maxWidth: 240 }} />
          <button type="button" disabled={pending} onClick={add}>{pending ? 'Working…' : '+ New bracket'}</button>
        </div>
      )}
      {!locked && atCap && (
        <p className="muted" style={{ marginTop: 14 }}>You&apos;ve used all your brackets — buy another to add one.</p>
      )}
      {error && <p className="banner error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Pass credits/used from `bracket/page.tsx`**

In `bracket/page.tsx`, change the `<MyBrackets …/>` render to pass the new props:

```tsx
      <MyBrackets brackets={res.brackets ?? []} locked={lock.locked} credits={res.credits ?? 0} used={res.used ?? 0} />
```

(The `listMyBrackets()` result `res` now carries `credits`/`used`; the rest of the page — auth gate, not-open branch, header — is unchanged.)

- [ ] **Step 3: Drop `status` from `bracket/[id]/page.tsx`**

The edit page renders a "PENDING → awaiting approval" note from `view.status`. Remove the `status` usage: change the `<BracketFill …/>` header/lead so it no longer references `view.status` (delete the `view.status === 'PENDING' && …` clause). Keep `view.name`, `view.locked`, `view.picks`.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/bracket` + `/bracket/[id]` compile.

- [ ] **Step 5: Commit**

```bash
git add src/app/bracket/MyBrackets.tsx src/app/bracket/page.tsx "src/app/bracket/[id]/page.tsx"
git commit -m "feat: My Brackets shows credits, no status/delete

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Admin members page — credits + all fields; remove bracket queue

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:** Consumes `grantCredits` (Task 3); existing `ActionButton`, `approveUser`/`rejectUser`/`setAdmin`/`removeUser`.

- [ ] **Step 1: Edit imports + remove the pending-brackets query/section**

Change the admin-actions import to drop `approveBracket`/`rejectBracket` and add `grantCredits`:

```tsx
import { approveUser, rejectUser, setAdmin, removeUser, grantCredits } from '@/app/actions/admin';
```

Delete the `pendingBrackets`/`bracketOwners`/`ownerById` query block and the entire `<section>` titled "Bracket entries awaiting approval".

- [ ] **Step 2: Replace the "All members" table** with username/first/last/email/credits + grant control

Change the `all` query to select the needed fields, and rewrite the table. The `all` query becomes:

```tsx
  const all = await db.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, firstName: true, lastName: true, email: true, isAdmin: true, status: true, credits: true },
  });
```

Replace the "All members" `<section>` body table with:

```tsx
        <table>
          <thead><tr><th>Username</th><th>First</th><th>Last</th><th>Email</th><th>Credits</th><th></th></tr></thead>
          <tbody>
            {all.map((u) => (
              <tr key={u.id}>
                <td>@{u.username}{u.isAdmin && <span className="badge warn" style={{ marginLeft: 8 }}>admin</span>}</td>
                <td>{u.firstName}</td>
                <td>{u.lastName}</td>
                <td className="muted" style={{ fontSize: '0.84rem' }}>{u.email}</td>
                <td>
                  <div className="row-actions">
                    <ActionButton label="−1" action={grantCredits.bind(null, u.id, -1)} />
                    <span className="pill">{u.credits}</span>
                    <ActionButton label="+1" action={grantCredits.bind(null, u.id, 1)} />
                  </div>
                </td>
                <td>
                  <div className="row-actions">
                    <ActionButton label={u.isAdmin ? 'Remove admin' : 'Make admin'} action={setAdmin.bind(null, u.id, !u.isAdmin)} />
                    <ActionButton label="Remove" action={removeUser.bind(null, u.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
```

(`ActionButton.bind(null, u.id, n)` — confirm `ActionButton`'s `action` prop accepts a bound `() => Promise<{error?:string}>`; the existing `setAdmin.bind(null, u.id, !u.isAdmin)` uses the same two-arg bind pattern, so a three-arg bind is consistent.) The "Pending approval" users section above stays unchanged.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/admin` compiles; no remaining references to `approveBracket`/`rejectBracket`/`BracketStatus`/`status` on brackets anywhere.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: admin members table with all fields + credit grant; remove bracket queue

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Full verification

**Files:** none.

- [ ] **Step 1: Gate**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: all pass; vitest includes `bracket-credits` (and `bracket-name` without the dropped block); build compiles all routes. Grep confirms no `BracketStatus`, `approveBracket`, `rejectBracket`, `deleteBracket`, or `statusForNewBracket` remain.

- [ ] **Step 2: Manual end-to-end (logged in)**

`npm run dev`, admin login. Confirm: a newly approved user has **1 credit**; on `/bracket` they see "0 of 1 brackets", create one → "1 of 1" and "New bracket" disappears with the buy-another message; admin **+1** on their members row → user can create a 2nd; both brackets show in the pot ($50 × total) and on the leaderboard as `username (First) — name`; the admin members table shows username/first/last/email/credits with working +1/−1; there is **no** bracket-approval queue and **no** Delete button.

---

## Self-review (done while writing)

- **Spec coverage:** schema+backfill → Task 1; canCreateBracket + drop statusForNewBracket → Task 2; credit grants (signup/approve/grantCredits, remove approve/rejectBracket) → Task 3; credit-gated create + drop status/delete → Task 4; count-all + username(First) → Task 5; My Brackets credits UI → Task 6; admin members table + grant + remove queue → Task 7; verify → Task 8. All 6 spec decisions covered; no-refund/no-delete honored (deleteBracket removed, no refund logic).
- **Placeholder scan:** Tasks 5/6/7 describe a few edits in prose (which fields to select, which clause to delete) because they're small surgical changes to files whose full bodies are already in the merged tree; each names the exact query/clause/props. All new code (schema, backfill, helper, actions, MyBrackets, admin table) is complete. No "TBD".
- **Type consistency:** `canCreateBracket` (Task 2) consumed by `createBracket` (Task 4); `listMyBrackets` `{credits,used}` (Task 4) consumed by `MyBrackets`/`page.tsx` (Task 6); `grantCredits` (Task 3) consumed by the admin table (Task 7). `MyBracketRow`/`BracketView` drop `status` consistently. The Task 3/4/5 typecheck steps name the expected cross-task errors resolved by Tasks 6/7.
- **i18n cross-note:** after this merges, the EN/ES plan's Task 6 bracket keys (`statusPending`/`awaitingApproval`/Delete) must be replaced with the credits copy ("{used} of {credits} brackets", the at-cap message) when that plan is executed.
