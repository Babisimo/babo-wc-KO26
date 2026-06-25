# WC26 Knockout Bracket — Handoff

_Last updated: 2026-06-25_

---

## 🟢 START HERE

**What this is:** `wc_ko_26` — a March Madness–style bracket pool for the **FIFA World Cup
2026 knockout stage**. Members enter one or more brackets (R32 → Final), scored by round,
on a live leaderboard with a pot. Stock **Next.js 15.5 App Router** app with its own **Neon
Postgres** DB. Feature-complete, running locally, and pushed to GitHub.

**Current state (all merged to `master`, tip `48cb821`, and pushed):**
- Remote: **`origin` = https://github.com/Babisimo/babo-wc-KO26.git**; `origin/master == master`.
- Verified at last check: **`npx tsc --noEmit` clean · `npx vitest run` 160/160 (29 files) · `npx next build` compiles 12 routes.**
- DB is live on Neon (us-west-2), seeded with 48 teams + a **preview Round-of-32** (real teams, placeholder — not the official draw; the group stage ends ~June 27).

**To resume:**
1. `cd C:\Users\Oswaldo\wc_ko_26 && npm run dev` → http://localhost:3000
2. Log in as admin: **gondaniel852@gmail.com** (the `ADMIN_EMAIL`; auto-approved + admin + auto-granted 1 credit).
3. Public pages: `/` (leaderboard), `/official` (real/projected bracket + EN/ES toggle in nav), `/bracket` (your brackets), `/brackets` (browse, post-lock). Admin: `/admin`, `/admin/bracket`.

---

## The five features shipped (each: brainstorm → spec → plan → subagent-driven build → review → merge)

Design docs live in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/` (dated `2026-06-24`).

1. **FotMob bracket UI.** FIFA WC26 **real routing** — `src/lib/bracket-structure.ts` uses an
   explicit `FEEDERS` map (not the old simplified adjacency). Country **flags** via
   `flag-icons` + `src/lib/team-flag.ts` (FIFA→ISO map). **Single-direction columnar** layout
   (`BracketLayout` `variant='single'`, default), round labels (`_components/RoundLabels.tsx`),
   FotMob `.fm-*` cards, mobile shrink-scroll. Used by `MarchMadnessBracket` (read-only) +
   `bracket/BracketFill.tsx` (interactive).

2. **Live ESPN-standings projections.** `src/lib/wc26-seeding.ts` (pure: R32 position
   schedule + `rankThirds` best-8 + `assignThirds` deterministic eligibility-matching +
   `seedR32`) ← `src/lib/standings-feed.ts` (ESPN standings adapter) ← `src/app/actions/projection.ts`
   (`getProjectedBracket`). The **As-it-stands / Confirmed** toggle is
   `src/app/official/OfficialBracketView.tsx`. **Data source = ESPN only** (FotMob has no public
   API; it's gated behind a signed header). v1 approximations are documented in `wc26-seeding.ts`.

3. **Bracket credits** (replaced the old per-bracket approval model). `User.credits` is a hard
   allowance: a user may create a bracket only while `bracketCount < credits` (`src/lib/bracket-credits.ts`
   `canCreateBracket`). **1 credit = 1 bracket = $50; no refunds, no user deletion** (decisions are
   final). Approving a signup grants **1 credit**; admin grants more via **+1 / −1** on the members
   table (`grantCredits`). Pot = `$50 × total brackets`. `Bracket.status`/`approvedAt`/`approvedBy`
   + the `BracketStatus` enum and the bracket-approval queue were **removed**. Migration:
   `prisma/backfill-credits.ts` set approved users `credits = max(bracketCount, 1)`.
   Rules memory: see the project's `wc-ko-26-credits-rules` memory.

4. **Member display.** Public surfaces (leaderboard, browse) show **`username (firstName)`**.
   The admin **All members** table shows username · first · last · email · **credits** (+ grant).

5. **EN/ES i18n.** `src/lib/i18n.ts` — typed `en`/`es` dictionary with a `Record<StringKey,string>`
   **drift guard** (a missing/extra Spanish key is a compile error) + `translate(lang,key,vars?)`.
   `src/app/_components/LangProvider.tsx` (React context, **default English**, reads
   `localStorage['lang']` post-mount → hydration-safe, `useT()`/`useLang()`). Nav **EN/ES toggle**;
   `t()` across **all public UI** in casual **northern-Mexican (Sonoran) Spanish** (tú/ustedes,
   "ocupar"=need, keep loanwords like "picks", team names untranslated). **Admin screens stay
   English.** **Tweak Spanish wording in the `es` block of `src/lib/i18n.ts`.**

The original foundation (5 earlier plans) still underpins it: NextAuth v5 + admin-approval gate;
`Team`/`Match` (31-slot) official-bracket model + `/admin/bracket`; user bracket fill + server lock;
penalty-safe **ESPN results feed** + round-weighted scoring + leaderboard/pot; post-lock visibility.

---

## How to run / verify

```bash
cd C:\Users\Oswaldo\wc_ko_26
npm run dev          # http://localhost:3000 (loads .env)
npx tsc --noEmit     # types
npx vitest run       # 160 tests
npx next build       # production build
```

- **`.env`** (gitignored; only `.env.example` placeholders are committed) holds `DATABASE_URL`,
  `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_EMAIL=gondaniel852@gmail.com`, `APP_URL`, optional
  `GMAIL_*`.
- **Stock Next.js 15.5.19** — the `AGENTS.md` note about reading `node_modules/next/dist/docs/`
  came from the sibling `wc26` fork and does **not** apply here (those docs aren't shipped; use
  standard App Router patterns).

### ⚠️ Windows / Prisma gotcha
The dev server locks Prisma's `query_engine-windows.dll.node`. **Stop the dev server before any
`prisma generate` / `db push`** (kill node processes whose command line matches `wc_ko_26`), then
restart. `db push` writes the live Neon DB — that's the project's migration mechanism.

### ⚠️ Dev "styling doesn't transfer" gotcha (recurring this session)
After many branch switches / dev-server restarts, the running `next dev` can serve a **404 for the
CSS chunk** (`/_next/static/css/app/layout.css`) → pages render unstyled. It's a stale `.next`
cache, **not a code bug** (production builds are fine). Fix: stop the dev server → `rm -rf .next`
→ `npm run dev`, then hard-refresh (Ctrl+Shift+R).

---

## Pending work (none blocking)

1. **Live logged-in EN↔ES + credits sweep.** The language toggle flips client-side (post-mount),
   so it can't be screenshotted from SSR — walk the public pages logged in: confirm Spanish renders
   and persists across refresh, `/admin` stays English, and the credits flow works (approve →
   1 credit → create → at-cap message → admin +1 → second bracket → both count in the pot).
2. **Rotate the Neon DB password** — it was pasted into an earlier chat. Reset in Neon
   (Roles → reset password) and update both URLs in `.env`. (Security item.)
3. **Official R32 field.** Replace the preview seed once the group stage ends (~June 27): set it at
   `/admin/bracket` or via "Refresh from feed". The live projection engine fills "As it stands"
   meanwhile. `resolveCode` alias gap: a live ESPN run showed one team name not resolving (→ "TBD"
   in projections) — add the alias in `src/lib/team-resolve.ts`/`teams.ts` once the specific name
   is captured (it shifts until standings finalize).
4. **Live end-to-end smoke test** with real users (signup → approve → fill → lock → results/feed →
   leaderboard → post-lock browse).
5. **Deferred minors** (logged in `.superpowers/sdd/progress.md`): add a `.gitattributes`
   (`* text=auto eol=lf`) to stop CRLF/LF drift; the unused `BracketLayout variant='two-sided'` is
   dead code; LangProvider's redundant `typeof window` guard; signup field errorKeys are generic;
   `backfill-credits.ts` uses a raw `'APPROVED'` string.

---

## Architecture / key files

- **Pure libs (`src/lib/`, unit-tested):** `bracket-structure.ts` (31-slot geometry + FIFA `FEEDERS`
  map + `ROUND_POINTS`), `bracket-picks.ts` (advancement cascade), `bracket-view.ts`, `scoring.ts`,
  `leaderboard-rank.ts`, `lock.ts`, `official-winners.ts`, `results-feed.ts` (ESPN results mapper),
  `team-resolve.ts`/`team-name.ts`/`team-flag.ts`, `bracket-visibility.ts`, `picks-json.ts`,
  `official-r32.ts`, `bracket-name.ts` (`normalizeBracketName`), `bracket-credits.ts`
  (`canCreateBracket`), `wc26-seeding.ts` (projections), `standings-feed.ts` (ESPN standings),
  `i18n.ts` (`translate` + dictionary), `teams.ts` (48 teams), `auth*.ts`, `profile.ts`,
  `username-filter.ts`.
- **Server actions (`src/app/actions/`):** `auth.ts` (signup grants admin 1 credit; returns error
  KEYS), `admin.ts` (`approveUser` grants 1 credit; `grantCredits`; no bracket-approval actions),
  `bracket.ts` (official R32), `bracket-entry.ts` (per-bracket: `listMyBrackets`/`createBracket`
  credit-gated/`getBracket`/`saveBracket`; returns error KEYS; no `deleteBracket`), `results.ts`,
  `leaderboard.ts` (counts all brackets), `browse.ts` (post-lock, per-user), `projection.ts`.
- **Pages (`src/app/`):** `page.tsx`+`HomeContent.tsx` (home), `official/`, `bracket/`+`bracket/[id]/`,
  `brackets/`+`brackets/[user]/`, `admin/`+`admin/bracket/`, `login/`, `signup/`.
- **Components (`src/app/_components/`):** `LangProvider.tsx`, `BracketLayout.tsx`, `RoundLabels.tsx`,
  `MarchMadnessBracket.tsx`, `TeamFlag.tsx`, `Countdown.tsx`. Plus `Nav.tsx` (client; EN/ES toggle).
- **DB:** `prisma/schema.prisma` (`User` w/ `credits`; `Team`, `Match`, `Bracket` w/ `name`,
  `PoolConfig`). Seeds: `prisma/seed.ts`, `prisma/seed-preview.ts`; migration `prisma/backfill-credits.ts`.
- **Stack:** Next.js 15.5 (App Router, stock), React 19, NextAuth v5 beta, Prisma 6 + Neon,
  Tailwind v4 + hand-written CSS (`src/app/globals.css`), `flag-icons`, Vitest 4 (160 tests).
- **Scratch:** `.superpowers/sdd/progress.md` (gitignored ledger of every task/review this build).

## Sibling apps (context)
`C:\Users\Oswaldo\nfl26` (auth system ported from there) · `C:\Users\Oswaldo\wc26` (ESPN feed +
theme conventions; a different group-stage pool on a custom Next fork).
