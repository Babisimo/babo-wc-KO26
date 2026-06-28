# Brackets-based pot — design

_2026-06-28_

## Goal

Make the pot and the header pill count **brackets entered**, not credits/players. Remove the
confusing "players" number entirely.

## Background

Today the pot is **credits-based**: `computePoolStats(users, entryCents)` counts `players` =
users with `credits > 0`, `entries` = sum of credits, `potCents = entries × entryCents`. The
header pill shows both a "players" count and a brackets count, which mismatch whenever a player
holds more than one credit (e.g. "19 players · 18/20 brackets"). The pot is also inflated by a
paid credit even before that bracket is actually entered.

## Model

**"Brackets in" = the number of official brackets** (`Bracket.official = true`). **Pot = $50 ×
brackets in** (`bracketsIn × entryCents`). No "players" anywhere. (Equals the current number
today; the only behavioral change is that an unused paid credit no longer counts toward the pot
until that bracket is marked official.)

Credits/allowance are unchanged — admins still grant credits to let people enter brackets; only
the **pot computation and display** switch to counting entered brackets.

## Changes

### `src/lib/pool-stats.ts` (pure, tested)
- Rework `computePoolStats` to `computePoolStats(bracketsIn: number, entryCents: number):
  { bracketsIn: number; potCents: number }`, where `potCents = bracketsIn × entryCents`.
- Drop the `players`/`entries` (credits) concepts. `PoolStats` becomes `{ bracketsIn, potCents }`;
  `PoolHeaderStats` becomes `{ bracketsIn, filled, potCents, entryCents }`.
- `countFilledBrackets(brackets)` is unchanged.

### `src/app/actions/pool.ts` (`getPoolStats`)
- Fetch only the official brackets + `PoolConfig` (drop the `users where credits > 0` query).
- `bracketsIn = official.length`, `filled = countFilledBrackets(official)`,
  `potCents = bracketsIn × entryCents`. Return `{ bracketsIn, filled, potCents, entryCents }`.

### `src/app/actions/leaderboard.ts`
- It already fetches the official brackets. Set the pot from **their count**:
  `potCents = brackets.length × entryCents` (via the reworked `computePoolStats(brackets.length,
  entryCents)`). Drop the `creditUsers` query and the unused `players` field from `LeaderboardData`.
- `potSplit(entries, potCents)` and everything else (ranking, winners, champions) are unchanged —
  only the value of `potCents` differs.

### `src/app/_components/PoolPill.tsx` + i18n
- Headline: `$pot · filled/in` (filled / brackets-in).
- Popover: `in × $entry = $pot` and `filled/in`. **Remove the "players" line.**
- i18n: drop `nav.poolPlayers`; update `nav.pool` / `nav.poolAria` / `nav.poolBreakdown` /
  `nav.poolFilled` to use a `bracketsIn` variable and "brackets in" wording (EN + ES, Sonoran;
  drift-guard enforced). The pill's prop is `PoolHeaderStats`, so it reads `pool.bracketsIn`/
  `pool.filled`/`pool.potCents`/`pool.entryCents`.

### Home leaderboard pot pill
- No code change — `HomeContent` reads `board.potCents` (now brackets-based) for the pot pill and
  `board.winnerKeys`/`shareCents` for the split. Confirm `HomeContent` does not reference the
  removed `board.players` (it doesn't today).

## Testing

- TDD the reworked `computePoolStats` (pure): pot = bracketsIn × entryCents; 0 brackets → $0.
- Update `src/lib/pool-stats.test.ts` (the old `players`/`entries` cases) to the new signature;
  keep the `countFilledBrackets` tests.
- Glue/UI (pool.ts, leaderboard.ts, PoolPill, i18n) verified by `tsc`/`lint`/`build`; the i18n
  drift-guard + `i18n.test.ts` enforce EN/ES parity.

## Edge cases

- 0 official brackets → `bracketsIn = 0`, pot `$0`, `0/0` filled.
- A player with 2 credits but 1 official bracket → counts as **1** bracket in (the unentered slot
  doesn't count). This is the intended behavior change.

## Out of scope (YAGNI)

No change to credits/allowance, to how brackets are marked official, or to the leaderboard ranking.
Only the pot basis (credits → entered brackets) and the pill display (drop players) change.
