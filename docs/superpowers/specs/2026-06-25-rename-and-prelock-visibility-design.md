# Design: Rename brackets + pre-lock "who's in / pot" visibility

Date: 2026-06-25

## Goal

Two features for the WC26 knockout bracket app:

1. **Rename brackets** — let a user change the name of one of their brackets.
2. **Pre-lock pool visibility** — before the bracket locks, show *who is in* and *what the
   pot is* (a header pill + a participant roster on the Brackets page), while keeping each
   person's actual picks hidden until lock.

The point of feature 2: people can see how many players/entries are in and the size of the
pot while still being unable to copy each other's picks before lock.

## Background (current state)

- Next.js 15 App Router, React 19, Prisma 6 (PostgreSQL), NextAuth v5, Tailwind 4, custom
  EN/ES i18n (`src/lib/i18n.ts`), Vitest.
- A "bracket" is a per-user `Bracket` row (`prisma/schema.prisma`). `name` defaults to
  `"Bracket 1"`. There is no separate Pool/Member model — entries *are* Bracket rows.
- A bracket counts toward the pot only when `official: true`. Pot is computed in
  `src/app/actions/leaderboard.ts` as `entryCents × (# official brackets)`, with
  `entryCents` from the `PoolConfig` singleton (default $50).
- **Locking is computed, not stored.** `src/lib/lock.ts` derives the lock time as
  (earliest R32 `Match.kickoff`) − 1 hour. `isLocked(now, lockTime)` is the gate.
- Pick visibility is centralized in `src/lib/bracket-visibility.ts`:
  `canViewUserBracket({ isOwner, locked }) = isOwner || locked`.
- `src/app/actions/browse.ts` `getBracketsIndex()` currently returns
  `{ locked: false, entries: [] }` and never queries brackets when not locked — so the
  roster is hidden pre-lock today.
- Name normalization already exists: `normalizeBracketName()` in `src/lib/bracket-name.ts`
  (strips control chars, collapses whitespace, 32-char cap, blank → `"Bracket {index}"`).
- The global header is `src/app/Nav.tsx`, rendered by `src/app/layout.tsx` (a server
  component that already fetches the session).

## Feature 1 — Rename brackets

### Server action

Add `renameBracket(id, name)` to `src/app/actions/bracket-entry.ts`, mirroring
`createBracket`:

- Resolve the signed-in user; verify the target `Bracket.userId` matches (ownership).
- Block when locked via the existing `lockedNow()` helper; return the existing
  `bracket.err.locked*`-style error key on failure.
- Normalize the input with `normalizeBracketName(name, fallbackIndex)`.
- Update the row and return `{ name }` on success (or `{ errorKey }` on failure).

### UI — two entry points, both disabled when locked

- `src/app/bracket/MyBrackets.tsx` — inline rename in the bracket list: a pencil button
  toggles the name into a text input (`maxLength={32}`) with save/cancel; calls
  `renameBracket`.
- `src/app/bracket/BracketHeader.tsx` (`EditHeader`) — a pencil next to the `<h1>` title on
  the pick page, same inline edit + action.

Renaming is blocked once locked (same policy as editing picks), so leaderboard names stay
stable.

## Feature 2 — Header pool pill + pre-lock participant roster

### Header pill (global nav)

Show a pill in `Nav.tsx` reading `10 players / 14 entries · $700 pot`:

- Count basis is **official entries**, so the pot always reconciles. "Players" = distinct
  users with ≥1 official entry; "entries" = count of official brackets.
- Visible to signed-in users, both before and after lock.
- Links to `/brackets`.

New pure helper `computePoolStats(officialBrackets, entryCents)` →
`{ players, entries, potCents }`, unit-tested. `layout.tsx` fetches the official brackets
(or an aggregate) once per navigation and passes `{ players, entries, potCents }` to `Nav`.

### Participant roster before lock (`/brackets`)

Relax `getBracketsIndex()` in `src/app/actions/browse.ts`:

- When **not** locked, return the roster of official entries: display name + entry count
  per player, with `locked: false`. Do **not** include picks or scores.
- When locked, behavior is unchanged (existing per-player table with scores).

Update `IndexBody` in `src/app/brackets/BrowseText.tsx` to render the pre-lock roster
(Player / # entries) plus a "picks hidden until lock" note, replacing the current
"private" message. The score/best-score column appears only post-lock.

### Picks stay hidden

No change to `src/lib/bracket-visibility.ts`. `canViewUserBracket` still returns false for
non-owners pre-lock, so `getUserBracketView()` still withholds picks and a participant page
shows "picks hidden until lock." Only the roster + pot become visible early; the grids do
not.

## Data flow

```
layout.tsx  ─ computePoolStats(official brackets, entryCents) → Nav pill
/brackets   ─ getBracketsIndex() → pre-lock roster (names + counts; no picks/scores)
rename      ─ renameBracket(id, name) → normalizeBracketName → lock-gated db update
```

## Testing

- `computePoolStats` — unit tests: 0 entries; multiple entries per player (players ≠
  entries); pot = entries × entryCents.
- `renameBracket` — lock-gating (blocked when locked), ownership rejection, and name
  normalization, following existing action test patterns.
- i18n — add EN + ES keys for the pill (players/entries/pot), rename labels/errors, and the
  pre-lock roster strings.

## Out of scope (YAGNI)

- Live-polling the header pill — a per-navigation server fetch is sufficient.
- Renaming after lock.
- Any change to how official status, credits, or pot amounts are computed.
