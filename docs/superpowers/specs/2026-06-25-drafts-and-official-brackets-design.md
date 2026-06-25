# Drafts + Designate-Official Brackets — Design

_2026-06-25_

## Problem

Two limitations block users right now:

1. **Can't start early.** Filling/creating a bracket requires the *entire* official
   Round-of-32 draw to be set (`officialReady`). The group stage ends ~June 27, so users
   can't build anything until then.
2. **Every bracket is an immediate paid entry.** Creating a bracket spends a credit and
   counts in the pot/leaderboard. There is no "draft" — no way to try several and pick one.

## Goals

- Let users build brackets **now** using whatever is confirmed, with the rest filled from the
  live "as-it-stands" projection, and **warn** them when real results later change a matchup.
- Let users create **multiple free drafts** and **designate** which one(s) are **official**
  (paid, counted). Up to `credits` official brackets; switchable freely until lock.

## Decisions (from brainstorming)

- **Official count per user:** up to their `credits`.
- **Switching:** free to toggle official on/off until lock; the official set freezes at lock.
- **Early fill:** seed from confirmed + as-it-stands; flag brackets when matches change.
- Drafts are unlimited. An official bracket left incomplete at lock just scores the picks it
  has (no auto-demote, no refund — decisions are final).

## Model

- Schema: add `Bracket.official Boolean @default(false)`. Only change.
- `credits` stays the allowance (never decremented). Rule: a user may have at most `credits`
  brackets with `official = true`. Marking official requires `officialCount < credits`.
- Migration `prisma/backfill-official.ts`: set `official = true` for all existing brackets so
  the current pot/leaderboard is unchanged.

## Effective R32 (the "start now" engine)

Per R32 slot (1..16), resolve teams + a `confirmed` flag:

1. Official `Match` R32 slot has both teams → use it, `confirmed = true` (never drifts).
2. Else projection available → use **as-it-stands** team(s), `confirmed = false` (provisional).
3. Else → `null` / TBD (not yet pickable).

- `lib/effective-r32.ts` — `mergeEffectiveR32(officialR32, projectedR32, confirmedR32)` →
  `{ r32: OfficialR32; confirmed: Record<number, boolean> }` (pure, tested).
- `actions/projection.ts` — add `getProjectedR32()` returning the raw `{ projected, confirmed }`
  OfficialR32 maps (reuses `seedR32`); returns nulls when ESPN is unavailable.

## Change detection

- `lib/bracket-changes.ts` — `stalePicks(effectiveR32, picks): number[]`: slots whose saved
  pick is no longer one of that slot's current contestants. Recomputed on view (no snapshot).
- A bracket with `stalePicks.length > 0` shows a warning + the stale slots are highlighted.
  Confirmed slots never produce stale picks.

## Validation

- `lib/bracket-validate.ts` — add `validateDraft(effectiveR32, picks)`: every **present** pick
  must be a valid contestant; missing picks allowed. (`validateSubmission` unchanged, used to
  compute the Complete badge.)

## Server actions (`actions/bracket-entry.ts`)

- `createBracket` — drop `officialReady` + credit gates; keep lock gate; require approved user.
  Free, creates a draft.
- `saveBracket` — validate with `validateDraft` against the effective R32; allow partial; store
  sparse picks.
- `setBracketOfficial(id, official)` — ownership + not-locked; turning on enforces
  `canMarkOfficial(officialCount, credits)`.
- `listMyBrackets` — per row: `official`, `complete`, `staleCount`; plus `officialUsed`,
  `credits`. `getBracket` — add `official`, effective R32, `staleSlots`.

## Counting → official-only

- `actions/leaderboard.ts` — score only `official` brackets; `players` = official count;
  `pot = entryCents * officialCount`.
- `actions/browse.ts` — post-lock browse shows official only.
- `actions/compare.ts` — compare official only.

## UI

- `bracket/page.tsx` — remove the `NotOpen` gate; always render the list.
- `bracket/MyBrackets.tsx` — pill "Official X / credits"; per row: Make official / Official ✓
  toggle (disabled at cap), Partial/Complete badge, ⚠ changes badge; New bracket always shown.
- `bracket/BracketFill.tsx` — fill against effective R32 with TBD placeholders; allow partial
  save; changes warning + highlight stale slots; show + toggle official; info banner when the
  draw isn't final.

## Pure libs + tests

`canMarkOfficial` (bracket-credits), `mergeEffectiveR32` (effective-r32), `stalePicks`
(bracket-changes), `validateDraft` (bracket-validate); update `leaderboard.test.ts` for
official-only; add i18n keys (en+es, drift-guard enforced).

## Out of scope

Refunds, deleting brackets, capping draft count, storing R32 snapshots per bracket.
