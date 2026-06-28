# Admin Bracket-Lock Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins set/override the bracket lock time (and lock/reopen on demand) from `/admin/bracket`, without editing `LOCK_LEAD_MS` and redeploying.

**Architecture:** Add a nullable `PoolConfig.lockOverrideIso`. `getOfficialBracket()` — the single source of `lockTimeIso` every consumer reads — returns `override ?? computeLockTime(kickoffs)`, so the override propagates everywhere. Two admin actions write the override (`setLockOverride`/`clearLockOverride`) and one reads the lock state (`getLockState`) for the panel UI.

**Tech Stack:** Next.js 15.5 App Router, Prisma 6 + Neon, React 19. Spec: `docs/superpowers/specs/2026-06-28-admin-bracket-lock-design.md`.

## Global Constraints

- **Admin screens stay English** — no i18n keys for this feature.
- **Actions are admin-guarded** via `requireAdmin()` (`@/app/actions/admin`), matching `setR32Skeleton`/`setEntryPrice`.
- **No new pure logic** — the override is a one-line `??`; this is schema + glue + UI. Keep the existing `src/lib/lock.test.ts` green. Verify by `npx tsc --noEmit`, `npx next lint`, `npx next build` (+ a manual check). No new unit tests.
- **Reuse existing helpers:** `formatLockTimePT` (`@/lib/lock`), `isoToLocalInput`/`localInputToIso` (`@/lib/datetime-local`).
- **⚠ Windows/Prisma:** stop the dev server before `prisma db push`/`generate` (it locks `query_engine-windows.dll.node`). `db push` writes the live Neon DB; the column is additive + nullable (no backfill).
- **Commits:** author `Oswaldo Gonzalez <Oswaldo@calvada.local>`; end every message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (use `git -c user.name=... -c user.email=...`).

---

### Task 1: Schema — `PoolConfig.lockOverrideIso`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `PoolConfig.lockOverrideIso: DateTime?`; the generated client exposes `lockOverrideIso` on `db.poolConfig`.

- [ ] **Step 1: Add the field** — in `prisma/schema.prisma`, add to `model PoolConfig` (after `entryCents`):

```prisma
  lockOverrideIso DateTime?  // admin lock-time override; null = use the computed schedule
```

- [ ] **Step 2: Push schema + regenerate** (stop the dev server first)

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema" + "Generated Prisma Client". (Writes live Neon; additive nullable column.)

- [ ] **Step 3: Verify the client types compile**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(db): add PoolConfig.lockOverrideIso for admin lock override

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Override-aware lock + admin actions

**Files:**
- Modify: `src/app/actions/bracket.ts`

**Interfaces:**
- Consumes: `PoolConfig.lockOverrideIso` (Task 1); existing `computeLockTime` + `isLocked` (`@/lib/lock`), `requireAdmin`, `db`, `revalidatePath`.
- Produces:
  - `getOfficialBracket()` — unchanged signature, but `lockTimeIso` is now `lockOverrideIso ?? computeLockTime(kickoffs)`.
  - `setLockOverride(iso: string): Promise<{ error?: string }>`
  - `clearLockOverride(): Promise<{ error?: string }>`
  - `getLockState(): Promise<{ overrideIso: string | null; scheduledIso: string | null; effectiveIso: string | null; locked: boolean }>`

- [ ] **Step 1: Make `getOfficialBracket` override-aware** — in `src/app/actions/bracket.ts`, change the import on line 15 and the lock computation at the end of `getOfficialBracket`.

Change the lock import:
```ts
import { computeLockTime, isLocked } from '@/lib/lock';
```

Replace the tail of `getOfficialBracket` (the `const r32Kickoffs … return { slots, lockTimeIso … }` block) with:
```ts
  const r32Kickoffs = rows.filter((r) => r.round === 'R32').map((r) => r.kickoff);
  const scheduled = computeLockTime(r32Kickoffs);
  const config = await db.poolConfig.findUnique({ where: { id: 'default' }, select: { lockOverrideIso: true } });
  const lockTime = config?.lockOverrideIso ?? scheduled; // admin override wins
  return { slots, lockTimeIso: lockTime ? lockTime.toISOString() : null };
```

- [ ] **Step 2: Append the three actions** to the end of `src/app/actions/bracket.ts`:

```ts
/** Set the bracket lock to a specific instant (admin). Powers "Set lock time" and "Lock now". */
export async function setLockOverride(iso: string): Promise<{ error?: string }> {
  await requireAdmin();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { error: 'Invalid date.' };
  await db.poolConfig.upsert({
    where: { id: 'default' },
    update: { lockOverrideIso: d },
    create: { id: 'default', lockOverrideIso: d },
  });
  revalidatePath('/');
  revalidatePath('/bracket');
  revalidatePath('/admin/bracket');
  return {};
}

/** Clear the override so the lock reverts to the computed schedule (kickoff − lead). */
export async function clearLockOverride(): Promise<{ error?: string }> {
  await requireAdmin();
  await db.poolConfig.upsert({
    where: { id: 'default' },
    update: { lockOverrideIso: null },
    create: { id: 'default' },
  });
  revalidatePath('/');
  revalidatePath('/bracket');
  revalidatePath('/admin/bracket');
  return {};
}

/** Lock state for the admin panel: the override, the computed schedule, the effective lock, and whether it's locked now. */
export async function getLockState(): Promise<{
  overrideIso: string | null;
  scheduledIso: string | null;
  effectiveIso: string | null;
  locked: boolean;
}> {
  await requireAdmin();
  const rows = await db.match.findMany({ where: { round: 'R32' }, select: { kickoff: true } });
  const scheduled = computeLockTime(rows.map((r) => r.kickoff));
  const config = await db.poolConfig.findUnique({ where: { id: 'default' }, select: { lockOverrideIso: true } });
  const override = config?.lockOverrideIso ?? null;
  const effective = override ?? scheduled;
  return {
    overrideIso: override ? override.toISOString() : null,
    scheduledIso: scheduled ? scheduled.toISOString() : null,
    effectiveIso: effective ? effective.toISOString() : null,
    locked: isLocked(new Date(), effective),
  };
}
```

- [ ] **Step 3: Verify types, lint, and that existing lock tests still pass**

Run: `npx tsc --noEmit && npx next lint && npx vitest run src/lib/lock.test.ts`
Expected: tsc + lint clean; lock tests pass (8/8 — `computeLockTime`/`isLocked` are untouched). Do NOT run `next build` or `next dev` (the controller runs builds; a dev server would re-lock Prisma).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/bracket.ts
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(admin): lock override actions + override-aware getOfficialBracket

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Admin "Bracket lock" panel

**Files:**
- Create: `src/app/admin/bracket/LockControl.tsx`
- Modify: `src/app/admin/bracket/page.tsx`

**Interfaces:**
- Consumes: `setLockOverride`/`clearLockOverride`/`getLockState` (Task 2); `formatLockTimePT` (`@/lib/lock`), `isoToLocalInput`/`localInputToIso` (`@/lib/datetime-local`).
- Produces: a "Bracket lock" panel at the top of `/admin/bracket`.

- [ ] **Step 1: Write `LockControl.tsx`** (client component)

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLockOverride, clearLockOverride } from '@/app/actions/bracket';
import { isoToLocalInput, localInputToIso } from '@/lib/datetime-local';
import { formatLockTimePT } from '@/lib/lock';

export default function LockControl({
  overrideIso,
  scheduledIso,
  effectiveIso,
  locked,
}: {
  overrideIso: string | null;
  scheduledIso: string | null;
  effectiveIso: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<string>(() => isoToLocalInput(effectiveIso ?? ''));
  const [error, setError] = useState<string | null>(null);

  const fmt = (iso: string | null) => (iso ? formatLockTimePT(new Date(iso)) : '—');

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function save() {
    const iso = localInputToIso(local);
    if (!iso) { setError('Pick a date and time first.'); return; }
    run(() => setLockOverride(iso));
  }

  return (
    <div>
      <p className="lead" style={{ margin: '0 0 8px' }}>
        Lock: <strong>{fmt(effectiveIso)}</strong>{' '}
        <span className="pill">{locked ? 'Locked now' : 'Open now'}</span>{' '}
        <span className="muted">({overrideIso ? 'manual override' : 'on schedule'})</span>
      </p>
      {overrideIso && (
        <p className="muted" style={{ margin: '0 0 10px' }}>
          Schedule would be {fmt(scheduledIso)} (first kickoff − lead).
        </p>
      )}
      <div className="savebar" style={{ position: 'static', background: 'none', paddingBottom: 0, gap: 10, flexWrap: 'wrap' }}>
        <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} style={{ maxWidth: 240 }} />
        <button type="button" disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Set lock time'}</button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setLockOverride(new Date().toISOString()))}>
          Lock now
        </button>
        {overrideIso && (
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => clearLockOverride())}>
            Use schedule
          </button>
        )}
      </div>
      {error && <span className="banner error" style={{ display: 'inline-block', marginTop: 10, padding: '6px 12px' }}>{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `page.tsx`** — in `src/app/admin/bracket/page.tsx`, add the imports and read `getLockState`, then render a new panel directly after the `<header>` (above the `RefreshResultsButton` section).

Add to the imports at the top:
```tsx
import { getOfficialBracket, getLockState } from '@/app/actions/bracket';
import LockControl from './LockControl';
```
(`getOfficialBracket` is already imported — merge `getLockState` into that existing import line rather than duplicating it.)

After the existing `const { slots } = await getOfficialBracket();` line, add:
```tsx
  const lockState = await getLockState();
```

Insert this panel immediately after the closing `</header>` and before the `<section className="panel reveal" style={{ marginBottom: 18 }}><RefreshResultsButton /></section>`:
```tsx
      <section className="panel reveal" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Bracket lock</h2>
        <LockControl {...lockState} />
      </section>
```

- [ ] **Step 3: Verify the full gate** (controller runs the build)

Run: `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: tsc + lint clean; all tests pass (229, none affected). The controller separately runs `rm -rf .next && npx next build` and confirms `/admin/bracket` builds.

- [ ] **Step 4: Manual check** (after the controller's build, on the running app)

Set a lock time in the panel → the home countdown + `/bracket` lock state reflect it; "Lock now" → `/bracket` editing is blocked; "Use schedule" → reverts to kickoff − lead. (Done by the controller/user, not the implementer.)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/bracket/LockControl.tsx src/app/admin/bracket/page.tsx
git -c user.name="Oswaldo Gonzalez" -c user.email="Oswaldo@calvada.local" commit -m "feat(admin): Bracket lock panel on /admin/bracket

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `PoolConfig.lockOverrideIso` → Task 1. ✅
- Effective lock = `override ?? computed`, injected at the single point (`getOfficialBracket`) → Task 2 Step 1. ✅
- `setLockOverride` (Set lock time + Lock now), `clearLockOverride` (Use schedule), `getLockState` → Task 2 Steps 2. ✅
- Admin "Bracket lock" panel: effective lock + override-vs-schedule + locked/open, datetime input + 3 buttons, English, reuses `datetime-local`/`formatLockTimePT` → Task 3. ✅
- Migration `db push` (additive, dev-server-stopped) → Task 1 + Global Constraints. ✅
- No new pure logic; existing `lock.test.ts` stays green; tsc/lint/build + manual → Task 2/3 verify steps. ✅
- Edge cases (past → locked, future → open, null → schedule, invalid → error) → `setLockOverride` validation + `effective ?? scheduled` semantics. ✅

**Placeholder scan:** none — every step has complete code/commands. ✅

**Type consistency:** `getLockState`'s return `{ overrideIso, scheduledIso, effectiveIso, locked }` is spread directly into `LockControl`'s identically-named props (Task 3). `setLockOverride(iso: string)` / `clearLockOverride()` signatures match the `LockControl` call sites. `getOfficialBracket`'s return type is unchanged (only the value of `lockTimeIso` changes), so its many consumers are unaffected. ✅
