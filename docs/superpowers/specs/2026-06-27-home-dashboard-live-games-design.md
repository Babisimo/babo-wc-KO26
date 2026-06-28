# Home dashboard + live games + results drama — design

_2026-06-27_

## Goal

Turn the home page from a generic marketing-ish stack (hero · big CTA · lock countdown ·
stage meter · leaderboard) into a focused **personal dashboard** centered on a live/upcoming
**games strip**. Replace the lock countdown, drop the signed-in "make your picks" CTA, and
declutter. Add results-aware hooks: each player's standing **movement** and a one-line
**"what just happened"** drama note when a game finishes.

## Scope & phases

Build in two phases; ship P1 first.

- **P1 — Dashboard:** the "Next up" games strip (with per-user "your pick" + ✓/✗), the
  standing line (rank + points, **no movement yet**), and live auto-refresh polling. No schema
  change.
- **P2 — Results drama:** `Bracket.previousRank` + a `ResultEvent` model, a snapshot hook in the
  results path, standing **movement** (▲/▼), and the **"what just happened"** note.

## Page composition

**Signed-in** (top → bottom):
1. Champion banner (existing; only renders once the Final is scored).
2. Tiny hero — title only (no lead paragraph, no CTA).
3. **Standing line** — `You: 3rd · 24 pts` (P1); `… ▲2` (P2). Hidden until the user has an
   official bracket and at least one game has scored.
4. **Next up** games strip.
5. **"What just happened"** note (P2). Hidden when there is no recent result.
6. Leaderboard panel (existing).

**Signed-out:** tiny hero → neutral games strip (no picks) → existing **log in / request
account** CTA. (Only the *signed-in* "make your picks" CTA is removed; the join CTA stays.)

`Countdown` and `StageTracker` are no longer rendered on home (components remain in the repo,
unused by `/`).

## P1 — "Next up" games strip

**Data source.** ESPN scoreboard, `…/sports/soccer/fifa.world/scoreboard?dates=<window>`
(already used for the R32 draw). Fields used per event: `event.date` (kickoff ISO),
`event.competitions[0].competitors[].team.{abbreviation,displayName}`, `.competitors[].score`,
`event.competitions[0].status.type.{state,shortDetail}` where `state ∈ {pre,in,post}`. Exact
field availability is confirmed during build; placeholder fixtures (e.g. "Round of 32 X
Winner") resolve to no team and are skipped (reuse the resolver style from `r32-fixtures.ts`).

**Which games (up to 3).** Live (`state=in`) first, then soonest upcoming (`state=pre`) by
kickoff, then fill with the most-recently-finished (`state=post`). Cap at 3.

**Per game row.**
- Two teams with flags (reuse `TeamFlag`/`team-flag.ts`), short + full names like the bracket
  cards.
- Status/time: `pre` → relative kickoff ("in 2h10m"); `in` → **LIVE** + current score; `post`
  → final score.
- **Your pick** (signed-in): the team the user has advancing from that game's slot — a gold
  tag. Once `post`, a **✓** if the pick advanced, **✗** if it busted.
- A subtle **"picks lock <when>"** line under the strip until lock time; dropped afterward
  (this carries the old countdown's only real information).

**Mapping a fixture → slot → pick.** The official draw is in the DB; `getOfficialBracket()`
returns each slot's current participants (`participantsForSlot` derives later-round teams from
recorded winners). Map a scoreboard fixture to the slot whose two participants equal the
fixture's two teams. The user's pick for that slot is `bracket.picks[slot]`. The advancing team
(for ✓/✗) is the official `Match.actualWinner` when set, else the scoreboard's final winner.

**Multiple official brackets.** "Your pick" and the standing use the user's **top-ranked
official bracket** (highest leaderboard rank; ties → first by name, matching `rankEntries`).
Users with no official bracket get the neutral strip and no standing line.

**Standing line (P1).** From the data `getLeaderboard()` already returns: find the user's
top-ranked official bracket → show its `rank` and `total`. Hidden if no official bracket or no
points on the board yet.

**Live auto-refresh.** `NextGames` is a client component that polls `GET /api/next-games`
every ~30s (model on the existing Nav notification polling: `force-dynamic`, keep last-known
value on transient errors, clear on unmount). The route returns the same view model the server
action builds.

## P2 — Results drama

**Movement.** Add `Bracket.previousRank Int?`. In the results-changing actions
(`refreshResults`, `setMatchWinner`), the code already computes the set of slots whose winners
changed. When that set is non-empty: compute the leaderboard ranking under the **pre-change**
winners and write each official bracket's current rank into `previousRank`, then persist the
new winners. The standing line shows `movement = previousRank − currentRank` as ▲n / ▼n / —
(nothing when `previousRank` is null).

**"What just happened".** Add a `ResultEvent` model storing **structured** data (not prose, so
it localizes):

```
ResultEvent { id, slot Int, winner String, loser String, bustedCount Int,
              newLeader String?, createdAt DateTime @default(now()) }
```

Written in the same results hook, one row per **newly decided** slot (a slot going from no
winner → a winner). `loser` = the slot's other participant; `bustedCount` = official brackets
whose `picks[slot]` was the loser; `newLeader` = the rank-1 player display **iff** #1 changed
because of this batch (else null). Home reads the latest event by `createdAt`; renders nothing
if none. Rendered via i18n, e.g. `⚡ {winner} beat {loser} — {n} brackets busted` plus, when
`newLeader` is set, ` · {leader} takes #1`.

## Architecture / units (each pure + unit-tested)

- `src/lib/next-games.ts` — `mapScoreboardGames(json, resolve)` → game view models
  (teams, kickoffIso, state, scores); and `pickGames(games, now)` → the ≤3 to show.
- `src/lib/game-slot.ts` — `gameSlotPick(slots, fixture, picks, winners)` → `{ slot, yourPick,
  result: 'pending'|'won'|'busted' }` (fixture→slot match + pick + ✓/✗).
- `src/lib/result-delta.ts` (P2) — `resultEvents(oldWinners, newWinners, officialSlots, brackets)`
  → `ResultEvent[]` for newly decided slots, incl. `bustedCount` and `newLeader`.
- `src/lib/standing.ts` — `myStanding(entries, myBracketKeys)` → `{ rank, total }` for the
  top-ranked bracket; `movement(previousRank, currentRank)` → `{ dir: 'up'|'down'|'same'|'none',
  n }`.

**Glue (not unit-tested):** `getNextGames(userId)` server action + `GET /api/next-games`;
`NextGames.tsx`, `YourStanding.tsx`, `WhatHappened.tsx` components; `HomeContent` restructure;
i18n keys; Prisma migration; the snapshot hook in `results.ts`.

## i18n (EN + ES, Sonoran Spanish; drift-guard enforced)

New keys (names indicative): `home.nextUp`, `home.live`, `home.kickoffIn`, `home.finalScore`,
`home.yourPick`, `home.pickWon`, `home.pickBusted`, `home.picksLockAt`, `home.youStanding`,
`home.movementUp`/`movementDown`, `home.bustedLine`, `home.takesFirst`. Times formatted with
the existing `format-remaining`/`formatLockTimePT` helpers.

## Error handling / edge cases

- ESPN unreachable → strip shows a neutral "schedule unavailable" state; the rest of the page
  is unaffected (the action returns an empty games list, never throws).
- No official draw / pre-tournament → strip shows upcoming fixtures only; no ✓/✗.
- Ties for #1 in `newLeader` → only set when the #1 *display* changes; co-#1 handled by taking
  the leaderboard's top row deterministically.
- Polling pauses gracefully on errors (keeps last value); no infinite error loops.

## Testing

Unit tests (Vitest, TDD) for every pure unit above: fixture→slot mapping incl. swapped team
order and unmatched fixtures; `pickGames` ordering/cap; ✓/✗ result logic; `resultEvents`
newly-decided detection + `bustedCount` + `newLeader` change detection; `movement` directions
incl. null. Glue/components are not unit-tested.

## Out of scope (YAGNI)

No full fixtures/schedule page (strip is "next up" only). No push notifications. No per-game
"who else picked what" social view. No historical results feed/archive beyond the latest
`ResultEvent`. No WebSocket; polling only.
