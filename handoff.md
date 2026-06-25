# WC26 Knockout Bracket — Handoff

_Last updated: 2026-06-24_

---

## ⭐ LATEST (2026-06-24, end of session) — read `memory/wc-ko-26-next-steps.md` for the authoritative state

Five features were built (brainstorm → spec → plan → subagent-driven execution → review), all **merged to `master`** (tip `d93157d`) and **pushed to GitHub** (`origin` = https://github.com/Babisimo/babo-wc-KO26.git):
1. **FotMob bracket UI** (FIFA WC26 real routing, country flags, single-direction columnar layout, round labels, mobile).
2. **Live ESPN-standings projections** + **As-it-stands / Confirmed** toggle on `/official`.
3. **Bracket credits** — replaced per-bracket approval with a credit allowance (1 credit = 1 bracket = $50, **no refunds/deletion**; admin grants +1/−1; pot = $50 × all brackets). See `docs/superpowers/specs/2026-06-24-bracket-credits-design.md`.
4. **Member display** — `username (firstName)` public; admin members table shows all four fields + credits.
5. **EN/ES i18n** — full casual-Sonoran Spanish translation + nav toggle (default English). Spanish strings live in the `es` block of `src/lib/i18n.ts`. Admin stays English.

Verified: tsc clean, 160/160 vitest, build compiles. Sections below predate features 3–5 (credits replaced the bracket-approval model described in #2 of "What's on feat/ui-polish" etc.) — trust the memory file + the spec docs in `docs/superpowers/specs/` over older prose here.

**Top follow-ups:** live logged-in EN↔ES + credits sweep; rotate the leaked Neon DB password; swap the preview R32 for the official field (~June 27). Dev gotcha: stale `.next` after branch churn → 404 CSS chunk (unstyled pages); fix with `rm -rf .next` + restart.

---

## 🟢 START HERE

**What this is:** `wc_ko_26` — a March Madness–style bracket pool for the **FIFA World Cup 2026 knockout stage**. Members fill one bracket (R32 → Final), scored by round, on a live leaderboard. Built as a Next.js 15 App Router app with its own Neon Postgres DB. **It is feature-complete and running locally.**

**Where we are right now:**
- All 5 feature plans are built, reviewed, and **merged to `master`**. The app works end-to-end.
- The **database is provisioned** (Neon Postgres) and seeded; the app runs at **http://localhost:3000**.
- The big **UI redesign** ("Broadcast Pitch" theme + `/official` page + pot = players×$50) **and the new FotMob-style bracket are now MERGED to `master`** (merge commit `361fc66`, `--no-ff`; `feat/ui-polish` deleted).
- The bracket was reworked into the **FotMob look (Plan 1 of 2)**: FIFA WC26 **official routing** (explicit feeder map in `bracket-structure.ts`, replacing the old simplified adjacency), country **flags** (`flag-icons` + `src/lib/team-flag.ts`), **single-direction** columnar layout (`BracketLayout variant='single'`), round labels, `.fm-*` cards, mobile shrink-scroll. Verified: 137/137 vitest, tsc clean, build compiles 11 routes.
- A **preview Round-of-32** is seeded with real WC26 teams so the bracket is viewable/testable. **It is a placeholder, not the official draw** (see below).

**Plan 2 of 2 is also DONE and MERGED** (merge commit `61cb3ab`): live **ESPN-standings projection engine** (`wc26-seeding.ts` + `standings-feed.ts` + `getProjectedBracket`) and the **"As it stands" / "Confirmed" toggle** on `/official`. Data source is ESPN (public standings endpoint), NOT FotMob (no public API; signed-header gated). `/official` keeps its DB-official-results path when the real R32 is set; projections are the group-stage fallback. **Follow-ups (non-blocking):** add a `resolveCode` alias when a live ESPN team name fails to resolve (shows TBD); optionally encode FIFA's exact 495-row third-place table (current = deterministic eligibility-matching); live e2e smoke test; swap the preview R32 for the official field once groups finish (~June 27).

**To resume immediately:**
1. Make sure the dev server is running: `cd C:\Users\Oswaldo\wc_ko_26 && npm run dev` → http://localhost:3000
2. Log in as admin: **gondaniel852@gmail.com** (this is the `ADMIN_EMAIL`; it auto-approved + is admin).
3. Look at `/bracket` (interactive bracket) and `/official` (official bracket). The bracket was just rebuilt into a recursive two-sided tournament tree with connector lines — **the connector-line precision likely needs visual tweaking** (see Pending #2).

**Top pending items (details in "Pending Work" below):**
1. Review the new UI → **merge `feat/ui-polish` into `master`** when happy.
2. **Refine the tournament-bracket connector lines / centering** (structure is correct; the elbow/line cosmetics may need nudging — built without visual verification).
3. **Replace the preview R32 with the official field** once the group stage ends (~June 27, 2026). Only ~4 teams were locked as of June 23.
4. Decide pot/entry, mobile nav, round labels (smaller items).

---

## How to run it

```bash
cd C:\Users\Oswaldo\wc_ko_26
npm run dev          # http://localhost:3000, loads .env
```

- **`.env`** exists (gitignored) with: `DATABASE_URL` (Neon pooled host), `DIRECT_URL` (Neon direct host), `AUTH_SECRET`, `ADMIN_EMAIL=gondaniel852@gmail.com`, `APP_URL`.
- **DB is live** (Neon, us-west-2). 48 teams seeded; a preview R32 seeded; no users until you sign up.
- **First login:** sign up at `/signup` with `gondaniel852@gmail.com` → auto-approved admin. Any other email signs up as `PENDING` and must be approved at `/admin`.

### ⚠️ Windows / Prisma gotcha
The Next dev server holds a lock on Prisma's `query_engine-windows.dll.node`. Any `prisma generate` / `prisma db push` will fail with **EPERM** while the dev server runs. **Stop the dev server first** (kill the `node` process whose command line matches `wc_ko_26`, or via PowerShell `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where {$_.CommandLine -match 'wc_ko_26'} | Stop-Process -Force`), run the prisma command, then restart `npm run dev`.

### Verify commands (no DB/visual needed)
`npx tsc --noEmit` · `npx vitest run` (132 tests) · `npx next build`

---

## Git state

- **`master`** — all 5 plans merged. Tip: `e99a72c Merge Plan 5`.
- **`feat/ui-polish`** — current branch, the UI redesign + pot change + preview seed + tournament bracket. **4 commits ahead of master, unmerged:**
  - `3cc4f94` refine theme, add Official Bracket page, polish admin pages
  - `6ba9c62` pot = players × entry price; preview R32 seed; March Madness bracket layout
  - `6ef15cb` interactive March Madness bracket on the fill page
  - `69a9cde` recursive two-sided tournament bracket with connectors
- Working tree clean. To merge when approved: `git checkout master && git merge --no-ff feat/ui-polish`.

Plans/specs live in `docs/superpowers/`. A per-task execution ledger is at `.superpowers/sdd/progress.md` (gitignored scratch).

---

## What's built (the 5 merged plans)

1. **Auth + admin-approval gate** — NextAuth v5 (JWT) + bcrypt + Prisma. New signups are `PENDING` and can't log in until an admin approves; `ADMIN_EMAIL` auto-approves. Pages: `/login`, `/signup`, `/admin` (approval queue + user mgmt).
2. **Official bracket model & admin** — `Team` + `Match` (31 slots) models, 48-team seed, admin sets the R32 skeleton + kickoffs at `/admin/bracket`, global lock = (earliest R32 kickoff − 1h) with a PST countdown.
3. **User bracket fill & lock** — one `Bracket` per user (`picks` JSON), NCAA advancement cascade, server-enforced lock, `/bracket` page.
4. **Results, scoring & leaderboard** — penalty-safe ESPN feed (`Refresh from feed`) + admin winner override (`winnerSource`), round-weighted scoring (perfect = 80), home leaderboard with shared ranks + pot split.
5. **Post-lock visibility & WC2026 theme** — others' brackets viewable only after lock (`/brackets`, `/brackets/[user]`), bracket-tree rendering, the base theme.

## What's on `feat/ui-polish` (unmerged)

- **"Broadcast Pitch" theme refresh** in `src/app/globals.css` (pitch-green stadium look, gold accent, Big Shoulders + Hanken Grotesk fonts, cards, rank medals, banners, sticky frosted nav). Kept `--accent`/`--line` var names so legacy pages restyle for free.
- **Restyled:** nav, home (hero countdown + medal leaderboard), login/signup (auth cards), `/admin` + `/admin/bracket` (tables, badges, results panel), bracket fill.
- **New `/official` page** ("Official" nav link) — the real bracket with live results.
- **Pot = players × entry price.** `PoolConfig.entryCents` (default $50, set at `/admin/bracket`); pot computed in `getLeaderboard` as `entryCents × bracketCount`. (Legacy `setPot`/`potCents` replaced by `setEntryPrice`/`entryCents`.)
- **Two-sided tournament bracket** — `src/app/_components/BracketLayout.tsx` (recursive tree, render-prop) used by `MarchMadnessBracket.tsx` (read-only: Official, per-user, admin preview) and `BracketFill.tsx` (interactive). Each match is centered between its two feeders; left/right halves meet at the Final. CSS classes `.bx-*` + `.mm-match/.mm-team/.mm-btn` in globals.css.
- **Preview R32 seed:** `prisma/seed-preview.ts` (run via `npx tsx --env-file=.env prisma/seed-preview.ts`). Fills slots 1–16 with 32 real teams (ARG–KOR, BRA–MAR, …), kickoffs starting 2026-06-28 (so the countdown reads a few days). **Not the official draw.**

---

## Pending Work (prioritized)

1. **Review + merge the UI.** Look at every page logged in as admin; if good, `git merge --no-ff feat/ui-polish` into `master`. If not, iterate on `feat/ui-polish`.
2. **Refine the tournament-bracket visuals.** The recursive structure (`BracketLayout.tsx` + `.bx-*` CSS) centers matches correctly, but the connector lines were written **without visual verification**. Likely needs: elbow alignment, the line into the center Final being level with the semifinal cards, spacing/tightness, and optional **round labels across the top** (R32/R16/QF/SF). This is the most likely thing to look "off."
3. **Official R32 field.** As of ~June 23–24 the WC26 group stage isn't finished (ends ~June 27), so the real R32 is mostly TBD placeholders ("Group A Winner", "3rd place …") — only a few teams locked (Germany, Mexico, USA, Argentina). When groups finish: overwrite the preview at `/admin/bracket` (or pull via "Refresh from feed"). The ESPN feed already publishes the bracket structure; note its real R16 feeder pairings (e.g. "R32 game 1 winner vs R32 game 3 winner") differ from this app's internal adjacent-pair wiring — fine for the pick game (internally consistent + results matched by team pair), but relevant if you ever want the displayed bracket to mirror FIFA's exact feeder layout.
4. **Live smoke test of the full flow** with real users: signup → approve → fill → lock → record results / refresh feed → leaderboard → post-lock browse.
5. **Smaller UI calls:** the nav has 5 links + logout (cramped on mobile — consider a mobile menu); apply the eyebrow/lead header treatment consistently; `BracketTree.tsx` is now unused dead code (can delete).
6. **Security:** the Neon DB password was pasted into an earlier chat. Rotate it in Neon (Roles → reset password) before any real/production use, then update the two URLs in `.env`.

### Deferred minor cleanups (logged during plan reviews; none blocking)
- Auth: forward `image` / add `pages.error`; move the unset-`ADMIN_EMAIL` `console.warn` to module scope; try/catch admin Prisma calls for friendly errors.
- `getOfficialBracket` uses `rows.find` in a 31-iteration loop (could use the `bySlot` map).
- `getUserBracketView` calls `getOfficialBracket()` twice (redundant fetch).
- Two pre-existing inline `coercePicks` copies (`leaderboard.ts`, `bracket-entry.ts`) could adopt the shared `@/lib/picks-json`.
- Prisma `package.json#prisma` deprecation warning → migrate to `prisma.config.ts` eventually.

---

## Architecture / key files

- **Pure libs (`src/lib/`, all unit-tested):** `bracket-structure.ts` (31-slot geometry, feeders, `ROUND_POINTS`), `bracket-picks.ts` (advancement cascade, `contestantsForSlot`), `bracket-view.ts` (`buildBracketView` → SlotView), `scoring.ts`, `leaderboard-rank.ts`, `lock.ts`, `official-winners.ts`, `results-feed.ts` (ESPN mapper), `team-resolve.ts` / `team-name.ts`, `bracket-visibility.ts`, `picks-json.ts`, `official-r32.ts`, `auth*.ts`, `teams.ts` (48 teams).
- **Server actions (`src/app/actions/`):** `auth.ts`, `admin.ts`, `bracket.ts` (official R32 + `getOfficialBracket`), `bracket-entry.ts` (user save/get + lock), `results.ts` (winners, feed refresh, `setEntryPrice`), `leaderboard.ts`, `browse.ts` (gated others' brackets).
- **Pages (`src/app/`):** `page.tsx` (home leaderboard), `official/`, `bracket/`, `brackets/` + `brackets/[user]/`, `admin/` + `admin/bracket/`, `login/`, `signup/`.
- **Bracket UI:** `_components/BracketLayout.tsx` (recursive tree), `MarchMadnessBracket.tsx` (read-only), `bracket/BracketFill.tsx` (interactive), `_components/Countdown.tsx`. `_components/BracketTree.tsx` is now unused.
- **DB:** `prisma/schema.prisma` (User, PasswordResetToken, Team, Match, Bracket, PoolConfig + enums). Seeds: `prisma/seed.ts` (teams), `prisma/seed-preview.ts` (preview R32).
- **Stack:** Next.js 15.5 (App Router, stock — NOT the wc26 fork), React 19, NextAuth v5 beta, Prisma 6 + Neon Postgres, Tailwind v4 + hand-written CSS, Vitest 4.

## Sibling apps (context)
- `C:\Users\Oswaldo\nfl26` — the auth system was ported from here (Next 15 + NextAuth v5 + Prisma); this app added the approval gate it lacked.
- `C:\Users\Oswaldo\wc26` — the ESPN results-feed pattern + theme conventions came from here (it's a different, group-stage pool app on a custom Next fork).
