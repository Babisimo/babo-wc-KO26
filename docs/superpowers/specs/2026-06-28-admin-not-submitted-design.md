# Admin "Haven't submitted" panel — design

_2026-06-28_

## Goal

Give admins a read-only list on `/admin` of the members who are **in the pool but haven't
completed an entry**, so they can chase them.

## Definition

A member is **missing** when all of these hold:
- not an admin (`isAdmin = false`),
- holds credits (`credits ≥ 1`) — i.e. they're in the pool / expected to enter,
- has **no official bracket with all 31 games picked** (covers both "never entered" and
  "entered but left it half-filled").

"Submitted" therefore means: at least one `official` bracket that is fully filled (31 picks).

## UI

A new **"Haven't submitted"** panel on `/admin` (same `panel`/`adm-table` styling as the
Pending/Members sections), placed near the top — it's the actionable list. Header with a **count
pill** (`N to chase`). One row per missing member: **username · first · last · email** (read-only,
no action buttons). Empty state when nobody is missing (e.g. "Everyone's in — all submitted.").

Admin screens stay **English** (project convention) — no i18n.

## Data flow

`admin/page.tsx` is already a `force-dynamic` server component. It:
1. Loads non-admin members with `credits > 0` (`id, username, firstName, lastName, email`).
2. Loads those members' **official** brackets' picks (`userId, picks`).
3. Filters to the missing members via a pure helper and renders the panel.

## Pure helper (TDD)

`src/lib/admin-stats.ts`:

- `membersMissingEntry<T extends { id: string }>(members: T[], officialBrackets: { userId: string;
  picks: unknown }[]): T[]` — returns the members who have **zero filled official brackets**.
  It groups the official brackets by `userId` and keeps a member when
  `countFilledBrackets(theirOfficialBrackets) === 0`, reusing the existing 31-games completeness
  rule from `countFilledBrackets` (`@/lib/pool-stats`) so "filled" means the same thing
  everywhere.

Generic over `T extends { id: string }` so the page can pass its member rows through and get the
same row objects back (preserving username/name/email for rendering).

## Testing

TDD `membersMissingEntry`:
- a member with no official brackets → missing,
- a member whose only official bracket has 31 picks → not missing,
- a member whose official bracket is half-filled (e.g. 10 picks) → missing,
- a member with one half-filled and one full official bracket → not missing.

The `admin/page.tsx` wiring is glue (verified by `tsc`/`lint`/`build`); the panel is read-only and
has no actions to test.

## Out of scope (YAGNI)

No "send reminder" action, no CSV export, no per-bracket detail, no schema change, no i18n. It only
reads and lists.
