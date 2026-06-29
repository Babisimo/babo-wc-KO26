# Leaderboard "who picked whom" for the current/up-next match — Design

_2026-06-29_

## Problem

The home leaderboard lists every official bracket by rank, name, owner and points. It
doesn't show **which team each bracket has riding on the matches that are happening now or
next**. The sibling group-stage app (`C:\Users\Oswaldo\wc26`) had this: a small color-coded
chip next to each player showing their pick for the soonest match(es). We want the knockout
equivalent: **under every bracket on the leaderboard, show the team that bracket picked for
each current/up-next knockout game.**

## Decisions (locked with the user)

- **Match scope:** show one chip per game in the **same set the "Next up" strip surfaces** —
  live now → soonest upcoming → most-recent finals, up to 3 (`pickGames`). The chips under
  each row line up, in order, with the games shown in that strip directly above the
  leaderboard.
- **Chip style:** **country flag + 3-letter code** (on-brand with the app's `flag-icons`).
  A decided slot colors the chip: green **✓** if that bracket's pick won the slot, red **✗**
  if it busted, neutral while pending.
- **Privacy / lock gate:** picks are private until lock (the pool-consensus bars are already
  `null` pre-lock for this reason). **The pick chips render only once brackets are locked.**
  Pre-lock the leaderboard looks exactly as it does today.

## Architecture

Three small, well-bounded pieces plus a thin render change. No schema change.

### 1. Pure core — `src/lib/leaderboard-picks.ts` (unit-tested)

```ts
import { gameSlotPick, type SlotParticipants, type PickResult } from '@/lib/game-slot';
import type { Game } from '@/lib/next-games';
import type { Picks } from '@/lib/bracket-picks';

export type GamePickHeader = { teamA: string; teamB: string; state: Game['state'] };
export type GamePickCell = { code: string; result: PickResult } | null; // null = no pick
export type LeaderboardPicks = {
  headers: GamePickHeader[];                 // surfaced games, in strip order (slot-matched only)
  cellsByKey: Record<string, GamePickCell[]>; // bracket id -> one cell per header, same order
};

export function buildLeaderboardPicks(
  slots: SlotParticipants[],
  games: Game[],
  brackets: { key: string; picks: Picks }[],
  winners: Record<number, string | null>,
): LeaderboardPicks
```

- Keeps only surfaced games that map to a known official slot (a game whose two teams match a
  slot's `teamA`/`teamB`). Those become `headers` in the given order.
- For each kept game × each bracket, calls the existing `gameSlotPick(slots, game, picks,
  winners)` → `{ yourPick, result }`. Cell = `yourPick ? { code: yourPick, result } : null`.
- Pure, no I/O. Reuses the slot↔fixture matching and win/bust logic that already powers the
  strip's "your pick" — no second copy of that rule.

### 2. Shared scoreboard fetch — `src/app/actions/scoreboard.ts`

Extract the ESPN scoreboard fetch + parse + surface that today lives inline in
`getNextGames` into one helper, so the leaderboard and the strip share it (removes the
duplicate `SCOREBOARD`/`DATES`/`resolveTeam`/`mapScoreboardGames`/`pickGames` block rather
than adding a second one):

```ts
export async function fetchSurfacedGames(): Promise<Game[]>
```

Same URL, `DATES`, `resolveTeam`, and `{ next: { revalidate: 15 } }` cache as today; returns
`pickGames(mapScoreboardGames(...))`, or `[]` on any fetch/parse failure. `getNextGames` is
refactored to call this (behavior unchanged).

### 3. Leaderboard action — `src/app/actions/leaderboard.ts`

- Add `getOfficialBracket()` to the existing `Promise.all` (gives `slots` + `lockTimeIso`).
- After ranking, compute the lock state (`isLocked`). **Only when locked**, call
  `fetchSurfacedGames()` and `buildLeaderboardPicks(slots, games, brackets→{key,picks},
  winners)`. Pre-lock, return empty `{ headers: [], cellsByKey: {} }`.
- Add `nextPicks: LeaderboardPicks` to `LeaderboardData`. (`RankedEntry` is untouched; the
  pick cells are keyed by bracket id = the entry `key`.)

### 4. Render — `src/app/HomeContent.tsx` + CSS + i18n

- When `board.nextPicks.headers.length > 0`, show a compact caption above the table naming
  the surfaced matchups in order, e.g. **"Picks · GER v PAR · FRA v SWE"** (codes only, so
  the per-row chip order is legible).
- In each row's `lb-id` block, after `lb-owner`, render a `lb-picks` chip line from
  `board.nextPicks.cellsByKey[e.key]`: one chip per header, in order.
  - Pick present → `<TeamFlag code> CODE` with class `won` / `busted` / `pending` and an
    `sr-only` "survived" / "didn't advance" for decided slots (reuse `home.pickWon` /
    `home.pickBusted`).
  - No pick (cell `null`) → a muted `–` placeholder so columns stay aligned.
- New CSS in `globals.css`: `.lb-picks` (wrapping flex row), `.lb-pick` (chip), `.lb-pick.won`
  / `.busted` / `.pending` / `.none`, `.lb-picks-cap` (caption) — modeled on the existing
  `.lb-*` and result-color tokens.
- New i18n keys (EN + ES, drift-guard enforced): `home.picksCap` (caption label "Picks").
  Win/bust wording reuses the existing `home.pickWon` / `home.pickBusted`.

## Data flow

`page.tsx` → `getLeaderboard()` (now also fetches official draw + surfaced games when locked)
→ `LeaderboardData.nextPicks` → `HomeContent` renders caption + per-row chips. The strip's own
data path (`getNextGames` → `/api/next-games` poll) is unchanged; both now call
`fetchSurfacedGames()`.

Note: the leaderboard chips are **server-rendered** (refresh on navigation), like the
movement/drama line — not live-polled like the strip. Acceptable for v1; a future fast-follow
could fold them into the 30s poll.

## Error handling

- Scoreboard unreachable → `fetchSurfacedGames()` returns `[]` → `headers` empty → no chip
  line, leaderboard unaffected (same fallback the strip already uses).
- Bracket left a slot blank, or a surfaced game has no matching official slot → that cell is
  `null` (placeholder) / that game is dropped from `headers`. No crash, no misattribution.
- Pre-lock → `nextPicks` empty by construction; no pick data leaves the server.

## Testing

- `src/lib/leaderboard-picks.test.ts` (TDD, pure):
  - headers built in game order, only for slot-matched games;
  - per-bracket cell = picked team with `pending` (no winner), `won` (winner === pick),
    `busted` (winner !== pick);
  - `null` cell when the bracket didn't pick that slot;
  - a surfaced game with no matching slot is excluded from headers and all cells.
- Full suite (`vitest`), `tsc --noEmit`, `next lint`, `next build` (rm -rf .next first on
  Windows) must stay green. i18n drift-guard must compile (EN/ES parity).

## Out of scope (YAGNI)

- Live polling of the chips (server-rendered v1, matching the existing movement line).
- Showing picks pre-lock (privacy invariant).
- Per-row mapping UI fancier than the ordered caption.
