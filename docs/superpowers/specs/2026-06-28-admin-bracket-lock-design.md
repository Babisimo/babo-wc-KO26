# Admin bracket-lock control — design

_2026-06-28_

## Goal

Give admins a control on `/admin/bracket` to **set/override the bracket lock time** and **lock
or reopen brackets on demand** — without editing `LOCK_LEAD_MS` in code and redeploying.

## Background

Today the lock is computed only: `getOfficialBracket()` (in `src/app/actions/bracket.ts`) returns
`lockTimeIso = computeLockTime(r32Kickoffs)` = earliest R32 kickoff − `LOCK_LEAD_MS`. Every
lock consumer reads `official.lockTimeIso`: pick editing/`saveBracket`, `setBracketOfficial`,
`renameBracket` (`bracket-entry.ts`), `browse.ts`, `compare.ts`, the home countdown + `LockGate`,
and the games strip (`next-games.ts`). Changing the lock therefore meant a code change + deploy.

## Data model

Add one nullable column to the existing singleton `PoolConfig`:

```prisma
model PoolConfig {
  ...
  lockOverrideIso DateTime?   // admin lock-time override; null = use the computed schedule
}
```

**Effective lock = `lockOverrideIso ?? computeLockTime(kickoffs)`.** A `null` override means
"automatic" (kickoff − `LOCK_LEAD_MS`), exactly as today.

## Single integration point

`getOfficialBracket()` is the only place that computes `lockTimeIso`. Change it to read
`PoolConfig.lockOverrideIso` and return the override when set, else the computed time:

```ts
const lockTime = config?.lockOverrideIso ?? computeLockTime(r32Kickoffs);
return { slots, lockTimeIso: lockTime ? lockTime.toISOString() : null };
```

Because every consumer reads `official.lockTimeIso`, the override propagates everywhere with no
other code changes. "Locked now" is still `isLocked(now, effectiveLock)` — unchanged.

## Admin actions

In `src/app/actions/bracket.ts` (admin-guarded via `requireAdmin`, like `setR32Skeleton`):

- `setLockOverride(iso: string): Promise<{ error?: string }>` — validate `iso` parses to a real
  date; write `PoolConfig.lockOverrideIso`. Powers **"Set lock time"** (a chosen datetime) and
  **"Lock now"** (iso = the current time → immediately locked). Reopen/extend = set a future time.
- `clearLockOverride(): Promise<{ error?: string }>` — set `lockOverrideIso = null`
  (**"Use schedule"**, back to kickoff − lead).

Both `revalidatePath('/')`, `'/bracket'`, `'/admin/bracket'` so the new lock shows immediately.
Writes use `db.poolConfig.upsert({ where: { id: 'default' }, ... })` (same pattern as `setEntryPrice`).

## Admin UI

A new **"Bracket lock"** panel at the top of `/admin/bracket` (`src/app/admin/bracket/`), a client
component fed by the page's server-read state. It shows:

- **Current effective lock**: the formatted time (`formatLockTimePT`), whether it's **from an
  override or the schedule**, and **Locked / Open right now**.
- A **datetime-local input** + **Set lock time** button → `setLockOverride` (convert local→ISO with
  the existing `localInputToIso` from `src/lib/datetime-local.ts`; seed the input from the current
  effective lock via `isoToLocalInput`).
- **Lock now** button → `setLockOverride(new Date().toISOString())`.
- **Use schedule** button → `clearLockOverride`, shown only when an override is active; labels the
  schedule time it will revert to (the computed kickoff − lead).

Admin screens stay **English** (project convention) — no i18n keys. Styling reuses the existing
admin panel/`savebar`/button classes.

To feed the panel without overloading `getOfficialBracket`'s widely-used return type, add a small
admin read `getLockState(): Promise<{ overrideIso: string | null; scheduledIso: string | null;
effectiveIso: string | null; locked: boolean }>` (in `actions/bracket.ts`): `scheduledIso` =
`computeLockTime(kickoffs)`, `overrideIso` = `PoolConfig.lockOverrideIso`, `effectiveIso` =
`overrideIso ?? scheduledIso`, `locked` = `isLocked(now, effectiveIso)`. The page reads this and
passes it to the panel. (`getOfficialBracket` itself changes only to make its `lockTimeIso`
override-aware, so all the non-admin consumers get the override.)

## Migration

`prisma db push` adds the nullable `lockOverrideIso` column (additive, no backfill). **Stop the dev
server first** (Windows locks the Prisma engine DLL). This writes the live Neon DB.

## Testing

No new *pure logic* — the override is a one-line `??` in `getOfficialBracket`, and validation lives
in the (glue) action. So: keep the existing `lock.test.ts` green, and verify the feature by
`tsc`/`lint`/`build` + a manual check (set an override → confirm the home countdown + `/bracket`
lock state change; clear it → reverts to the schedule). The pre-existing `computeLockTime`/`isLocked`
behavior is unchanged and stays covered.

## Edge cases / behavior

- Override in the **past** → locked immediately (this is "Lock now").
- Override in the **future** → open until then (reopen/extend).
- Override **null** → automatic (kickoff − lead); if no kickoffs, lock is null ("not open yet").
- Invalid datetime submitted → action returns an error; no write.
- The override applies to **everything that reads the lock** (picks, official toggle, rename,
  browse/compare visibility, countdown, games strip) — consistent by construction.

## Out of scope (YAGNI)

No "open forever" toggle (reopen = set a future time, so it can't be left open by forgetting),
no lock history/audit log, no per-bracket locking, no i18n (admin is English).
