# Eliminated-team strikethrough + eliminator badge — Design

_Date: 2026-06-30_

## Problem

Once knockout results come in, a team that loses is out of the tournament — but on the
brackets it still appears in later rounds wherever someone picked it to advance (a "ghost
pick"), with no visual signal that the pick is dead. Players want eliminated teams struck
through **everywhere they appear**, with a marker showing **who knocked them out**.

Example: Germany loses to Paraguay in R32. On every bracket, in every round, Germany now
renders struck through with a `▸ 🇵🇾 PAR` badge — including the QF/SF/Final cards of anyone
who had picked Germany to go deep.

## Scope

Applies to the **read-only** bracket views:

- `/official` — the real-results tree (the branch shown once the real R32 draw is set).
- `/brackets/[user]` (browse) — any entrant's bracket, post-lock. **Your own scored bracket is
  this same view with `isOwner === true`**, so browse covers both "other people's" and "your
  own" scored brackets.

**Out of scope** (unchanged): the interactive fill/edit page `/bracket/[id]` (still picking —
renders `BracketFill`, not a scored tree), the pre-draw projection toggle on `/official`
(`OfficialBracketView` — no recorded knockout winners yet, so the map is empty there anyway),
and the PNG image export. These simply don't receive the new prop.

## Core logic — `src/lib/eliminations.ts` (new, pure, TDD)

```
eliminations(officialR32: OfficialR32, winners: OfficialWinners): Record<string, string>
```

Returns a map of **eliminated team code → eliminator team code**.

Algorithm: normalize winners to a picks cascade (`winnersToPicks`); for each slot `1..31`
that has a recorded winner, get the slot's official contestants
(`contestantsForSlot(slot, officialR32, cascade)`), and map `loser → winner` where the loser
is whichever contestant is not the winner. The champion (winner of slot 31) is never a loser,
so never a key. Slots without a recorded winner contribute nothing.

This map is **global** — identical for every bracket, derived only from the official draw and
the recorded knockout results. It does **not** depend on any user's picks.

Test cases (TDD):
1. No winners yet → `{}`.
2. Single R32 result → one entry (`loser → winner`).
3. Later-round result → loser is the feeder-winner who lost that round.
4. A full chain (R32 → Final) → every non-champion that lost appears, each mapped to the team
   that beat it.
5. After a reconciled/cleared upstream winner, a downstream slot with no current winner
   contributes nothing (uses the same cascade `buildBracketView` uses).

## Threading

`eliminatedBy` is computed server-side wherever the official draw + recorded winners are
already in scope — the two producers feeding the in-scope read-only trees:

- the `/official` page real-results branch (already has `officialR32` + `winners` in
  `official/page.tsx`),
- `actions/browse.ts` `getUserBracketView` (already has `officialR32` + `winners`; add
  `eliminatedBy` to `UserBracketView` and pass it through `BrowseText`'s `UserBody`).

Each passes the single map down as one optional prop:

```
MarchMadnessBracket slots={...} eliminatedBy={map} → BracketCard eliminatedBy={map}
```

`MarchMadnessBracket` forwards the prop to every `BracketCard` it renders. When the prop is
absent (image export, fill page, pre-lock), behavior is exactly as today.

## Rendering — `BracketCard`

New optional prop `eliminatedBy?: Record<string, string>`. In `side(code)`:

- If `code` is a key in the map, add an `.elim` modifier to the team row: the code/name span
  renders with `line-through` and reduced opacity — **on every card the team appears in**,
  including downstream ghost picks.
- Render an inline badge next to the struck name: `▸ <Flag eliminator/> <eliminatorCode>`
  (class `.bcard-elimby`). **The badge shows on every struck card, including the match where
  the team actually lost** (per decision — no suppression).
- The badge carries an `aria-label`/`title` = `bracket.eliminatedBy` ("GER eliminated by PAR")
  for screen readers.

The existing `status` ring (`wrong`/`correct`) and `highlight` (`.sel`) are unchanged and
compose with `.elim`.

## Supporting bits

- **CSS** (`globals.css`): `.bcard-team.elim` (line-through + dimmed) and `.bcard-elimby`
  badge, styled to read in both the dense zoom tree (3-letter `.bcard-code`) and the big tab
  cards (full `.bcard-name`).
- **i18n** (`src/lib/i18n.ts`): one new key `bracket.eliminatedBy` (EN + ES Sonoran), used as
  the badge `aria-label`/`title`. Drift guard satisfied (both languages).
- **No schema change.** Pre-lock there are no recorded winners → empty map → fully inert; the
  views render exactly as they do today.

## Verification

- `eliminations.test.ts` green (the 5 cases above).
- `npx tsc --noEmit` clean · `npx vitest run` green · `next lint` clean · `next build` clean
  (`rm -rf .next` first per the Windows flake).
- Manual: with a recorded R32 result, the loser is struck with the eliminator badge on
  `/official`, on a browsed bracket that picked the loser to advance (struck in later rounds),
  and on your own scored bracket. Fill page and PNG export unchanged.
