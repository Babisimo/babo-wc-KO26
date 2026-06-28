# Pool champion congrats banner — design

_2026-06-27_

## Goal

When the tournament finishes, congratulate the pool winner(s) with a celebratory banner on
the home page. Ties produce multiple co-champions.

## Trigger

The pool is decided when the **Final (slot 31) is scored**. `computeStage(winners)` already
captures this: `stage.champion` is non-null only once the Final is decided. So the banner
renders **iff** `stage.champion !== null` **and** there is at least one ranked winner. Before
completion the banner renders nothing (no congratulating the provisional mid-tournament leader).

## Winner(s)

The rank-1 official bracket(s) — already computed in `getLeaderboard` as `winnerKeys` /
`shareCents` (the pot split). Each winning bracket maps to its owner's **display name**
(`username (firstName)`, the same string the leaderboard shows). Names are **deduped** (a
player who owns two tied brackets appears once) and sorted.

## Data flow

`LeaderboardData` gains:

```ts
champions: { names: string[]; shareCents: number } | null
```

Computed in `getLeaderboard` via a pure helper and gated on stage-complete (null otherwise).
`HomeContent` already receives the leaderboard, so no new fetch or query.

## Pure core (TDD)

`src/lib/champion.ts`:

- `championAnnouncement(stage, winnerDisplays, shareCents): { names, shareCents } | null`
  - returns `null` when `stage.champion` is null (not complete) or there are no winners
  - dedupes + sorts the display names
- `joinNames(names, and): string`
  - `[]→""`, `[A]→"A"`, `[A,B]→"A y B"`, `[A,B,C]→"A, B y C"` (conjunction injected for i18n)

## UI

`src/app/_components/ChampionBanner.tsx` (client) — renders `null` when `champions` is null;
otherwise a gold `.champ` banner at the **top of `HomeContent`** (above the CTAs/countdown,
visible to signed-out visitors too). Message via i18n:

- 1 winner: `🏆 Congrats to {name} — pool champion! Wins {amount}.`
- 2+ winners: `🏆 Congrats to {names} — co-champions! {amount} each.`

Amount formatted with the existing `dollars(cents)` helper.

## i18n (EN + ES, Sonoran Spanish; drift-guard enforced)

- `home.champOne` — "🏆 Congrats to {name} — pool champion! Wins {amount}." /
  "🏆 ¡Felicidades a {name} — campeón del pool! Se lleva {amount}."
- `home.champMany` — "🏆 Congrats to {names} — co-champions! {amount} each." /
  "🏆 ¡Felicidades a {names} — co-campeones! {amount} cada quien."
- `common.and` — "and" / "y"

## Styling

`.champ` in `globals.css` — gold celebratory banner consistent with the existing `.cta` /
`pill gold` aesthetic.

## Out of scope (YAGNI)

No confetti/animation, no leaderboard duplicate of the message, no historical past-champions list.

## Tests

`src/lib/champion.test.ts` — `championAnnouncement` (gate before complete, dedupe, empty →
null, single + multi) and `joinNames` (0/1/2/3 names).
