# WC26 Knockout Bracket — Handoff

_Last updated: 2026-06-26_

---

## 🟢 START HERE

**What this is:** `wc_ko_26` — a March Madness–style bracket pool for the **FIFA World Cup
2026 knockout stage**. Members enter one or more brackets (R32 → Final), scored by round,
on a live leaderboard with a pot. Stock **Next.js 15.5 App Router** app with its own **Neon
Postgres** DB. Feature-complete, running locally, and pushed to GitHub.

**Current state (all merged to `master`, tip `d4cf65c`, and pushed):**
- Remote: **`origin` = https://github.com/Babisimo/babo-wc-KO26.git**; `origin/master == master`. Auto-deploys to **Vercel** (all env vars set there). Latest session's commits are live in production via that auto-deploy.
- Verified latest session (2026-06-26): **`npx tsc --noEmit` clean · `npx vitest run` 212/212 (37 files) · `next lint` clean · `next build` 17 routes.**
- **New env var this session:** optional **`NEXT_PUBLIC_GA_ID`** (Google Analytics 4). Set in **Vercel → Production** (`G-V2HZMLKPFH`) — it's a build-time `NEXT_PUBLIC_` inline, so a **redeploy is required** after adding/changing it. Analytics only counts from install forward (no retroactive history).
- DB is live on Neon (us-west-2), schema includes **`Bracket.official`** (migration applied). Last reset to a **clean slate**: admin only, 0 brackets/results, official R32 cleared → the app runs in ESPN **As-it-stands / Confirmed** projection mode off the live group-stage feed.

> Seven sessions of work landed since the original 5-feature handoff below — see **"What changed since the original handoff"** next. The 5-feature section and architecture map below are still the foundation; read them for the base app.

**To resume:**
1. `cd C:\Users\Oswaldo\wc_ko_26 && npm run dev` → http://localhost:3000
2. Log in as admin: **gondaniel852@gmail.com** (the `ADMIN_EMAIL`; auto-approved + admin + auto-granted 1 credit).
3. Public pages: `/` (leaderboard), `/official` (real/projected bracket + EN/ES toggle in nav), `/bracket` (your brackets), `/brackets` (browse, post-lock). Admin: `/admin`, `/admin/bracket`.

---

## What changed since the original handoff (sessions through 2026-06-26)

Eight entries on top of the original 5-feature base. Newest first.

### `7317532`…`d4cf65c` — Google Analytics, home "make your picks" CTA, bracket image export (latest session, 2026-06-26)
Three additions; all pushed and live on Vercel.
- **Google Analytics 4.** `@next/third-parties` `<GoogleAnalytics gaId={…} />` in `layout.tsx`, **gated on `NEXT_PUBLIC_GA_ID`** (loads only when set — nothing in dev/unset envs). Var documented in `.env.example`; Measurement ID **`G-V2HZMLKPFH`** (stream `wc-2026-knockout`). Set it in **Vercel → Production**; redeploy to bake it in (build-time inline). No retroactive history.
- **Home "make your picks" CTA.** Signed-in users get a prominent gold `.cta` banner on `/` (`HomeContent.tsx`) linking to `/bracket`, above the countdown/leaderboard, so creating brackets is obvious (was only the hamburger "My brackets" link). New i18n `home.play*` (EN+ES).
- **Bracket image export** (brainstorm→spec→plan→build). **Export image** button in the **edit page** header (`EditHeader` in `bracket/BracketHeader.tsx`), shown only when the bracket is **complete** (`validateSubmission` — same rule as the list's Complete badge). Client-only PNG via **`html-to-image`**: `bracket/BracketExportButton.tsx` fetches the bracket (`getBracket` → `buildBracketView`), renders the full two-sided tree from the existing components (`MarchMadnessBracket layout="static"` → new exported **`BracketStatic`** in `BracketLayout.tsx`), snapshots it, then **shares via the Web Share API (mobile) or downloads** (filename = slugified name via `src/lib/bracket-export.ts` `bracketImageFilename`; capability probe `canShareFiles` — both unit-tested). Picks-only image (no scoring colors).
  - **⚠ Three hard-won gotchas — do NOT regress:**
    1. **Capture stage must be ON-SCREEN.** At `left:-100000px` the browser never paints it → **blank PNG**. Fixed by rendering at top-left under an opaque "Exporting…" cover (`.brd-export-portal`/`-tree`/`-cover` in `globals.css`), captured by ref, torn down after.
    2. **`skipFonts: true` is required.** Otherwise html-to-image walks every stylesheet's `cssRules` to inline web fonts and throws a **SecurityError on a cross-origin sheet → blank**. Trade-off: image text uses a **system font**, not the site display font. (Future: embed the two fonts via `fontEmbedCSS` to restore branding.)
    3. **Web Share needs HTTPS.** On the local LAN dev server (plain http) `navigator.canShare` is unavailable → it always **downloads**; the share sheet only appears on the **HTTPS Vercel** deploy. iOS Safari may still fall back to download if the gesture window lapses (mitigation: single-pass capture).
  - New: `src/lib/bracket-export.ts` (+test), `BracketExportButton.tsx`. Modified: `BracketLayout.tsx` (export `BracketStatic`, reuse in `BracketZoom`), `MarchMadnessBracket.tsx` (`layout` prop), `BracketHeader.tsx` (`EditHeader` takes `complete`), `bracket/[id]/page.tsx`, `globals.css`, `i18n.ts` (`bracket.export`/`exporting`/`exportFailed` EN+ES). Spec `docs/superpowers/specs/2026-06-26-bracket-image-export-design.md`, plan `docs/superpowers/plans/2026-06-26-bracket-image-export.md`. New deps: `html-to-image`, `@next/third-parties`.
- **Git identity:** this session's commits are authored **Oswaldo Gonzalez <Oswaldo@calvada.local>** by request — intentional, don't "fix" it (saved as the `git-identity` memory).

### `6b484d9`…`f5ca493` — Rename brackets + pre-lock pool visibility, credits-based pot (2026-06-26)
Two requested features plus the pot-model change they implied. **All pushed; live on Vercel.**
- **Rename brackets.** `renameBracket(id, name)` in `actions/bracket-entry.ts` (ownership-checked,
  **lock-gated** via `bracket.err.lockedRename`, reuses `normalizeBracketName`). Inline editor
  `src/app/bracket/RenameControl.tsx` (pencil → input, Enter saves / Esc cancels; hidden once
  locked) used in the **My Brackets** list and on the pick-page **`EditHeader`** (now takes `id`).
- **⚠ Pot model changed: `$50 × total credits` (was `$50 × official brackets`).** A player is "in"
  the moment they hold a credit — no need to mark a bracket official. New tested pure lib
  `src/lib/pool-stats.ts`: **`computePoolStats(users, entryCents)`** → `{ players = credit-holders,
  entries = sum of credits, potCents }`, and **`countFilledBrackets(brackets)`** = official brackets
  with all 31 games picked. `leaderboard.ts` now sizes the pot from credits (still **ranks official
  brackets only**); `board.players` is unused by UI.
- **Header pool pill.** `src/app/_components/PoolPill.tsx` — stable credits-based pot with a
  **filled-vs-paid** count, terse on the bar (**`$X · filled/total`**) with a tap/hover **popover**
  showing `N brackets × $50 = pot`, filled count, players, and a "see who's in" link to `/brackets`.
  Data from **`getPoolStats()`** (`actions/pool.ts`: `User.credits>0` + official picks + PoolConfig),
  fetched in `layout.tsx` (**signed-in only**) and passed to `Nav`.
- **Pre-lock roster.** `/brackets` now reveals **who's in + how many brackets each holds (= their
  credits)** BEFORE lock — **names + counts only; picks/scores stay hidden** until lock
  (`bracket-visibility.ts` unchanged). `getBracketsIndex` (`browse.ts`) + `IndexBody`
  (`brackets/BrowseText.tsx`); post-lock = the old official-bracket scored table.
- **Mobile header fix.** The pill overflowed the one-line nav → horizontal scroll. Pill label is
  terse (full detail in the popover + descriptive `aria-label`); at **≤600px** the pinned "Official"
  link drops into the hamburger and the pill shrinks (`globals.css` `.nav-official-pinned` /
  `.nav-official-menu` + media query). Popover uses a **solid dark backing** (was see-through via `.panel`).
- **New i18n (EN+ES):** `nav.pool` / `nav.poolAria` / `nav.poolBreakdown` / `nav.poolFilled` /
  `nav.poolPlayers` / `nav.poolView`; `browse.preLockLead` / `browse.preLockNone`; `bracket.rename` /
  `bracket.renameSave` / `bracket.renameCancel` / `bracket.err.lockedRename`. Spec:
  `docs/superpowers/specs/2026-06-25-rename-and-prelock-visibility-design.md`.
- **⚠ Gotcha (reviewed; decided to LEAVE AS-IS):** `approveUser` auto-grants **`credits: 1`**, so
  **approving any member puts them in the pot (+$50) even if they never paid.** Policy chosen:
  **manually zero out non-payers** — set an invited viewer's credits to `0` (admin **−1**) so they
  can still log in and browse but aren't counted. (Verified this session that the recent non-paying
  invitee was *not* in the pot.) Do **not** rely on approval status to mean "paid" — credits is the
  source of truth for the pot.

### `c321d95` — Signup autofill bugfix + clearer login/signup errors
**Real bug found after the notifications shipped:** a tester signed up with **Google autofill** and no
account was created (so no admin email, no badge — the notifications were correctly reporting 0). **Root
cause:** the signup **username** field was tagged `autoComplete="username"`, so the browser pasted the
saved **login email** into it; an email fails `validateUsername` (`/^[A-Za-z0-9_]{3,20}$/`), signup was
rejected, and a later login showed the generic "wrong email/password".
- **Fix (root cause):** `signup/page.tsx` — username field → `autoComplete="off"`; the **email** field now
  takes the `"username"` autofill slot (matches `login/page.tsx`) so the password manager fills email there.
- **Backstop:** `actions/auth.ts` `signup` returns a pointed **`auth.err.usernameEmail`** ("that looks like
  an email…") when an `@` still lands in the username field.
- **Login messages (requested):** `login/page.tsx` now calls a new **`diagnoseLoginIssue(email,password)`**
  server action → distinct **awaiting-approval / not-approved / invalid** messages. Backed by pure
  `loginIssue(user, passwordOk)` in `auth-status.ts` (tested) — only reveals pending/rejected when the
  password is correct (no account enumeration). New i18n: `auth.pending`, `auth.rejected`,
  `auth.err.usernameEmail` (EN+ES); `auth.invalid` no longer lumps in the approval case.

### `5f04819` — Admin pending-approval notifications
Admins now get a live, visible signal when someone requests an account (signs up → `User.status = PENDING`),
instead of having to open `/admin` and check.
- **Nav badge.** Red count bubble on the **hamburger button** and the **Admin** nav link, shown only
  to admins when the count > 0, capped at `99+`, with an EN/ES `aria-label`
  (`nav.pendingApprovals`). Styles `.nav-bubble` / `.nav-bubble-corner` in `globals.css`
  (modeled on `.badge`; burger got `position: relative`).
- **Live polling.** Count is server-rendered into `Nav` (computed in `layout.tsx`, **admin-only** query),
  then `Nav` polls **`/api/admin/notifications`** every **15s** and updates in place (re-syncs the prop on
  navigation, keeps last-known count on transient errors, clears on unmount). Does **not** pause on hidden tabs.
  Route is `GET`, `force-dynamic`, admin-guarded (non-admins → `{count:0}` 403).
- **Email.** `sendNewSignupNotice` in `src/lib/email.ts` emails **all `isAdmin` users** on signup with a
  link to `/admin`. **Best-effort**: wrapped in try/catch in `actions/auth.ts` `signup` (never blocks signup),
  skipped for the bootstrap admin, and silently no-ops when there are no admins or SMTP is unset. **No new env
  vars** — reuses the existing `GMAIL_USER` / `GMAIL_APP_PASSWORD` (same as password reset) and `APP_URL` for the link.
- **Extensible count.** `src/lib/notifications.ts` `getAdminNotificationCount()` sums a sources array;
  only source today is pending-user count. Add a notification type later = one line.
- New tested libs: `notifications.test.ts`, `email-signup-notice.test.ts` (TDD). Spec:
  `docs/superpowers/specs/2026-06-25-admin-pending-notifications-design.md`.

### `7459233` / `2a8e4d4` — Early drafts + designate-official brackets
**The credits model changed.** Creating a bracket is now **free and unlimited** before lock; a
**credit is spent only when a bracket is marked _Official_** (the paid entry). A user may mark up
to `credits` brackets official and **switch which are official freely until lock**. Only official
brackets count in the pot / leaderboard / browse / compare.
- **Start before the draw is final.** The fill page resolves an **effective R32** = the official
  draw where set, else the live **as-it-stands** projection, else `TBD`
  (`src/lib/effective-r32.ts` `mergeEffectiveR32`; `actions/projection.ts` `getProjectedR32`).
  **Partial saves** allowed (`src/lib/bracket-validate.ts` `validateDraft`).
- **Change flagging.** When real results later change a slot's teams the saved pick goes stale —
  `src/lib/bracket-changes.ts` `stalePicks` recomputes live; affected games get a highlight ring
  (`.bcard.stale`) + a "matches changed — review" banner, and the list shows a `⚠ N changed` badge.
  Confirmed slots never go stale.
- **Gate** `src/lib/bracket-credits.ts` `canMarkOfficial(officialCount, credits)`.
  `actions/bracket-entry.ts`: `createBracket` (free, no credit/draw gate), **`setBracketOfficial(id, bool)`**
  (new), `saveBracket` (partial via `validateDraft`), `listMyBrackets`/`getBracket` return `official`
  + stale/complete info. Counting → **official-only** in `leaderboard.ts`, `browse.ts`, `compare.ts`.
- **UI.** `/bracket` is always open (old "not open yet" gate removed) with an **Official X/credits**
  pill, per-row **Make official / Unmark** + **Complete/Partial** + **⚠ changed** badges, and a
  draw-pending banner. Fill page renders **TBD** placeholders, allows partial save, shows the changes
  warning + an "official (paid)" indicator.
- **Schema/migration:** added `Bracket.official Boolean @default(false)`; `prisma/backfill-official.ts`
  marks pre-existing brackets official (run against an empty table → 0). Spec:
  `docs/superpowers/specs/2026-06-25-drafts-and-official-brackets-design.md`.
- New tested pure libs `effective-r32` + `bracket-changes`; extended `bracket-credits`,
  `bracket-validate`. EN/ES i18n keys added (drift-guard enforced).

### `309b0e9` — Bracket UX rework + page loader + bigger stage meter
The app was considered "perfect all but the brackets." This unified the bracket experience:
- **One bracket view on every screen size.** Default is **round-by-round** (`R32 → R16 → QF → SF → Final` tabs, one round at a time, big readable cards with full team names + pair-connector lines). A **`Rounds | Full`** segmented toggle flips to **"Full"** = the map-style **pan/zoom two-sided tree**. Replaces the old desktop-only-zoom default and a short-lived separate mobile "Scroll" mode.
- **Swipe + tap navigation.** Swipe left/right (touch) or click a tab to change rounds; vertical drags still scroll the page. Cards **stagger-slide in** from the move direction (CSS keyframes `brd-card-in/-r/-l`, honors `prefers-reduced-motion`). Round column is centered at **max 520px** so wide desktops read like the phone.
- **Key files:** `src/app/_components/BracketLayout.tsx` (core — `Node`/`Centerpiece` two-sided tree, `BracketTabs` swipeable round view, `BracketZoom` camera, default export 2-way `view` state), `BracketCard.tsx` (emits both `.bcard-code` short + `.bcard-name` full spans), `globals.css` (`.brd-view-*` width-agnostic rules, swipe animation, `.brd-tab-*` connectors), `i18n.ts` (`bracket.viewRounds`/`bracket.viewFull`).
- **Page navigation loader.** New `src/app/loading.tsx` — App Router Suspense fallback shown in the content area (Nav persists, lives in root layout) while any page's data loads. Branded gold spinner (`.page-loading`/`.page-spinner` in `globals.css`).
- **Knockout Stage meter text enlarged** (`StageTracker.tsx` styles in `globals.css`): headline `1.05→1.28rem`, round names `0.72→0.88rem`, counts `0.66→0.8rem`, eyebrow `0.82rem`, dots `14→16px`.

### `98e01f2` — Official bracket fixes
- **Per-position Confirmed view.** `src/lib/wc26-seeding.ts` `seedR32` now returns `{ projected, confirmed }`; each R32 position confirms **independently** as soon as its group is decided (no longer waits for both teams of a match). `OfficialBracketView` + `actions/projection.ts` consume it.
- **Bosnia-Herzegovina (BIH) resolution.** Added aliases (`bosnia herzegovina`, `bosnia and herzegovina`, `bosnia`) in `src/lib/team-resolve.ts` — it was dropping to "TBD" in projections.
- Renamed the nav link **"Official" → "Official Bracket"**.

### `cd15ce2` — Compare, stage tracker, account, password reset, pan/zoom, polish
- **Compare** (`/compare`) — head-to-head **per-bracket** comparison.
- **Stage tracker** (`_components/StageTracker.tsx` + `src/lib/tournament-stage.ts`) — the Knockout Stage progress meter on home/official.
- **Account page** (`/account`) — username change, **max 2 changes**, ported from the `nfl26` sibling.
- **Forgot/Reset password** (`/forgot-password`, `/reset-password`) — email flow over **Gmail SMTP** (`GMAIL_USER`/`GMAIL_PASSWORD`, shared with `nfl26`). **Do not rotate these credentials.**
- **Long-lived sessions** (NextAuth JWT, 10-year maxAge) + password-manager autofill friendliness.
- **Logged-out landing** — recognizes auth state; shows a **log in / request account** CTA + bracket countdown (no leaderboard when logged out).
- **Leaderboard rows link** to the bracket; **hamburger header** (EN/ES + Official Bracket link always visible); admin-page mobile cleanup; pan/zoom brackets.

**Untracked on purpose** (local-only, not committed): `prisma/seed-sim-*.ts` (player/result/lock/partial simulation seeds), `docs/inspo-bracket/` (FotMob reference HTML/CSS), `.claude/` (worktrees, plans, memory).

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
   allowance. **⚠ Updated by `7459233` (see above): creating is now free; a credit is spent when a
   bracket is marked _Official_, and only official brackets count.** (Originally: create gated by
   `bracketCount < credits` via `canCreateBracket`.) **1 credit = 1 official bracket = $50; no
   refunds, no user deletion** (decisions are final). Approving a signup grants **1 credit**; admin grants more via **+1 / −1** on the members
   table (`grantCredits`). **Pot = `$50 × total credits` (changed latest session — was `$50 × total
   official brackets`; see the top entry).** `Bracket.status`/`approvedAt`/`approvedBy`
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
npx vitest run     # 212 tests
npx next build       # production build
```

- **`.env`** (gitignored; only `.env.example` placeholders are committed) holds `DATABASE_URL`,
  `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_EMAIL=gondaniel852@gmail.com`, `APP_URL`, optional
  `GMAIL_*`, optional **`NEXT_PUBLIC_GA_ID`** (GA4; also set in Vercel for production).
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
7. **Confirm `NEXT_PUBLIC_GA_ID` is set in Vercel (Production)** = `G-V2HZMLKPFH`, and redeploy if it
   was added after the last build (build-time inline). Then check **GA4 → Realtime** shows traffic.
8. **Bracket export polish (optional):** image text is a system font (`skipFonts`) — embed the two
   site fonts via html-to-image `fontEmbedCSS` to restore branding; and if **iOS Safari** drops to a
   download instead of the share sheet, switch the capture to a **single** `toPng` pass to shorten the
   user-gesture window. See the export gotchas in the latest-session entry above.
3. **Official R32 field.** Set the real field once the group stage ends (~June 27): at
   `/admin/bracket` or via "Refresh from feed". The live projection engine fills "As it stands /
   Confirmed" meanwhile. `resolveCode` alias gap: names shift until standings finalize — if a team
   shows "TBD" in projections, add its alias in `src/lib/team-resolve.ts`/`teams.ts` (BIH/Bosnia
   already handled in `98e01f2`).
6. **Sim seeds need `official: true`.** `prisma/seed-sim-players.ts` (untracked) creates brackets;
   under the new model they default to drafts, so set `official: true` on them or they won't appear
   on the leaderboard/pot.
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
  (`canCreateBracket` + `canMarkOfficial`), `effective-r32.ts` (`mergeEffectiveR32`),
  `bracket-changes.ts` (`stalePicks`), `bracket-validate.ts` (`validateSubmission` + `validateDraft`),
  `pool-stats.ts` (`computePoolStats` credits-based players/entries/pot + `countFilledBrackets`),
  `bracket-export.ts` (`bracketImageFilename` slug + `canShareFiles` Web Share probe — for image export),
  `notifications.ts` (`getAdminNotificationCount` — extensible admin-actionable count),
  `email.ts` (`sendPasswordResetEmail` + `sendNewSignupNotice`),
  `wc26-seeding.ts` (projections), `standings-feed.ts` (ESPN standings),
  `i18n.ts` (`translate` + dictionary), `teams.ts` (48 teams), `auth*.ts`, `profile.ts`,
  `username-filter.ts`.
- **Server actions (`src/app/actions/`):** `auth.ts` (signup grants admin 1 credit; emails admins a
  best-effort new-signup notice; `diagnoseLoginIssue` for specific login-failure messages; returns error
  KEYS), `admin.ts` (`approveUser` grants 1 credit;
  `grantCredits`; no bracket-approval actions; **`approveUser` auto-grants 1 credit → also adds the
  member to the pot; zero out non-payers manually**),
  `bracket.ts` (official R32), `bracket-entry.ts` (`listMyBrackets`/`createBracket` (free)/`getBracket`/
  `saveBracket` (partial)/`setBracketOfficial`/**`renameBracket`** (lock-gated); returns error KEYS; no
  `deleteBracket`), `results.ts`, `leaderboard.ts` (**ranks** official brackets; **pot = $50 × credits**),
  **`pool.ts`** (`getPoolStats` for the header pill), `browse.ts` (pre-lock roster of credit-holders;
  picks hidden) / `compare.ts` (post-lock, official only), `projection.ts` (`getProjectedBracket` + `getProjectedR32`).
- **Pages (`src/app/`, 14):** `page.tsx`+`HomeContent.tsx` (home), `official/`, `bracket/`+`bracket/[id]/`,
  `brackets/`+`brackets/[user]/`, `compare/`, `account/`, `forgot-password/`, `reset-password/`,
  `admin/`+`admin/bracket/`, `login/`, `signup/`. Root `loading.tsx` = navigation spinner.
  **API route:** `api/admin/notifications/route.ts` (admin-guarded live pending-approval count, polled by `Nav`).
- **Components (`src/app/_components/`):** `LangProvider.tsx`, `BracketLayout.tsx` (round-tabs+swipe /
  pan-zoom tree), `BracketCard.tsx`, `RoundLabels.tsx`, `MarchMadnessBracket.tsx`, `StageTracker.tsx`
  (Knockout Stage meter), `TeamFlag.tsx`, `Countdown.tsx`, **`PoolPill.tsx`** (header pot/who's-in pill
  + breakdown popover). Plus `Nav.tsx` (client; hamburger + EN/ES toggle + admin pending-approval badge
  w/ 15s polling + the pool pill), `bracket/RenameControl.tsx` (inline bracket rename), and
  **`bracket/BracketExportButton.tsx`** (PNG export on the edit page; `MarchMadnessBracket layout="static"`
  + `BracketStatic`; on-screen-covered capture; see export gotchas above). `layout.tsx` renders
  **`<GoogleAnalytics>`** (`@next/third-parties`) when `NEXT_PUBLIC_GA_ID` is set.
- **DB:** `prisma/schema.prisma` (`User` w/ `credits`; `Team`, `Match`, `Bracket` w/ `name` +
  **`official`**, `PoolConfig`). Seeds: `prisma/seed.ts`, `prisma/seed-preview.ts`; migrations
  `prisma/backfill-credits.ts`, `prisma/backfill-official.ts`.
- **Stack:** Next.js 15.5 (App Router, stock), React 19, NextAuth v5 beta, Prisma 6 + Neon,
  Tailwind v4 + hand-written CSS (`src/app/globals.css`), `flag-icons`, Vitest 4 (203 tests).
- **Scratch:** `.superpowers/sdd/progress.md` (gitignored ledger of every task/review this build).

## Sibling apps (context)
`C:\Users\Oswaldo\nfl26` (auth system ported from there) · `C:\Users\Oswaldo\wc26` (ESPN feed +
theme conventions; a different group-stage pool on a custom Next fork).
