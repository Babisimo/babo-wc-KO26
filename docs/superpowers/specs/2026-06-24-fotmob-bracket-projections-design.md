# FotMob-style Knockout Bracket + Live Projections — Design

_Date: 2026-06-24_
_Status: approved design, pending spec review_

## Goal

Make the WC26 knockout bracket **look like FotMob's** knockout table and show a live,
accurate field via an **"As it stands" / "Confirmed"** toggle, driven by data we already
trust (ESPN), not by hand-maintained placeholders. Today (2026-06-24) the group stage
isn't finished, so the current preview R32 looks inaccurate; this feature replaces that
with a projected-from-standings bracket that fills in as groups complete.

## Decisions (locked with the user)

1. **Layout — FotMob single-direction columnar ("Mock A").** R32 on the left flowing
   right to the Final, round labels across the top, horizontal scroll on small screens.
2. **Bracket routing — adopt FIFA's real WC26 routing.** Replace the current simplified
   adjacency feeders with the official schedule's feeder wiring (still a 31-slot binary
   tree). Pre-launch, so changing pick paths is acceptable.
3. **Flags — bundled SVG via `flag-icons`.** Offline, crisp, MIT. FIFA→ISO2 map incl.
   `gb-eng` / `gb-sct`.
4. **Projections — full auto from ESPN standings.** Group ranking + best-8 third-place
   seeding computed live; no manual projection upkeep.
5. **Data source — ESPN only.** FotMob has no public API; its unofficial one is gated
   behind a signed `X-Fm-Req` header (anti-scraping, ToS-risky, fragile). ESPN's
   standings + scoreboard endpoints are public and already integrated.
6. **Mobile — shrink + horizontal scroll** the same bracket (one render path).

## Non-goals (YAGNI)

- No FotMob API integration or scraping.
- No mid-group "clinched" detection in v1 (see "Confirmed" definition below).
- No change to auth, leaderboard, scoring weights, or pot logic.
- No new interactive behavior on the pick page beyond the restyle (see "Pick game" below).

---

## Architecture

Three layers, each independently testable.

### 1. Bracket structure (routing) — `src/lib/bracket-structure.ts`

- Re-map `feedersForSlot` (and the `LAYERS`/feeder geometry) to FIFA's **official WC26
  R32→Final routing**. The 31-slot binary-tree shape is unchanged; only *which* lower
  slots feed each higher slot changes, so `bracket-picks`, `scoring`, and `bracket-view`
  keep working through the same abstraction.
- Encode the official **R32 match schedule**: each R32 slot (1–16) maps to a pair of
  group positions, e.g. `{A1 vs 3rd[C/D/F/...]}`, per FIFA's published bracket.
- Re-run/adjust the existing Vitest suites that assert feeder relationships and the
  advancement cascade. This is the foundational change and lands first.

### 2. Projection engine (pure) — `src/lib/wc26-seeding.ts`

Pure functions, fully unit-tested, no I/O:

- **Input:** the 12 group standings (group letter → ordered teams with points, GD, GF,
  and a conduct/ranking tiebreak hint), plus completion flags per group.
- **Rank third-placed teams** by FIFA criteria in order: points → goal difference →
  goals scored → conduct (cards) → FIFA ranking. Take the best 8 of 12.
- **Assign to R32 slots** using the official schedule + the **best-third-place
  combination table** (which set of 8 qualifying groups maps each third to a specific
  group-winner's match).
- **Output:** an `OfficialR32`-shaped map (the existing type) giving teamA/teamB per R32
  slot, **plus** a per-slot `confidence: 'projected' | 'confirmed'` flag.
- Tiebreaker note: ESPN exposes points/GD/GF directly; **conduct** and **FIFA ranking**
  are deep tiebreakers rarely needed — v1 approximates them (documented) and can be made
  exact later.

### 3. Standings adapter — `src/lib/standings-feed.ts` + server action

- Map ESPN's `.../soccer/fifa.world/standings` JSON into the engine's input shape, reusing
  `team-resolve.ts` for ESPN-name → team-code resolution.
- A server action fetches standings (penalty-safe, same pattern as the results feed) and
  runs the engine to produce both the **projected** ("as it stands") and **confirmed**
  R32 fields.

---

## "As it stands" vs "Confirmed"

- **As it stands** — project *every* R32 slot from current standings, including groups
  still in progress. The honest "if the group stage ended now" bracket.
- **Confirmed** — fill only slots whose positions are mathematically final. **v1
  definition:** a group's winner/runner-up are Confirmed once that group has played all
  its matches; third-place slots become Confirmed only once **all 12 groups** are
  complete (best-8 needs every group). Slots not yet Confirmed render as "TBD".
  - Rationale: avoids fragile mid-group clinch math while still producing a
    progressively-filling Confirmed bracket. Exact clinch detection is a future option.
- Once the admin sets/locks the **official R32** (post group stage) — or all groups are
  complete — both modes converge to the official field, and the bracket advances via the
  existing results feed exactly as today. The projection engine is only "live" during the
  group stage.

## Pick game interaction

The toggle and projections live on the **read-only `/official`** page (and any read-only
views). The interactive **`/bracket` fill page is unchanged in data terms** — it still
opens only once the official R32 is locked (`officialReady`), so users never pick against
a shifting projected field. The fill page only receives the **visual** restyle (Mock A
layout, flags, cards, labels, mobile).

---

## UI / components

### Layout — `src/app/_components/BracketLayout.tsx`

- Add a `variant: 'single' | 'two-sided'` prop (default `'single'`). `'single'` renders
  the full tree as `Node(31, 'left')` — one direction, R32→Final — reusing the **existing,
  validated `.bx.left` connector CSS**. `'two-sided'` keeps today's split render.
- All bracket consumers (`MarchMadnessBracket`, `BracketFill`) pass `'single'`.

### Cards — shared team-row + flag

- New `src/lib/team-flag.ts`: `flagClass(code)` → flag-icons suffix (FIFA→ISO2 map, incl.
  `gb-eng`/`gb-sct`); null/placeholder → neutral chip.
- New `<TeamFlag code>` (or shared row helper) replacing the `<span class="chip">` in both
  `MarchMadnessBracket.tsx` (read-only) and `BracketFill.tsx` (interactive) — the single
  shared spot both render paths use.
- FotMob card style: flag · name · score, winner highlighted (gold). New `.fm-*` classes
  in `globals.css`; keep `mm-*`/`bx-*` where still used.
- Import `flag-icons/css/flag-icons.min.css` in `layout.tsx`.

### Round labels + toggle

- A `.fm-labels` header row above the tree (Round of 32 → Final), aligned to the columns
  (flex cells = `--bx-card` wide, `--bx-cw` gap). Verified against the Edge screenshot
  harness before finalizing.
- `As it stands / Confirmed` segmented pill on `/official`, switching the R32 field source.
  Client component; default **As it stands** during the group stage.

### Mobile

- `@media (max-width: 700px)`: reduce `--bx-card`, `--bx-cw`, font + flag sizes, padding;
  the existing `overflow-x:auto` scroll container handles panning. One render path.

---

## Verification

- **Unit (Vitest):** `wc26-seeding` (third-place ranking, combination-table assignment,
  projected vs confirmed flags), updated `bracket-structure` feeder tests, `standings-feed`
  mapper against a captured ESPN payload fixture.
- **Type/build:** `npx tsc --noEmit`, `npx next build`.
- **Visual:** Edge headless screenshot harness (already set up) for desktop + a 375px
  mobile viewport, plus a logged-in check of live `/official` and `/bracket`.

## Phasing (for the implementation plan)

1. **Routing** — adopt FIFA real feeders in `bracket-structure.ts`; fix tests.
2. **FotMob UI** — single-direction layout variant, flag system, cards, labels, mobile.
3. **Projection engine** — `wc26-seeding` (pure) + tests.
4. **Standings adapter + toggle** — ESPN standings action, `/official` toggle wiring.

## Open questions for spec review

- OK to approximate the conduct / FIFA-ranking third-place tiebreakers in v1 (exact later)?
- Is the v1 "Confirmed" definition (group-complete; thirds only when all 12 done)
  acceptable, or do you want mid-group clinch detection now?
- Should the home page leaderboard hero also adopt the new bracket card style, or only
  `/official` and `/bracket`?

## Sources

- FotMob API auth gating — Viktor Nilsson, "Reverse Engineering FotMob's API
  Authentication" (2024); `probberechts/soccerdata` issue #742 (`X-Fm-Req`).
- WC26 advancement + third-place criteria + R32 schedule — FIFA tournament regulations;
  ESPN 2026 World Cup match schedule; FIFA WC2026 standings page.
- ESPN standings endpoint: `https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings` (verified live).
