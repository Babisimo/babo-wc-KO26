# Bracket Credits + Member Display — Design

_Date: 2026-06-24_
_Status: approved design, pending spec review_

## Goal

Replace the per-bracket admin-approval model (just merged) with a **credit allowance**:
`1 credit = 1 bracket = $50`, granted by the admin. A user may create brackets while
`bracketCount < credits`. **No refunds, no deletion — once a bracket is made it's final**
("money sent = decision final"). Also surface members by **username with their first name
shown** for recognition, and show **all four member fields** (username, first name, last
name, email) on the admin members page.

## Decisions (locked with the user)

1. **Credits = a hard allowance (max brackets a user may hold)**, not a spendable balance.
   Create allowed only while `bracketCount < credits`. No spend-down, no refund, no
   user-facing delete.
2. **Approving a signup grants 1 credit** (the user's first bracket). The admin grants
   more credits on the member row for anyone who buys additional brackets.
3. **No per-bracket approval anymore** — the credit *is* the entitlement; every bracket a
   user creates counts immediately. Remove `Bracket.status`/`approvedAt`/`approvedBy`, the
   admin **bracket-approval queue**, the `approveBracket`/`rejectBracket` actions, and the
   user **Delete** button.
4. **Pot counts every bracket** (each required a paid credit): `pot = $50 × total brackets`.
5. **Username is the public handle, with the first name shown next to it** (e.g.
   `alice (Alicia) — Long shot`) on the leaderboard and browse.
6. **Admin → All members** shows username, first name, last name, email, plus a **credits**
   column with a grant control.

## Non-goals (YAGNI)

- No payment integration — a "credit" is the manual paid entitlement; the admin grants it.
- No refund / credit-return / bracket-deletion flow.
- No change to scoring, the official bracket, results feed, lock, or auth mechanism.
- No locale/i18n work here (that's the separate EN/ES plan, executed after this).

## Relationship to the merged multi-bracket feature

This **reverts the approval half** of `feat/multi-bracket` and replaces it with credits:
- Drop `Bracket.status`/`approvedAt`/`approvedBy`; drop `statusForNewBracket` (the
  first-auto-approve helper) from `bracket-name.ts` (keep `normalizeBracketName`).
- Remove `approveBracket`/`rejectBracket` (admin.ts) and the admin bracket-approval queue
  section (admin/page.tsx).
- Remove `deleteBracket` (bracket-entry.ts) and the Delete button + status badges
  (MyBrackets.tsx).
- Leaderboard/browse drop the `status: 'APPROVED'` filter (count all brackets).
The interactive fill, the bracket tree, multiple-brackets-per-user, and the per-bracket
identity (`name`) all stay.

> **Cross-feature note:** the EN/ES i18n plan (`docs/superpowers/plans/2026-06-24-es-en-i18n.md`)
> Task 6 references bracket keys that this feature removes (`bracket.statusPending`,
> `bracket.awaitingApproval`, the Delete label) and adds new copy (credits-used, at-cap
> message). When i18n is executed (after this merges), update that task to the
> post-credits bracket UI.

---

## Data model — `prisma/schema.prisma`

```prisma
model User {
  // …existing fields…
  credits Int @default(0)   // max brackets this user may hold (1 granted on approval)
}

model Bracket {
  id          String    @id @default(cuid())
  userId      String
  name        String    @default("Bracket 1")
  picks       Json      @default("{}")
  submittedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  // REMOVED: status, approvedAt, approvedBy  (+ the BracketStatus enum)
  @@index([userId])
}
```

### Migration (live Neon, `db push`)

1. Edit schema: add `User.credits Int @default(0)`; remove `Bracket.status`/`approvedAt`/
   `approvedBy` and the `BracketStatus` enum.
2. **Backfill credits before/after push is independent** — run a one-off
   `npx tsx --env-file=.env prisma/backfill-credits.ts` that, for every **APPROVED** user,
   sets `credits = max(<their current bracket count>, 1)` so no existing bracket exceeds
   the new cap (unapproved users stay at 0). Idempotent.
3. `npx prisma db push`. (Windows: stop the dev server first — engine DLL lock.)

Order note: counting brackets for the backfill works whether or not the status column is
already dropped (it counts `Bracket` rows by `userId`). Run the backfill once around the
push; re-running is safe (it recomputes from current rows, `max(..,1)`).

---

## Architecture / files

### Credit grants — `src/app/actions/auth.ts` + `src/app/actions/admin.ts`

- **`auth.ts` signup:** the bootstrap-admin branch already sets `status: 'APPROVED'`; also
  set `credits: 1` for the bootstrap admin (others remain `credits: 0`, PENDING).
- **`admin.ts` `approveUser`:** when approving, also grant the baseline credit
  (`credits: 1`). (A PENDING user has 0; re-approval isn't a real path.)
- **`admin.ts` new `grantCredits(targetUserId, delta)`** (admin-guarded): `credits =
  max(0, credits + delta)`; used by the members table's grant control. Remove
  `approveBracket`/`rejectBracket`.

### Bracket creation gated by credits — `src/app/actions/bracket-entry.ts`

- `createBracket(name)`: load the user's `credits` and current `bracketCount`; allow only
  while `bracketCount < credits` (plus the existing `officialReady`/lock checks). At cap →
  `{ error: "You've used all your brackets — buy another to add one." }`. Drop the
  status/first-auto-approve logic; created brackets carry no status.
- `listMyBrackets()`: also return `{ credits, used }` (used = bracketCount) so the UI can
  gate "New bracket". `MyBracketRow` drops `status`.
- `getBracket`/`BracketView`: drop `status`.
- **Remove `deleteBracket`.**

### Count all brackets + first-name display — `leaderboard.ts` / `browse.ts`

- Drop `where: { status: 'APPROVED' }` (count every bracket). Pot unchanged in formula
  (`entryCents × bracketCount`) — now over all brackets.
- Fetch `firstName` alongside `username`/`name`. Display handle =
  `username (firstName)` when `firstName` is set, else `username`. Leaderboard row label =
  `"{handle} — {bracketName}"`; browse index/user heading = `"{handle}"`.

### User bracket UI — `src/app/bracket/MyBrackets.tsx` + `page.tsx`

- Remove the **status badge** column and the **Delete** button.
- Show **"{used} of {credits} brackets"**. "New bracket" input/button enabled only while
  `used < credits`; at cap, hide the input and show
  "You've used all your brackets — buy another to add one."
- `page.tsx` passes `credits`/`used` through from `listMyBrackets`.

### Admin members page — `src/app/admin/page.tsx`

- **Remove** the "Bracket entries awaiting approval" section entirely.
- **All members** table columns: **Username · First name · Last name · Email · Credits ·
  Actions**. Actions include the existing admin toggle/remove plus a **grant control**
  (e.g. a "+1 credit" button, and "−1"), wired to `grantCredits(id, ±1)`. The pending-user
  approval section stays (approve now also grants the first credit).

---

## Data flow

1. Admin approves a signup → user `status=APPROVED`, `credits=1`.
2. User opens `/bracket` → sees "0 of 1 brackets" → creates + fills their bracket (now
   "1 of 1"); "New bracket" disabled at the cap.
3. User buys another → admin clicks "+1 credit" (`grantCredits`) → user now "1 of 2" → can
   create a second bracket.
4. Leaderboard/browse/pot count all brackets; rows show `username (First) — bracketname`.

## Error handling

All credit checks are server-enforced in `createBracket` (auth + credits + lock); the
client gating is UX only. Admin grant/approve are admin-gated. No deletion path exists.

## Testing

- **Unit (Vitest):** a pure `canCreateBracket(used, credits)` helper (true iff
  `used < credits`) — tested at the boundary (0/1, 1/1, 1/2). Existing suite stays green;
  `bracket-name` keeps `normalizeBracketName` (drop `statusForNewBracket` + its tests).
- **Type/build:** `tsc --noEmit`, `next build`.
- **Manual:** approve a user → they get 1 credit → create 1 bracket → "New bracket" blocked
  → admin +1 credit → create a 2nd → both count in the pot; confirm leaderboard shows
  `username (First)`; confirm admin members shows all four fields + credits.

## Resolved decisions (spec review, 2026-06-24)

- **Grant control:** per-member **+1 / −1** buttons (`grantCredits(id, ±1)`,
  `credits = max(0, credits ± 1)`).
- **At-cap copy:** "You've used all your brackets — buy another to add one." (same string
  server-side in `createBracket` and client-side in `MyBrackets`).
