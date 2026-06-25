# Admin Pending-Approval Notifications — Design

**Date:** 2026-06-25
**Status:** Approved (pending spec review)

## Problem

New users sign up and land in `status = PENDING`, waiting for an admin to approve
them at `/admin`. Today there is **no signal** to admins that someone is waiting —
no email and no in-app indication. Admins have to visit `/admin` and check.

We want:

1. An in-app **count bubble** on the hamburger button and on the **Admin** nav
   link showing the number of pending approvals.
2. An **email to admins** when a new user signs up (best-effort).

## Constraints / Existing Architecture

- Next.js 15 App Router, React 19, server components + server actions. No
  React Query / SWR.
- Auth: NextAuth v5 beta, JWT session. `isAdmin` and approval `status` live on
  the `User` model (`UserStatus = PENDING | APPROVED | REJECTED`).
- Approval is modeled purely as `User.status`; there is **no** Notification model
  and no notification system today.
- Root `layout.tsx` is an async server component that already calls `auth()` and
  passes `isAdmin` into `<Nav>`.
- Styling: large custom `globals.css` with semantic classes (`.badge`, `.pill`,
  `.navlink`, `.nav-burger`, `.nav-links`). Tailwind present but barely used —
  match the custom-class convention.
- i18n via `src/lib/i18n.ts` (EN + ES), accessed through `useT`.
- Email: existing nodemailer/Gmail setup in `src/lib/email.ts`
  (`sendPasswordResetEmail`), configured by `GMAIL_USER` / `GMAIL_APP_PASSWORD`.
- Tests: Vitest, `src/lib/*.test.ts`.

## Decisions

- **Scope:** in-app badge **+** email to admins. No Notification DB model.
- **What counts:** pending approvals only now, but the count is computed by an
  **extensible helper** that sums an internal list of sources, so future
  notification types are a one-line addition.
- **Email recipients:** all users with `isAdmin = true`, **best-effort** — failures
  are logged and never block signup.
- **Bubble style:** numeric count on **both** the hamburger button and the Admin
  link.
- **Refresh:** server-side per page load (no polling/websockets). Updates when the
  admin navigates or refreshes.

## Components

### 1. `src/lib/notifications.ts` (new)

```ts
import { db } from './db'

// Each source returns a count of admin-actionable items.
// Add future notification sources to this array.
async function pendingApprovalsCount(): Promise<number> {
  return db.user.count({ where: { status: 'PENDING' } })
}

const sources: Array<() => Promise<number>> = [
  pendingApprovalsCount,
]

export async function getAdminNotificationCount(): Promise<number> {
  const counts = await Promise.all(sources.map((s) => s()))
  return counts.reduce((a, b) => a + b, 0)
}
```

- What it does: returns the total number of admin-actionable items.
- How to use it: call from server components where an admin badge is needed.
- Depends on: `db` (Prisma).

### 2. `src/app/layout.tsx` (edit)

After deriving `isAdmin`, compute the count **only when admin** (skip the query
otherwise) and pass it to `Nav`:

```tsx
const isAdmin = !!session?.user?.isAdmin
const adminNotifications = isAdmin ? await getAdminNotificationCount() : 0
...
<Nav signedIn={...} isAdmin={isAdmin} adminNotifications={adminNotifications} />
```

### 3. `src/app/Nav.tsx` (edit)

- New prop: `adminNotifications?: number` (default 0).
- Next to the Admin link (rendered only when `isAdmin`): when
  `adminNotifications > 0`, render a `<span className="nav-bubble">` with the
  count.
- On the `nav-burger` button: when `isAdmin && adminNotifications > 0`, render the
  same bubble positioned at the top-right corner of the button.
- Accessibility: bubble has an `aria-label` from i18n, e.g.
  `nav.pendingApprovals` → "{n} pending approvals" / "{n} aprobaciones pendientes".
  Numbers over a cap (e.g. 99) render as `99+`.

### 4. `src/app/globals.css` (edit)

Add a `.nav-bubble` class modeled on `.badge` (red background, white text,
`border-radius: 999px`, small font, min-width for single digits). Add an
`absolute`-positioned variant (or modifier) for the hamburger corner placement;
the button gets `position: relative`.

### 5. `src/lib/i18n.ts` (edit)

Add `nav.pendingApprovals` (EN + ES) used for the bubble `aria-label`.

### 6. `src/lib/email.ts` (edit)

Add `sendNewSignupNotice(newUser: { name?; email })`:

- Queries `db.user.findMany({ where: { isAdmin: true }, select: { email: true } })`.
- If no admin emails or SMTP not configured → no-op (return).
- Sends one email (recipients in `to` or `bcc`) with the new user's name/email and
  a link to `/admin` (built from an app base URL env var, consistent with the
  password-reset email).

### 7. `src/app/actions/auth.ts` (edit)

In `signup`, after the PENDING `user.create` (and **not** on the bootstrap-admin
auto-create path), call:

```ts
try {
  await sendNewSignupNotice({ name, email })
} catch (err) {
  console.error('Failed to send new-signup admin notice', err)
}
```

So signup success is fully decoupled from email delivery.

## Data Flow

```
signup() ──creates PENDING user──> DB
   └─ best-effort ─> sendNewSignupNotice() ─> emails all isAdmin users

admin loads any page
   └─ layout.tsx ─ auth() ─ isAdmin? ─> getAdminNotificationCount() (db.user.count PENDING)
        └─> <Nav adminNotifications={n} /> ─> bubble on hamburger + Admin link
```

## Error Handling

- Email: wrapped in try/catch in `signup`; logged, never thrown. Helper itself
  no-ops when SMTP unconfigured or no admins exist.
- Count query: only runs for admins. If it throws, it would surface in the layout
  render — acceptable since the layout already depends on `auth()`; no special
  fallback beyond standard Next error handling. (Optional: default to 0 on error.)

## Testing

Vitest, following `src/lib/*.test.ts`:

- `notifications.test.ts`: `getAdminNotificationCount` returns the summed count;
  mock `db.user.count`. Verify it sums multiple sources correctly (future-proof).
- `email.test.ts` (or extend existing): `sendNewSignupNotice` selects all
  `isAdmin` users as recipients and no-ops when there are none / SMTP unset.

## Out of Scope (YAGNI)

- Notification DB model, read/unread state, notification feed/dropdown.
- Live polling / websockets.
- Re-request flow for REJECTED users.
- Notifying about anything other than pending approvals (architecture leaves room,
  but nothing else is wired).
