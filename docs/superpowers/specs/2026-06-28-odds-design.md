# Odds — pool win% + bookmaker lines — design

_2026-06-28_

## Goal

Bring the sibling **wc26** app's odds experience to this knockout pool. Two distinct
"odds" surfaces, modeled on wc26 but adapted to a **single-elimination bracket** (not an
independent-matches group stage):

1. **The pool** — each official bracket's **% chance to win the pool**, by Monte-Carlo
   simulating the rest of the tournament. Headline number: "_Daniel's Bracket — 34% to win_".
2. **The books** — **bookmaker win probability per game**, pulled from ESPN's moneyline,
   shown on the live-games strip already on the home page and on the `/odds` page.

A new **`/odds`** page hosts the pool cards + team title-odds; a small **teaser** on home
links to it; the **home `NextGames` strip** gains a book-odds bar per card.

## Why this is harder than wc26

wc26 is a group stage: every match is independent (`TOP`/`TIE`/`BOTTOM`), so its sim samples
each remaining match on its own. Here the bracket is a **dependency tree** (`FEEDERS`): a QF
pick only scores if the teams a player advanced actually reach that QF. So the sim must **play
the tournament forward, round by round**, deriving each slot's two contestants from the
simulated winners of its feeder slots, then score every bracket against the full simulated
outcome. And bookmaker lines only exist for the **currently scheduled** games (the next round);
matchups further out — whose teams aren't decided yet — need a **team-strength model**.

## Decisions (locked in brainstorming)

- **Scope:** build both the books and the pool win%.
- **Placement:** a dedicated `/odds` page + a home teaser + book bars on the existing
  `NextGames` home strip.
- **Future-round pricing:** **Elo baseline, refined by live book lines** — a real bookmaker
  line is used when one exists for the pair; otherwise the matchup is priced from the two
  teams' baked-in Elo ratings.
- **Activation:** the per-player win% cards go **live only after lock** (bracket picks are
  public then anyway). **Before lock**, `/odds` shows a "goes live when brackets lock at
  {time}" teaser plus **team title-odds** + book lines — neither of which leaks any picks.
- **Unit:** win% is computed **per official bracket** (matching the per-bracket leaderboard
  rows and how the pot splits among rank-1 brackets), not aggregated per person.
- **Compute model (Approach A):** an `/api/odds` route runs the whole report, cached ~2 min;
  the page polls every 2 min so odds move live as games finish. This mirrors wc26's `/odds`
  and the existing `/api/next-games` + `NextGames` poll already in this repo.

## Architecture / data flow

```
ESPN scoreboard ──► book-odds.ts  ─► BookLine[] ─┐
team-elo.ts (baked) ─────────────────────────────┤─► matchup-prob.ts ─► matchupProb(a,b)
                                                  │            │
official R32 (officialR32FromSlots) ──────────────┘            │
currentWinners() (decided slots) ─────────────────────────────┤
official brackets {id,userId,name,picks} ─────────────────────┼─► bracket-odds.ts (Monte Carlo)
getLockState() ───────────────────────────────────────────────┘            │
                                                                            ▼
                                                                       OddsReport
                                          ┌─────────────────────────────────┤
                                          ▼                                 ▼
                          actions/odds.ts getOdds()              api/odds/route.ts (GET)
                                          │                                 │ poll 2 min
                                          ▼                                 ▼
                         OddsTeaser (home, server)              app/odds/page.tsx (client)
                                                                NextGames book bars (extend getNextGames)
```

## Pure libs (`src/lib/`, all TDD)

### `team-elo.ts`
- `TEAM_ELO: Record<string, number>` — baked-in pre-tournament Elo for the 48 teams keyed by
  FIFA code, with a source comment (World Football Elo, eloratings.net, captured pre-tournament).
  A single `DEFAULT_ELO` constant backs any code missing from the table.
- `eloWinProb(eloA: number, eloB: number): number` — logistic `1 / (1 + 10^(-(A-B)/400))`,
  the standard Elo expectation. Returns P(A beats B) as a 2-way (advancement) probability.
- `teamElo(code: string | null): number` — lookup with `DEFAULT_ELO` fallback.

### `book-odds.ts`
Mirrors wc26 `odds-source.ts`, but produces **2-way** advancement probabilities for a knockout.
- `BookLine = { codeA: string; codeB: string; probA: number; probB: number }` — `probA + probB = 1`.
- `americanToImplied(odds): number` — American → implied probability (same formula as wc26).
- `mapEspnEvent(event, resolve, eloOf): BookLine | null` — reads
  `competitions[0].odds[0].moneyline` (home/draw/away, preferring `close.odds` over `open.odds`),
  converts each side to implied prob, removes vig (normalize so the three sum to 1), then
  **folds the draw mass into advancement**: a KO game can't end drawn, so the draw probability
  is split between the sides **weighted by Elo** (`pAdvA = pWinA + pDraw · eloShareA`, where
  `eloShareA = eloWinProb(eloA, eloB)`). Team strings resolved to codes via `resolveCode`;
  returns `null` when no usable moneyline or either code is unknown.
- `getBookOdds(): Promise<BookLine[]>` — fetches the ESPN knockout scoreboard
  (`...soccer/fifa.world/scoreboard?dates=<KO range>`, the same endpoint family `next-games.ts`
  already hits), maps + filters. Cached with `next: { revalidate: 3600 }` (hourly — lines move
  slowly). Callers wrap with `.catch(() => [])`: a books outage must never break the page.

### `matchup-prob.ts`
The single resolver feeding the whole sim (the wc26 `match-probs.ts` idea, 2-way).
- `matchupProb(codeA, codeB, bookLines): { p: number; hasLine: boolean }` — if a `BookLine`
  exists for the pair (either orientation), return it oriented to `codeA`'s advancement prob
  with `hasLine: true`; else `eloWinProb(teamElo(codeA), teamElo(codeB))` with `hasLine: false`.

### `bracket-odds.ts`
The Monte-Carlo core. **Pure**, with an injectable `rng` so tests are deterministic.

```ts
interface OddsBracket { key: string; name: string; picks: Picks }
interface BracketOdds {
  key: string; name: string;
  now: number;        // points already banked (scoreBracket vs decided winners)
  exp: number;        // expected final points
  winPct: number;     // expected share of 1st place, ties split, 0..100
  solePct: number;    // outright (sole) win, 0..100
  needs: NeedGame[];  // remaining slots this bracket still needs, by impact
}
interface NeedGame {       // "you need Brazil to get past France in the QF"
  slot: number; round: Round; team: string; opponent: string | null;
  prob: number;            // matchupProb for the team to advance this slot
  points: number;          // ROUND_POINTS[round] — what hitting it is worth
}
interface TeamOdds { code: string; titlePct: number }  // P(team wins the cup)
interface OddsReport {
  locked: boolean;
  brackets: BracketOdds[]; // [] when unlocked; sorted by winPct desc, then exp desc
  teams: TeamOdds[];       // team title odds; sorted desc (always populated)
  books: BookLine[];       // raw lines for the UI's per-game bars
  sims: number; decided: number; total: number; remaining: number;
  oddsCoverage: number;    // # of simulated slots that used a real book line (vs Elo)
  updatedAt: string;
}

function simulateOdds(input: {
  officialR32: OfficialR32;
  winners: OfficialWinners;
  brackets: OddsBracket[];
  bookLines: BookLine[];
  locked: boolean;
  updatedAt: string;
}, opts?: { sims?: number; rng?: () => number; needN?: number }): OddsReport
```

**The simulation (one run):**
1. Seed a `SlotResult` map from `officialR32` (R32 teams) + `winners` (decided slots become
   fixed `winner`s, in every run).
2. Walk slots in dependency order — `slotsForRound` for `R32 → R16 → QF → SF → FINAL`. For each
   **undecided** slot: derive its two contestants via `participantsForSlot(slot, map)` (the
   feeders' simulated winners), get `matchupProb(teamA, teamB, bookLines)`, sample
   `rng() < p ? teamA : teamB`, write that winner into the map. Decided slots keep their fixed
   winner. (One forward pass suffices because feeder slots always have lower numbers.)
3. The full map is now a complete `OfficialWinners` for this run; the FINAL slot's winner is the
   **simulated champion** (→ team title odds, leaked-pick-free).
4. Score every bracket with the existing `scoreBracket(picks, simWinners)`; track the max and
   the count of brackets at the max (`leaders`); credit each leader `1/leaders` of a first place
   and `+1` sole win when `leaders === 1`; accumulate points for `exp`.

After `sims` runs: `winPct = 100·anyFirst/sims`, `solePct = 100·sole/sims`,
`exp = ptsSum/sims`, team `titlePct = 100·championCount/sims`.

**`needs` (deterministic, no extra sim):** for each bracket, over its picks in **undecided**
slots, the team it still needs to advance, that slot's `matchupProb`, and `ROUND_POINTS`
(impact). Sorted by impact (`points · prob`, the high-value-likely picks) and capped at `needN`.
This is the knockout analogue of wc26's "key games / must-hold" — simplified to one list.

**Performance:** typed arrays for the inner loop (one `Int32Array` of bracket totals per run,
like wc26). With ≤~30 brackets × ≤31 slots, **100k sims** runs in ~a couple seconds; `opts.sims`
lets the route tune it. The route sets `maxDuration = 30`.

## Server action + API route

### `src/app/actions/odds.ts` → `getOdds(): Promise<OddsReport>`
Assembles inputs and runs the sim:
- `officialR32FromSlots(await getOfficialBracket()...)` for the R32 teams; `currentWinners()`
  for decided slots; `getLockState()` for `locked` + the lock time.
- Official brackets: `db.bracket.findMany({ where: { official: true }, select: { id, userId,
  name, picks } })`, picks coerced via the existing picks-JSON helper, display names resolved
  the same way `getLeaderboard` does (`username (firstName)` + bracket name).
- `getBookOdds().catch(() => [])` — non-fatal.
- **Unlocked:** pass `brackets: []` (skip the per-player work and **never read picks** before
  lock); the report still returns `teams` (title odds) + `books`. **Locked:** pass the real
  brackets for the full report.
- Stamps `updatedAt = new Date().toISOString()`.

### `src/app/api/odds/route.ts`
`export const dynamic = 'force-dynamic'; export const maxDuration = 30;`
`GET()` returns `NextResponse.json(await getOdds())`; on throw, `{ error }` with status 502
(same shape as wc26's route, so the page can render an error state).

## UI

### `src/app/odds/page.tsx` (client)
Polls `/api/odds` every 2 min (`cache: 'no-store'`) + a 30 s tick to keep "updated x ago"
fresh — the wc26 `/odds` pattern. States:
- **error / loading** — spinner + message (i18n).
- **locked** — header (decided/total slots, matches left, freshness chip); a ranked
  **`ol`** of bracket cards: collapsed head = rank · name · win% bar (`--w: winPct%`) · big
  `winPct%`; expanded body = stat line (`now` pts / `exp` expected / `solePct` sole-win) + the
  **`needs`** list (team · "to get past" opponent · `prob%` · `+points`). Below the list, a
  compact **team title-odds** mini-list (top N teams, title%).
- **unlocked** — a "goes live when brackets lock at {time}" teaser card (reuses the lock time
  from `getLockState`), the **team title-odds** list, and **upcoming book lines**.

Mirrors wc26's `.oc/.og` card structure; new CSS classes added to `globals.css` in the same
family (`.oc-list`, `.oc`, `.oc-head`, `.oc-bar`, `.oc-body`, `.og`, plus a `.team-odds` list).

### Home `NextGames` book bars
Extend `getNextGames()` (`src/app/actions/next-games.ts`) to also call `getBookOdds()` and
attach `odds?: { probA: number; probB: number }` to each `GameRow` by matching the game's team
pair to a `BookLine` (the same sorted-pair keying `game-slot.ts` already uses). `NextGames.tsx`
renders a small two-segment win-probability bar under each live/upcoming card (hidden when a
game has no line). No change to the 30 s poll cadence.

### `src/app/_components/OddsTeaser.tsx` (home)
A small server-rendered card on home linking to `/odds` (gold, in the `.cta` family). Copy
adapts to lock state ("see who's favored to win the pool" after lock / "see the title odds"
before). A **Nav link** to `/odds` is added (EN/ES), always visible.

## i18n (EN + ES, Sonoran Spanish; drift-guard enforced)
New `odds.*` keys for: page title/eyebrow/intro, `decided`/`left`/`updated`, `toWin`,
`statLine` (now/exp/sole), `needs` label + row ("{team} to get past {opp}"), `teamOdds` label,
the unlocked teaser, loading/error states; `nav.odds`; `home.oddsTeaser*`. Every key added to
**both** `en` and `es` (a missing key is a compile error).

## Out of scope (YAGNI)
- No persisted odds history / charts over time.
- No live-polling of the per-player cards faster than 2 min, no `AbortController` (matches the
  existing strip's deferred follow-up).
- No admin controls for the Elo table (baked constant; edited in code if ever needed).
- No "to advance" futures market or tournament-winner futures from ESPN (we derive title odds
  from the sim instead).
- The `OddsPromo` one-time localStorage banner from wc26 is replaced by the simpler home
  `OddsTeaser` (no dismiss-forever state).

## Tests
- `team-elo.test.ts` — `eloWinProb` (equal Elo → 0.5; 400-point gap → ~0.909; symmetry),
  `teamElo` fallback.
- `book-odds.test.ts` — `americanToImplied`; `mapEspnEvent` vig removal + Elo-weighted
  draw-fold sums to 1; `null` on missing moneyline / unknown code.
- `matchup-prob.test.ts` — book line used + orientation when present (`hasLine: true`); Elo
  fallback when absent (`hasLine: false`).
- `bracket-odds.test.ts` — `simulateOdds` with a **deterministic rng** + a tiny fixture
  (2–3 brackets, a few undecided slots) → exact `winPct`/`solePct`/`exp`; ties split correctly;
  decided winners stay fixed across runs; `needs` ordering by impact; `teams` title odds sum to
  ~100; unlocked input yields `brackets: []` but populated `teams`/`books`.
