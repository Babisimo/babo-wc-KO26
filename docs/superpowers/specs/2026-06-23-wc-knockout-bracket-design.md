# WC 2026 Knockout Bracket Pool — Design Spec

**Date:** 2026-06-23
**Project:** `wc_ko_26` (C:\Users\Oswaldo\wc_ko_26)
**Status:** Approved design — ready for implementation planning

## Overview

A March Madness–style bracket pool for the FIFA World Cup 2026 **knockout stage**. Each approved member fills out exactly **one** bracket predicting the winner of every game from the Round of 32 through the Final. Correct picks earn points weighted by round. Brackets are private until a global lock, after which everyone can view each other's brackets and a live leaderboard.

It is a sibling to two existing apps:
- **wc26** — supplies the live results-feed library pattern (external sports APIs → pure mapping → scoring) and styling conventions.
- **nfl26** — supplies the authentication stack (NextAuth v5 + Prisma + PostgreSQL), extended here with an admin-approval gate that nfl26 lacks.

This app uses its **own separate PostgreSQL database** for logins, admins, and brackets.

## Goals

- Exclusive, invite-quality pool: **every new account must be approved by an admin** before it can log in.
- One bracket per user, NCAA-style: predict all 31 games up front.
- Round-weighted scoring; live auto-scoring from a sports feed with admin override.
- Brackets stay private until a hard global lock, then become publicly viewable.
- Live leaderboard; ties split the pot (no tiebreakers).

## Non-Goals

- No 3rd-place playoff scoring.
- No per-round re-picking (it is a single up-front bracket, not round-by-round).
- No tiebreaker logic — tied leaders simply split the pot.
- Not built on the wc26 custom Next.js fork; uses standard Next.js.

## Scoring

| Round | Games | Points each | Round max |
|---|---|---|---|
| Round of 32 | 16 | +1 | 16 |
| Round of 16 | 8 | +2 | 16 |
| Quarterfinal | 4 | +4 | 16 |
| Semifinal | 2 | +8 | 16 |
| Final | 1 | +16 | 16 |

- **Perfect bracket = 80 points.**
- A pick is correct when the user's predicted winner for a given bracket **slot** equals the actual winner of that slot. A team a user advanced that did not actually reach/win that slot is simply wrong — no special handling needed.

## Tech Stack

- **Next.js 15.5 (App Router)** + React 19 — matches nfl26's proven auth stack (standard Next.js, **not** the wc26 custom fork).
- **NextAuth v5** (Credentials provider, JWT session) + **bcryptjs** (cost 10).
- **Prisma 6 + PostgreSQL (Neon)** — a **new, separate database** with its own `DATABASE_URL` / `DIRECT_URL`.
- **Tailwind v4** + hand-written CSS custom properties (wc26 convention).
- **Vitest** for unit tests on the pure scoring/mapping functions.
- Ported, framework-agnostic results-feed library from wc26 (`fetch` + pure mappers).
- Optional: `nodemailer` (Gmail SMTP) for password-reset email, degrading gracefully if unconfigured.

## Data Model (Prisma, new DB)

### User (ported from nfl26 + approval gate)
- `id`, `email` (unique), `name`, `username` (unique, nullable), `firstName`, `lastName`, `passwordHash`, `isAdmin` (bool), `createdAt`.
- **New approval fields:** `status` enum `UserStatus { PENDING | APPROVED | REJECTED }` (default `PENDING`), `approvedAt` (nullable), `approvedBy` (nullable user id).
- New signups are `PENDING` and **cannot authenticate** until an admin approves. The NextAuth `authorize()` callback returns a clear "account awaiting approval" / "not approved" failure for non-`APPROVED` users.
- Admin bootstrap: the user whose email matches `ADMIN_EMAIL` is auto-`isAdmin` **and** auto-`APPROVED` on signup (so the first admin can get in without a pre-existing approver).

### PasswordResetToken (ported from nfl26)
- `id`, `userId`, `tokenHash` (SHA-256 of raw token), `expiresAt`, `usedAt` (nullable, single-use), `createdAt`. Raw token never stored.

### Match (official bracket skeleton + results)
- 31 rows, one per knockout game, identified by a fixed `slot` (1–31).
- Fields: `slot` (unique), `round` enum `Round { R32 | R16 | QF | SF | FINAL }`, `teamA` / `teamB` (team codes; admin-set for R32, derived from feeder slots for later rounds), `actualWinner` (team code, nullable until decided), `kickoff` (DateTime, nullable), `feedRef` (string, nullable — used to match the external feed).
- Bracket-tree wiring: each non-R32 match references its two feeder slots so later-round participants can be derived from earlier winners.
- Admin sets the R32 skeleton (16 matchups) and kickoffs once the group stage concludes. The feed (or admin override) fills `actualWinner`.

### Bracket (one per user)
- `id`, `userId` (unique), `submittedAt` (nullable until first submit), `updatedAt`.
- The 31 predictions stored as `slot → predicted team code` (a `BracketPick` child table keyed by `(bracketId, slot)`, or an equivalent JSON map — to be finalized in the plan).
- Read-only after the global lock; server enforces.

### Team
- `code`, `name`, `colors`, `flag` — adapted from wc26's `lib/teams.ts` (the 48-team FIFA table), filtered/used for knockout participants.

### Pool config (admin)
- A small singleton/config holding the **pot amount** (displayed on the leaderboard) and any other admin-tunable values.

## Results & Scoring Flow

Reuse the wc26 architecture: `lib/*-source.ts` (fetch + pure map) → `lib/scoring.ts` (pure) → `lib/leaderboard.ts` (orchestrator) → thin route handlers.

1. **Feed ingest:** poll the external sports feed (ESPN / TheSportsDB, provider chosen by env), map finished knockout games to `Match.actualWinner` by team-pair / `feedRef`.
2. **Admin override:** an admin can set/correct `actualWinner` for any slot; overrides win over the feed (mirrors wc26's override store, here persisted in the DB).
3. **Derived rounds:** later-round `Match` participants (`teamA`/`teamB`) derive from feeder slot winners.
4. **Scoring:** pure function over all users — for each decided slot, `predicted === actual ? roundPoints : 0`, summed per user.
5. **Leaderboard:** rank by total points with **shared ranks**; everyone at rank 1 splits the pot. Show pot amount.

Pure mapping/scoring functions are unit-tested with Vitest (wc26 pattern).

## Lock & Countdown

- **Global lock time = (earliest R32 kickoff) − 1 hour.**
- Displayed as a **live countdown timer in PST** (`America/Los_Angeles`) on the bracket page and home page.
- The **server enforces** the lock: bracket create/edit/submit requests are rejected once `now >= lockTime`. The client shows the timer and disables editing at zero (UX only; server is the source of truth).

## Privacy / Visibility

- **Before lock:** a user can see only their own bracket. Others' brackets and the live leaderboard detail are hidden (enforced server-side).
- **After lock:** all brackets become viewable (`/brackets`, `/brackets/[user]`) and the live leaderboard is public.

## Pages

Ported-from-nfl26 auth pages:
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/complete-profile`.

New app pages:
- `/` — leaderboard (live after lock), pot amount, and lock countdown timer.
- `/bracket` — the user's interactive bracket: fill/edit before lock, read-only after.
- `/brackets` — index of all users' brackets (only after lock).
- `/brackets/[user]` — view a specific user's bracket (only after lock).
- `/admin` — admin control room:
  - **Approval queue:** list `PENDING` users; approve / reject.
  - Set/confirm the R32 skeleton (16 matchups) + kickoffs.
  - Lock control / view computed lock time.
  - Result overrides per slot.
  - User management (remove user, set admin) — ported from nfl26 with last-admin guards.

## Route Protection

Per-page server-side guards (nfl26 pattern; no middleware):
- Authenticated pages call `auth()` and `redirect('/login')` when unauthenticated.
- Profile-completion gate (`/complete-profile`) ported from nfl26.
- Admin pages and **all admin server actions** independently re-check `requireAdmin()` — never trust the UI.
- Visibility-gated routes (`/brackets*`, live leaderboard) check the lock state server-side.

## Theme / Visual Design

A fresh, **bracket-first** aesthetic (distinct from wc26's leaderboard theme) using **WC 2026 colors** and a football/soccer feel:
- Pitch-green field tones and WC26 brand-adjacent palette.
- A connected bracket-tree layout (R32 → Final) as the centerpiece.
- Country flags and team colors on each matchup.
- The `frontend-design` skill will guide UI implementation for a polished, non-generic result.

## Environment Variables (new app)

Auth/DB (from nfl26):
- `DATABASE_URL`, `DIRECT_URL` — the **new** Postgres database.
- `AUTH_SECRET` — NextAuth JWT secret.
- `ADMIN_EMAIL` — auto-admin + auto-approved bootstrap account.
- `APP_URL` — base URL for password-reset links.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — optional, for reset email.

Results feed (from wc26):
- `RESULTS_PROVIDER`, `THESPORTSDB_KEY`, `FOOTBALL_DATA_TOKEN` (as applicable).

## Testing Strategy

- **Vitest unit tests** (wc26 pattern) for the pure functions: feed mappers, bracket-tree derivation, and the scoring function (including the round-weighted totals and the "advanced a team that didn't win the slot" case).
- Auth/approval flow: verify non-`APPROVED` users cannot authenticate; verify approval transitions.
- Lock enforcement: verify server rejects edits at/after lock time.

## Open Items / To Finalize in Plan

- Exact storage shape for `Bracket` predictions (normalized `BracketPick` rows vs JSON map).
- Precise feeder-slot wiring representation for the bracket tree.
- Provider choice + self-healing fallback specifics for the knockout feed.
