# Admin "Haven't Submitted" Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show admins a read-only list on `/admin` of in-pool members (credits ≥ 1) who haven't completed an official bracket, so they can chase them.

**Architecture:** A pure `membersMissingEntry` helper filters members to those with no fully-filled official bracket (reusing the existing `countFilledBrackets` 31-games rule); the `/admin` server page computes the list from the users it already loads plus their official brackets, and renders a new panel.

**Tech Stack:** Next.js 15.5 App Router, Prisma 6 + Neon, React 19, Vitest 4. Spec: `docs/superpowers/specs/2026-06-28-admin-not-submitted-design.md`.

## Global Constraints

- **Admin screens stay English** — no i18n.
- **"Submitted" = at least one `official` bracket with all 31 games picked.** "Missing" = non-admin member, `credits ≥ 1`, no such bracket.
- **Reuse `countFilledBrackets`** (`@/lib/pool-stats`) for the 31-games completeness rule (don't reimplement it).
- **Pure helper is unit-tested (TDD);** the page wiring is glue (read-only, no actions) verified by `tsc`/`lint`/`build`.
- **No schema change.**
- **Commits:** author `Oswaldo Gonzalez <Oswaldo@calvada.local>`; end every message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (use `git -c user.name=... -c user.email=...`).

---

### Task 1: `membersMissingEntry` (pure)

**Files:**
- Create: `src/lib/admin-stats.ts`
- Test: `src/lib/admin-stats.test.ts`

**Interfaces:**
- Consumes: `countFilledBrackets` (`@/lib/pool-stats`) — `(brackets: { picks: unknown }[]) => number`.
- Produces: `membersMissingEntry<T extends { id: string }>(members: T[], officialBrackets: { userId: string; picks: unknown }[]): T[]` — the members with zero fully-filled official brackets; returns the same row objects passed in.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/admin-stats.test.ts
import { describe, it, expect } from 'vitest';
import { membersMissingEntry } from './admin-stats';

const full = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 1, 'T']));
const half = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 'T']));

describe('membersMissingEntry', () => {
  it('flags a member with no official brackets', () => {
    expect(membersMissingEntry([{ id: 'a' }], []).map((m) => m.id)).toEqual(['a']);
  });

  it('clears a member whose official bracket is fully filled', () => {
    expect(membersMissingEntry([{ id: 'a' }], [{ userId: 'a', picks: full }])).toEqual([]);
  });

  it('flags a member whose only official bracket is half-filled', () => {
    expect(membersMissingEntry([{ id: 'a' }], [{ userId: 'a', picks: half }]).map((m) => m.id)).toEqual(['a']);
  });

  it('clears a member with one half and one full official bracket', () => {
    const official = [{ userId: 'a', picks: half }, { userId: 'a', picks: full }];
    expect(membersMissingEntry([{ id: 'a' }], official)).toEqual([]);
  });

  it('returns the same member objects (preserves username/email for rendering)', () => {
    const m = { id: 'a', username: 'ann' };
    expect(membersMissingEntry([m], [])[0]).toBe(m);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/admin-stats.test.ts`
Expected: FAIL — `Cannot find module './admin-stats'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/admin-stats.ts
import { countFilledBrackets } from '@/lib/pool-stats';

/**
 * Members who have NO fully-filled official bracket — i.e. they're in the pool (hold credits)
 * but haven't completed an entry. Generic so the caller gets its own row objects back, keeping
 * username/name/email for rendering. "Filled" reuses countFilledBrackets (all 31 games picked).
 */
export function membersMissingEntry<T extends { id: string }>(
  members: T[],
  officialBrackets: { userId: string; picks: unknown }[],
): T[] {
  const byUser = new Map<string, { picks: unknown }[]>();
  for (const b of officialBrackets) {
    const list = byUser.get(b.userId);
    if (list) list.push({ picks: b.picks });
    else byUser.set(b.userId, [{ picks: b.picks }]);
  }
  return members.filter((m) => countFilledBrackets(byUser.get(m.id) ?? []) === 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/admin-stats.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-stats.ts src/lib/admin-stats.test.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(admin): membersMissingEntry helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: "Haven't submitted" panel on /admin

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `membersMissingEntry` (Task 1); existing `db`, the page's `all` users query.
- Produces: a new panel listing the missing members.

- [ ] **Step 1: Add the import + compute the list** — in `src/app/admin/page.tsx`, add the import and, after the existing `const members = all.filter((u) => !u.isAdmin);` line, compute the missing members from the users already loaded plus their official brackets.

Add to the imports (top of file):
```tsx
import { membersMissingEntry } from '@/lib/admin-stats';
```

After `const members = all.filter((u) => !u.isAdmin);` add:
```tsx
  // In-pool members (credits ≥ 1) who haven't completed an official entry yet.
  const poolMembers = members.filter((u) => u.credits > 0);
  const officialBrackets = await db.bracket.findMany({
    where: { official: true, userId: { in: poolMembers.map((m) => m.id) } },
    select: { userId: true, picks: true },
  });
  const notSubmitted = membersMissingEntry(poolMembers, officialBrackets);
```

- [ ] **Step 2: Render the panel** — insert this `<section>` immediately after the closing `</section>` of the "Pending approval" panel and before the "Admins" panel:

```tsx
      <section className="panel reveal reveal-3" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h2>Haven&apos;t submitted</h2>
          <span className="pill">{notSubmitted.length} to chase</span>
        </div>
        {notSubmitted.length === 0 ? (
          <p className="muted">Everyone in the pool has a completed bracket. 🎉</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Username</th><th>First</th><th>Last</th><th>Email</th></tr></thead>
            <tbody>
              {notSubmitted.map((u) => (
                <tr key={u.id}>
                  <td data-label="Username">@{u.username}</td>
                  <td data-label="First">{u.firstName}</td>
                  <td data-label="Last">{u.lastName}</td>
                  <td data-label="Email" className="muted" style={{ fontSize: '0.84rem' }}>{u.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
```

(The `all` query already selects `id, username, firstName, lastName, email, isAdmin, status, credits`, so `notSubmitted` rows have every field the panel renders.)

- [ ] **Step 3: Verify the gate**

Run: `npx tsc --noEmit && npx vitest run && npx next lint`
Expected: tsc + lint clean; all tests pass (incl. Task 1's 5). The controller separately runs `rm -rf .next && npx next build` and confirms `/admin` builds.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(admin): Haven't-submitted panel on /admin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Definition (non-admin, credits ≥ 1, no filled official bracket) → Task 2 Step 1 (`poolMembers` = `!isAdmin && credits > 0`) + Task 1 (`membersMissingEntry` = no filled official). ✅
- Pure `membersMissingEntry` reusing `countFilledBrackets`, generic over `{ id }` → Task 1. ✅
- "Haven't submitted" panel near the top with a count pill + username/first/last/email rows + empty state, read-only, English → Task 2 Step 2. ✅
- Data flow: page loads non-admin credit-holders + their official brackets, filters via the helper → Task 2 Step 1. ✅
- TDD the helper (none → missing; full → not; half → missing; half+full → not) → Task 1 Step 1. ✅
- No schema / no i18n → Global Constraints. ✅

**Placeholder scan:** none — every step has complete code/commands. ✅

**Type consistency:** `membersMissingEntry<T extends { id: string }>` (Task 1) is called with `poolMembers` (rows that have `id`) and `officialBrackets` (`{ userId, picks }[]`) in Task 2 — matching the signature; the returned rows keep their `username`/`firstName`/`lastName`/`email` (generic `T`), which the panel renders. ✅
