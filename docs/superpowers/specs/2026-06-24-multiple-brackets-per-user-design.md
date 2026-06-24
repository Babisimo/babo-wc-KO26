# Multiple Brackets Per User — Design

_Date: 2026-06-24_
_Status: approved design, pending spec review_

## Goal

Let a user enter the pool with more than one bracket. Each extra bracket is admin-approved
before it counts. The pot scales with paid (approved) entries: **pot = $50 × number of
approved brackets**. Today the schema enforces one bracket per user (`Bracket.userId
@unique`) and the pot already computes `entryCents × bracketCount` — so the change is to
remove the one-per-user constraint, add per-bracket identity + approval, and count only
approved brackets.

## Decisions (locked with the user)

1. **Per-bracket approval.** Any approved user can create multiple brackets; each
   additional bracket is `PENDING` until an admin approves it. Only `APPROVED` brackets
   count toward the pot and appear on the leaderboard.
2. **First bracket auto-approved.** A user's first bracket is created `APPROVED` (they are
   already an approved account); each subsequent bracket is `PENDING`.
3. **User-named brackets.** The user names each bracket (short free text); blank defaults
   to `"Bracket N"`. The leaderboard shows "username — bracketname".
4. **Pot = $50 × approved-bracket count.**
5. **Single global lock** (unchanged): no new brackets or edits after lock. Admin may
   still approve/reject `PENDING` brackets after lock (picks are already frozen); a bracket
   still `PENDING` at scoring time simply does not count.
6. **No hard cap** on bracket count — admin approval is the gate.
7. **Delete rules:** a user may delete their own `PENDING` or `REJECTED` bracket; an
   `APPROVED` bracket cannot be deleted (it is a counted entry).
8. **Editing does not reset approval:** an `APPROVED` bracket stays `APPROVED` when edited
   (until lock); approval gates the entry's existence, not each save.

## Non-goals (YAGNI)

- No payment integration — "approved" is the manual paid/legit gate; pot is just a count.
- No per-bracket lock times (one global lock as today).
- No change to scoring weights, the official bracket, results feed, or auth.
- No bracket-count limit UI (approval is the control).

---

## Data model — `prisma/schema.prisma`

```prisma
enum BracketStatus {
  PENDING
  APPROVED
  REJECTED
}

model Bracket {
  id          String        @id @default(cuid())
  userId      String                                 // was @unique — now many per user
  name        String        @default("Bracket 1")    // default backfills existing rows on db push
  status      BracketStatus @default(APPROVED)        // default backfills existing rows as counted
  picks       Json          @default("{}")
  submittedAt DateTime?
  approvedAt  DateTime?
  approvedBy  String?                                  // admin userId
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([userId])
}
```

- **Removing `@unique` on `userId`** is what allows multiple brackets.
- **`status` defaults to `APPROVED`** so existing rows backfill as counted on `db push`
  (no data-migration script needed). The create-action ALWAYS sets `status` explicitly
  (first → `APPROVED`, extra → `PENDING`), so the default only governs the historical
  backfill — never new brackets. (Documented in `bracket-entry.ts`.)
- **`name` defaults to `"Bracket 1"`** so the new non-null column backfills existing rows
  on `db push`.
- **Windows/Prisma:** stop the dev server before `prisma generate` / `prisma db push`
  (engine DLL lock), then restart.

---

## Architecture / files

### Bracket name validation — `src/lib/bracket-name.ts` (new, pure, tested)

`normalizeBracketName(raw: string | null | undefined, fallbackIndex: number): string`
— trims; collapses internal whitespace; caps length (e.g. 32 chars); strips control
chars; returns `"Bracket {fallbackIndex}"` when empty. Keep it simple — this is a label,
not a username (no uniqueness, no profanity gate beyond trimming).

### User bracket actions — `src/app/actions/bracket-entry.ts` (rework)

The single-bracket API (`getMyBracket`/`saveBracket` keyed by `userId`) becomes a
multi-bracket API keyed by `bracketId`, all auth-guarded and ownership-checked:

- `listMyBrackets(): Promise<{ error?: string; brackets?: MyBracketRow[]; lock: LockInfo }>`
  — the caller's brackets (id, name, status, submittedAt, complete?), newest-first, plus
  lock state + `officialReady`.
- `createBracket(name: string): Promise<{ error?: string; id?: string }>` — blocked when
  locked or `!officialReady`. Status = `APPROVED` if this is the user's **first** bracket,
  else `PENDING`. Name via `normalizeBracketName(name, count+1)`.
- `getBracket(id: string): Promise<{ error?: string; view?: BracketView }>` — ownership
  enforced (the bracket's `userId` must equal the session user); `BracketView` gains
  `id`, `name`, `status`.
- `saveBracket(id: string, picks: Picks)` — ownership + lock + `validateSubmission`
  enforced; updates that bracket's picks; status unchanged (decision #8).
- `deleteBracket(id: string)` — ownership enforced; allowed only when status is `PENDING`
  or `REJECTED` (decision #7).

### Admin bracket-approval actions — `src/app/actions/admin.ts` (extend) or `bracket-admin.ts`

- `listPendingBrackets()` — admin-guarded; `PENDING` brackets joined with user
  name/username, for the approval queue.
- `approveBracket(id)` / `rejectBracket(id)` — admin-guarded; set status (+ `approvedAt`,
  `approvedBy = admin id` on approve). Reuse the existing admin guard (`admin-guard.ts`).

### Leaderboard — `src/app/actions/leaderboard.ts`

- Query `db.bracket.findMany({ where: { status: 'APPROVED' } })`.
- **Key each entry by `bracketId`** (not `userId`) so one user can hold several rows;
  label = `"{username} — {bracketName}"`.
- `players` / pot count = approved brackets: `potCents = entryCents × approvedCount`.
  (Rename the field meaning in the type comment; the home page already renders pot from
  `potCents`.)

### Post-lock visibility — `src/app/actions/browse.ts`, `/brackets`, `/brackets/[user]`

- `/brackets` (index) lists each **approved** bracket (by name) once brackets are visible
  (after lock, per existing `bracket-visibility.ts` rules — unchanged).
- `/brackets/[user]` → keyed by `bracketId` now (a user may have several). Simplest: route
  becomes `/brackets/[bracketId]` showing one approved bracket; the index links each
  approved bracket to its own page. (Confirm route shape in the plan; keep the existing
  visibility gate.)

### Pages / components

- **`/bracket`** → "My brackets": `listMyBrackets()` → list (name · status badge · Edit ·
  Delete-if-pending/rejected) + "New bracket" (name prompt → `createBracket`). Editing a
  bracket renders the existing `BracketFill` for that `bracketId`.
- **`BracketFill`** takes a `bracketId` and calls `saveBracket(id, picks)`.
- **`/admin`** → add a "Brackets" approval section (pending queue grouped by user, Approve
  / Reject), alongside the existing user-approval queue. Reuse the table/badge styles.

---

## Data flow

1. User opens `/bracket` → `listMyBrackets` → sees their brackets + "New bracket".
2. "New bracket" → `createBracket(name)` → first = `APPROVED`, extras = `PENDING` → edit
   page for the new `bracketId`.
3. User fills/saves via `saveBracket(id, picks)` until lock.
4. Admin opens `/admin` → pending queue → `approveBracket`/`rejectBracket`.
5. `getLeaderboard` counts only `APPROVED` brackets → pot = $50 × that count → one row per
   approved bracket.
6. After lock, `/brackets` lists approved brackets; each opens its read-only tree.

## Error handling

- All user actions: auth guard + ownership check (a user can only read/edit/delete their
  own brackets); admin actions: admin guard. Lock enforced server-side on create/save.
  Friendly `{ error }` returns (existing pattern).

## Migration / rollout

- `prisma db push` adds the columns; existing rows backfill to `status=APPROVED`,
  `name="Bracket 1"` via the column defaults — existing entrants keep their standing with
  zero downtime. No separate data script.

## Testing

- **Unit (Vitest):** `bracket-name` (trim/collapse/cap/empty→default); `leaderboard-rank`
  already covers ranking — add a case proving multiple keys per user rank independently;
  scoring unchanged.
- **Server actions:** ownership + lock + first-auto-approve logic are the risk areas;
  cover with focused tests where the existing suite mocks auth/db, else exercise the pure
  helpers (status-selection function extracted as pure: `statusForNewBracket(existingCount)`).
- **Type/build:** `npx tsc --noEmit`, `npx next build`.
- **Manual:** create 2 brackets as a user (1st approved, 2nd pending), approve as admin,
  confirm pot = $50 × approved and both approved rows on the leaderboard.

## Open questions for spec review

- Route shape for per-bracket public view: `/brackets/[bracketId]` (recommended) vs keeping
  `/brackets/[user]` and listing that user's approved brackets on one page?
- Bracket-name max length (proposed 32) and whether to reuse any part of the existing
  `username-filter` for sanitization (proposed: no — labels are low-stakes).
