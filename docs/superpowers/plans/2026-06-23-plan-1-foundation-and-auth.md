# WC26 Knockout — Plan 1: Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the `wc_ko_26` Next.js app with its own PostgreSQL database and a working authentication system that gates login behind admin approval.

**Architecture:** Next.js 15.5 App Router + NextAuth v5 (Credentials, JWT) + Prisma/PostgreSQL, ported from nfl26 and extended with a `UserStatus` approval gate. Auth checks live in the NextAuth `authorize()` callback and per-page server guards (no middleware). Pure validation/approval logic is isolated in `src/lib/*` and unit-tested with Vitest.

**Tech Stack:** Next.js 15.5, React 19, NextAuth 5.0.0-beta, Prisma 6, PostgreSQL (Neon), bcryptjs, zod 4, Tailwind v4, Vitest 4.

## Global Constraints

- This is a **new, standalone project** at `C:\Users\Oswaldo\wc_ko_26` — do NOT reuse the wc26 custom Next.js fork. Use stock `next@^15.5.19`.
- The database is **separate** from nfl26: its own `DATABASE_URL` / `DIRECT_URL`. Never point at nfl26's DB.
- Provider: PostgreSQL. ORM: Prisma 6. Auth: `next-auth@^5.0.0-beta.25`, JWT session strategy.
- Password hashing: bcryptjs, cost factor **10**.
- Path alias: `@/*` → `./src/*`.
- New signups default to `status = PENDING` and **cannot authenticate** until `APPROVED`. The only auto-approved account is the one whose email equals `ADMIN_EMAIL`.
- All admin server actions must independently re-check admin via `requireAdmin()` — never trust the UI.
- Tests: colocated `*.test.ts` next to source; run with `npx vitest run`.
- Commit after each task with a `feat:`/`chore:`/`test:` message.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/lib/sanity.ts`, `src/lib/sanity.test.ts`

**Interfaces:**
- Produces: a booting Next app and a working `npx vitest run`. `src/lib/sanity.ts` exports `add(a: number, b: number): number` (a throwaway to prove the test harness works; deleted in Task 3).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "wc_ko_26",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:push": "prisma db push",
    "db:seed": "tsx --env-file=.env prisma/seed.ts"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "bcryptjs": "^3.0.3",
    "next": "^15.5.19",
    "next-auth": "^5.0.0-beta.25",
    "nodemailer": "^6.10.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22",
    "@types/nodemailer": "^8.0.1",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "^15.5.19",
    "prisma": "^6.19.3",
    "tailwindcss": "^4",
    "tsx": "^4.22.4",
    "typescript": "^5",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create config files**

`next.config.ts`:
```ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {};
export default nextConfig;
```

`postcss.config.mjs`:
```js
const config = { plugins: { '@tailwindcss/postcss': {} } };
export default config;
```

`eslint.config.mjs`:
```js
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });
const eslintConfig = [...compat.extends('next/core-web-vitals', 'next/typescript')];
export default eslintConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
```

`.gitignore`:
```
node_modules
.next
.env
.env*.local
next-env.d.ts
/prisma/generated
```

`.env.example`:
```
# New, SEPARATE Postgres database (do not reuse nfl26's)
DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
DIRECT_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
# NextAuth JWT secret: generate with `openssl rand -base64 32`
AUTH_SECRET=""
# Email that is auto-granted admin + auto-approved on signup
ADMIN_EMAIL=""
# Base URL for password-reset links
APP_URL="http://localhost:3000"
# Optional: Gmail SMTP for password-reset email (degrades if unset)
GMAIL_USER=""
GMAIL_APP_PASSWORD=""
```

- [ ] **Step 4: Create `src/app/globals.css`, `layout.tsx`, `page.tsx`**

`src/app/globals.css`:
```css
@import "tailwindcss";

:root {
  --pitch: #0b6b3a;
  --pitch-dark: #07331d;
  --line: #e8fff1;
  --accent: #e7c200;
}

html, body { height: 100%; }
body {
  margin: 0;
  background: var(--pitch-dark);
  color: var(--line);
  font-family: system-ui, sans-serif;
}
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WC26 Knockout Bracket',
  description: 'World Cup 2026 knockout-stage bracket pool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>WC26 Knockout Bracket</h1>
      <p>Coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 5: Create the sanity test + source**

`src/lib/sanity.ts`:
```ts
export function add(a: number, b: number): number {
  return a + b;
}
```

`src/lib/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { add } from './sanity';

describe('add', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
```

- [ ] **Step 6: Install and verify**

Run: `npm install`
Then run: `npx vitest run`
Expected: `sanity.test.ts` passes (1 passed).
Then run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 + Vitest project"
```

---

### Task 2: Prisma schema, DB client, and the approval enum

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Interfaces:**
- Produces: `db` (PrismaClient singleton) from `@/lib/db`. Prisma models `User` (with `status: UserStatus`, `approvedAt`, `approvedBy`) and `PasswordResetToken`. Enum `UserStatus { PENDING APPROVED REJECTED }`.

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum UserStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id                  String     @id @default(cuid())
  email               String     @unique
  name                String
  username            String?    @unique
  firstName           String?
  lastName            String?
  usernameChangeCount Int        @default(0)
  passwordHash        String
  isAdmin             Boolean    @default(false)
  status              UserStatus @default(PENDING)
  approvedAt          DateTime?
  approvedBy          String?
  createdAt           DateTime   @default(now())
  passwordResetTokens PasswordResetToken[]
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Create `src/lib/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

- [ ] **Step 3: Validate and generate the client**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid."
Then run: `npx prisma generate`
Expected: "Generated Prisma Client".

(Note: `prisma db push` requires a real `DATABASE_URL` and is run during environment setup, not in this task. Generation does not need a live DB.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with user approval gate"
```

---

### Task 3: Auth helpers (hashing) — TDD

**Files:**
- Create: `src/lib/auth-helpers.ts`
- Create: `src/lib/auth-helpers.test.ts`
- Delete: `src/lib/sanity.ts`, `src/lib/sanity.test.ts`

**Interfaces:**
- Consumes: `bcryptjs`.
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`, `generateTempPassword(): string` from `@/lib/auth-helpers`.

- [ ] **Step 1: Write the failing test**

`src/lib/auth-helpers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateTempPassword } from './auth-helpers';

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).not.toBe('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('generateTempPassword', () => {
  it('produces a Word-XXXX shaped string', () => {
    expect(generateTempPassword()).toMatch(/^[A-Za-z]+-[A-Z0-9]{4}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth-helpers.test.ts`
Expected: FAIL — cannot find module `./auth-helpers`.

- [ ] **Step 3: Write the implementation**

`src/lib/auth-helpers.ts`:
```ts
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const TEMP_WORDS = [
  'Goal', 'Pitch', 'Striker', 'Keeper', 'Header', 'Volley', 'Corner', 'Pass',
  'Cross', 'Dribble', 'Tackle', 'Winger', 'Sweeper', 'Final', 'Cup', 'Group',
];
// Crockford-ish base32 without ambiguous characters (no I, L, O, 0, 1).
const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A short, human-readable single-use password, e.g. "Goal-7Q4K". */
export function generateTempPassword(): string {
  const word = TEMP_WORDS[randomInt(TEMP_WORDS.length)];
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += TEMP_CHARS[randomInt(TEMP_CHARS.length)];
  return `${word}-${suffix}`;
}
```

- [ ] **Step 4: Delete the sanity throwaway**

```bash
git rm src/lib/sanity.ts src/lib/sanity.test.ts
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/auth-helpers.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add password hashing helpers"
```

---

### Task 4: Profile & username validators — TDD

**Files:**
- Create: `src/lib/profile.ts`, `src/lib/profile.test.ts`
- Create: `src/lib/username-filter.ts`, `src/lib/username-filter.test.ts`

**Interfaces:**
- Produces from `@/lib/profile`:
  - `MAX_USERNAME_CHANGES: number` (= 2)
  - `type ValidationResult = { ok: true; value: string } | { ok: false; error: string }`
  - `validateUsername(raw: string): ValidationResult` — trims; must match `/^[A-Za-z0-9_]{3,20}$/`.
  - `validateName(raw: string, label: string): ValidationResult` — trims; 1–50 chars.
  - `isProfileComplete(u: { username: string | null; firstName: string | null; lastName: string | null }): boolean`
- Produces from `@/lib/username-filter`: `checkUsernameAllowed(username: string): { ok: true } | { ok: false; error: string }` — rejects a small blocklist of slurs/reserved words (case-insensitive substring match).

- [ ] **Step 1: Write the failing tests**

`src/lib/profile.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateUsername, validateName, isProfileComplete, MAX_USERNAME_CHANGES } from './profile';

describe('validateUsername', () => {
  it('accepts a valid username', () => {
    expect(validateUsername('  Pele_10 ')).toEqual({ ok: true, value: 'Pele_10' });
  });
  it('rejects too short', () => {
    const r = validateUsername('ab');
    expect(r.ok).toBe(false);
  });
  it('rejects illegal characters', () => {
    const r = validateUsername('bad name!');
    expect(r.ok).toBe(false);
  });
});

describe('validateName', () => {
  it('accepts a normal name', () => {
    expect(validateName('  Lionel ', 'First name')).toEqual({ ok: true, value: 'Lionel' });
  });
  it('rejects empty', () => {
    const r = validateName('   ', 'First name');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('First name');
  });
});

describe('isProfileComplete', () => {
  it('true when all fields present', () => {
    expect(isProfileComplete({ username: 'x', firstName: 'A', lastName: 'B' })).toBe(true);
  });
  it('false when username missing', () => {
    expect(isProfileComplete({ username: null, firstName: 'A', lastName: 'B' })).toBe(false);
  });
});

describe('MAX_USERNAME_CHANGES', () => {
  it('is a positive integer', () => {
    expect(MAX_USERNAME_CHANGES).toBeGreaterThan(0);
  });
});
```

`src/lib/username-filter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { checkUsernameAllowed } from './username-filter';

describe('checkUsernameAllowed', () => {
  it('allows a normal username', () => {
    expect(checkUsernameAllowed('soccerfan')).toEqual({ ok: true });
  });
  it('blocks a reserved word', () => {
    const r = checkUsernameAllowed('admin');
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/profile.test.ts src/lib/username-filter.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

`src/lib/profile.ts`:
```ts
export const MAX_USERNAME_CHANGES = 2;

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export function validateUsername(raw: string): ValidationResult {
  const value = raw.trim();
  if (!USERNAME_RE.test(value)) {
    return { ok: false, error: 'Username must be 3–20 letters, numbers, or underscores.' };
  }
  return { ok: true, value };
}

export function validateName(raw: string, label: string): ValidationResult {
  const value = raw.trim();
  if (value.length < 1 || value.length > 50) {
    return { ok: false, error: `${label} must be 1–50 characters.` };
  }
  return { ok: true, value };
}

export function isProfileComplete(u: {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}): boolean {
  return Boolean(u.username && u.firstName && u.lastName);
}
```

`src/lib/username-filter.ts`:
```ts
// Lightweight reserved/blocked-word filter. Substring, case-insensitive.
const BLOCKED = ['admin', 'root', 'moderator', 'fuck', 'shit', 'nigger', 'faggot'];

export function checkUsernameAllowed(username: string): { ok: true } | { ok: false; error: string } {
  const lower = username.toLowerCase();
  if (BLOCKED.some((w) => lower.includes(w))) {
    return { ok: false, error: 'That username is not allowed.' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/profile.test.ts src/lib/username-filter.test.ts`
Expected: PASS (all passed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add profile and username validators"
```

---

### Task 5: Login-eligibility gate — TDD

**Files:**
- Create: `src/lib/auth-status.ts`, `src/lib/auth-status.test.ts`

**Interfaces:**
- Produces: `loginRejectionReason(status: 'PENDING' | 'APPROVED' | 'REJECTED'): string | null` — returns `null` when login is allowed (APPROVED), otherwise a human-readable reason. This is the **pure core** of the approval gate, called by the NextAuth `authorize()` callback in Task 6.

- [ ] **Step 1: Write the failing test**

`src/lib/auth-status.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loginRejectionReason } from './auth-status';

describe('loginRejectionReason', () => {
  it('allows approved users', () => {
    expect(loginRejectionReason('APPROVED')).toBeNull();
  });
  it('blocks pending users with a clear message', () => {
    expect(loginRejectionReason('PENDING')).toMatch(/approval/i);
  });
  it('blocks rejected users', () => {
    expect(loginRejectionReason('REJECTED')).toMatch(/not approved/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth-status.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/auth-status.ts`:
```ts
import type { UserStatus } from '@prisma/client';

/**
 * Returns null when the user may log in, otherwise a human-readable reason.
 * Used by the NextAuth authorize() callback to enforce admin approval.
 */
export function loginRejectionReason(status: UserStatus): string | null {
  switch (status) {
    case 'APPROVED':
      return null;
    case 'PENDING':
      return 'Your account is awaiting admin approval.';
    case 'REJECTED':
      return 'Your account was not approved.';
    default:
      return 'Your account cannot sign in.';
  }
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/lib/auth-status.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add login-eligibility gate for approval"
```

---

### Task 6: NextAuth config with the approval gate

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `db` (Task 2), `verifyPassword` (Task 3), `loginRejectionReason` (Task 5).
- Produces from `@/lib/auth`: `handlers`, `auth`, `signIn`, `signOut`, and `interface AppSession { user: { id: string; name?: string|null; email?: string|null; image?: string|null; isAdmin: boolean }; expires: string }`.
- The `authorize()` callback returns `null` for unknown email, bad password, **or any non-APPROVED status** (the approval gate). Approved users return `{ id, name, email, isAdmin }`.

- [ ] **Step 1: Create `src/lib/auth.ts`**

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth-helpers';
import { loginRejectionReason } from '@/lib/auth-status';

/**
 * Typed session shape for this app.
 * next-auth v5 beta does not support stable module augmentation, so consumers
 * cast `auth()` results to this type.
 */
export interface AppSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin: boolean;
  };
  expires: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? '').toLowerCase();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        // Approval gate: only APPROVED users may authenticate.
        if (loginRejectionReason(user.status) !== null) return null;
        return { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin };
      },
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jwt: ({ token, user }: any) => {
      if (user) {
        token.uid = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: ({ session, token }: any) => {
      if (session.user) {
        session.user.id = token.uid;
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: Create `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire NextAuth with approval-gated authorize"
```

---

### Task 7: Signup & logout server actions

**Files:**
- Create: `src/app/actions/auth.ts`

**Interfaces:**
- Consumes: `db`, `hashPassword`, `validateUsername`, `validateName`, `checkUsernameAllowed`, `signOut`.
- Produces: `type SignupState = { error?: string } | undefined`; `signup(prev: SignupState, formData: FormData): Promise<SignupState>`; `logout(): Promise<void>`.
- Signup creates a user with `status: PENDING` by default. If the email equals `ADMIN_EMAIL`, the user is created `isAdmin: true, status: 'APPROVED', approvedAt: now`.

- [ ] **Step 1: Create `src/app/actions/auth.ts`**

```ts
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { signOut } from '@/lib/auth';
import { hashPassword } from '@/lib/auth-helpers';
import { validateUsername, validateName } from '@/lib/profile';
import { checkUsernameAllowed } from '@/lib/username-filter';

/** Sign the current user out and return home. */
export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

const SignupSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignupState = { error?: string } | undefined;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const uname = validateUsername(String(formData.get('username') ?? ''));
  if (!uname.ok) return { error: uname.error };
  const allowed = checkUsernameAllowed(uname.value);
  if (!allowed.ok) return { error: allowed.error };
  const first = validateName(String(formData.get('firstName') ?? ''), 'First name');
  if (!first.ok) return { error: first.error };
  const last = validateName(String(formData.get('lastName') ?? ''), 'Last name');
  if (!last.ok) return { error: last.error };

  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return { error: 'An account with that email already exists.' };
  }
  if (await db.user.findFirst({ where: { username: { equals: uname.value, mode: 'insensitive' } } })) {
    return { error: 'That username is taken.' };
  }

  const isBootstrapAdmin = email === process.env.ADMIN_EMAIL?.toLowerCase();
  if (!process.env.ADMIN_EMAIL) {
    console.warn('[signup] ADMIN_EMAIL not set — no user will be auto-approved as admin.');
  }

  await db.user.create({
    data: {
      name: `${first.value} ${last.value}`,
      username: uname.value,
      firstName: first.value,
      lastName: last.value,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      isAdmin: isBootstrapAdmin,
      status: isBootstrapAdmin ? 'APPROVED' : 'PENDING',
      approvedAt: isBootstrapAdmin ? new Date() : null,
    },
  });
  return undefined; // success; UI redirects to /login?registered=1
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add signup (pending by default) and logout actions"
```

---

### Task 8: Login & signup pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `signup` action (Task 7), `signIn` from `next-auth/react`.
- Produces: `/login` and `/signup` routes. Login shows a "registered — pending approval" banner when `?registered=1`. Login error message is generic ("Invalid email or password, or your account is awaiting approval").

- [ ] **Step 1: Create `src/app/signup/page.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signup, type SignupState } from '@/app/actions/auth';

export default function SignupPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: SignupState, fd: FormData) => {
      const res = await signup(prev, fd);
      if (res === undefined) router.push('/login?registered=1');
      return res;
    },
    undefined,
  );

  return (
    <main style={{ maxWidth: 380, margin: '48px auto', padding: 16 }}>
      <h1>Request an account</h1>
      <p style={{ opacity: 0.8 }}>New accounts require admin approval before you can log in.</p>
      <form action={formAction} style={{ display: 'grid', gap: 10 }}>
        <input name="firstName" placeholder="First name" required />
        <input name="lastName" placeholder="Last name" required />
        <input name="username" placeholder="Username" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password (8+ chars)" required />
        {state?.error && <p style={{ color: '#ff8080' }}>{state.error}</p>}
        <button disabled={pending} type="submit">{pending ? 'Submitting…' : 'Request account'}</button>
      </form>
      <p style={{ marginTop: 12 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/login/page.tsx`**

```tsx
'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get('registered') === '1';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn('credentials', {
      email: String(fd.get('email') ?? ''),
      password: String(fd.get('password') ?? ''),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError('Invalid email or password, or your account is awaiting approval.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 380, margin: '48px auto', padding: 16 }}>
      <h1>Log in</h1>
      {justRegistered && (
        <p style={{ color: 'var(--accent)' }}>
          Account requested. An admin must approve it before you can log in.
        </p>
      )}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        {error && <p style={{ color: '#ff8080' }}>{error}</p>}
        <button disabled={pending} type="submit">{pending ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p style={{ marginTop: 12 }}>
        Need an account? <Link href="/signup">Request one</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add login and signup pages"
```

---

### Task 9: Admin guards — TDD

**Files:**
- Create: `src/lib/admin-guard.ts`, `src/lib/admin-guard.test.ts`

**Interfaces:**
- Produces from `@/lib/admin-guard`:
  - `type GuardResult = { ok: true } | { ok: false; error: string }`
  - `canRemoveUser(actingUserId, targetUserId, adminIds: string[]): GuardResult`
  - `canSetAdmin(actingUserId, targetUserId, makeAdmin: boolean, adminIds: string[]): GuardResult`
  - Both forbid acting on self and forbid removing/demoting the last admin.

- [ ] **Step 1: Write the failing test**

`src/lib/admin-guard.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { canRemoveUser, canSetAdmin } from './admin-guard';

describe('canRemoveUser', () => {
  it('forbids removing yourself', () => {
    expect(canRemoveUser('a', 'a', ['a', 'b']).ok).toBe(false);
  });
  it('forbids removing the last admin', () => {
    expect(canRemoveUser('a', 'b', ['b']).ok).toBe(false);
  });
  it('allows removing a normal user', () => {
    expect(canRemoveUser('a', 'c', ['a']).ok).toBe(true);
  });
});

describe('canSetAdmin', () => {
  it('forbids changing your own admin status', () => {
    expect(canSetAdmin('a', 'a', false, ['a']).ok).toBe(false);
  });
  it('forbids demoting the last admin', () => {
    expect(canSetAdmin('a', 'b', false, ['b']).ok).toBe(false);
  });
  it('allows promoting a user', () => {
    expect(canSetAdmin('a', 'c', true, ['a']).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/admin-guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/admin-guard.ts`:
```ts
export type GuardResult = { ok: true } | { ok: false; error: string };

/** Whether `actingUserId` may remove `targetUserId`. `adminIds` = current admin user ids. */
export function canRemoveUser(
  actingUserId: string,
  targetUserId: string,
  adminIds: string[],
): GuardResult {
  if (actingUserId === targetUserId) {
    return { ok: false, error: "You can't remove your own account." };
  }
  const targetIsAdmin = adminIds.includes(targetUserId);
  if (targetIsAdmin && adminIds.length <= 1) {
    return { ok: false, error: "Can't remove the last admin." };
  }
  return { ok: true };
}

/** Whether `actingUserId` may set `targetUserId`'s admin flag to `makeAdmin`. */
export function canSetAdmin(
  actingUserId: string,
  targetUserId: string,
  makeAdmin: boolean,
  adminIds: string[],
): GuardResult {
  if (actingUserId === targetUserId) {
    return { ok: false, error: "You can't change your own admin status." };
  }
  const targetIsAdmin = adminIds.includes(targetUserId);
  if (!makeAdmin && targetIsAdmin && adminIds.length <= 1) {
    return { ok: false, error: "Can't demote the last admin." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/lib/admin-guard.test.ts`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add admin guards"
```

---

### Task 10: Admin server actions (approval queue + user management)

**Files:**
- Create: `src/app/actions/admin.ts`

**Interfaces:**
- Consumes: `db`, `auth`/`AppSession`, `canRemoveUser`, `canSetAdmin`.
- Produces:
  - `requireAdmin(): Promise<AppSession>` — throws `Error('Not authorized')` if the caller is not an admin.
  - `approveUser(targetUserId: string): Promise<{ error?: string }>` — sets `status: 'APPROVED'`, `approvedAt: now`, `approvedBy: <admin id>`.
  - `rejectUser(targetUserId: string): Promise<{ error?: string }>` — sets `status: 'REJECTED'`.
  - `setAdmin(targetUserId: string, makeAdmin: boolean): Promise<{ error?: string }>`
  - `removeUser(targetUserId: string): Promise<{ error?: string }>`
  - Each mutating action calls `revalidatePath('/admin')`.

- [ ] **Step 1: Create `src/app/actions/admin.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { canRemoveUser, canSetAdmin } from '@/lib/admin-guard';

export async function requireAdmin(): Promise<AppSession> {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) throw new Error('Not authorized');
  return session;
}

async function adminIds(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

export async function approveUser(targetUserId: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  await db.user.update({
    where: { id: targetUserId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: session.user.id },
  });
  revalidatePath('/admin');
  return {};
}

export async function rejectUser(targetUserId: string): Promise<{ error?: string }> {
  await requireAdmin();
  await db.user.update({ where: { id: targetUserId }, data: { status: 'REJECTED' } });
  revalidatePath('/admin');
  return {};
}

export async function setAdmin(targetUserId: string, makeAdmin: boolean): Promise<{ error?: string }> {
  const session = await requireAdmin();
  const guard = canSetAdmin(session.user.id, targetUserId, makeAdmin, await adminIds());
  if (!guard.ok) return { error: guard.error };
  await db.user.update({ where: { id: targetUserId }, data: { isAdmin: makeAdmin } });
  revalidatePath('/admin');
  return {};
}

export async function removeUser(targetUserId: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  const guard = canRemoveUser(session.user.id, targetUserId, await adminIds());
  if (!guard.ok) return { error: guard.error };
  await db.user.delete({ where: { id: targetUserId } });
  revalidatePath('/admin');
  return {};
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add admin approval and user-management actions"
```

---

### Task 11: Admin page (approval queue + user list) with server guard

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/UserRow.tsx`

**Interfaces:**
- Consumes: `auth`/`AppSession`, `db`, admin actions (Task 10).
- Produces: `/admin` route. Server component: redirects non-admins to `/`. Lists PENDING users with Approve/Reject buttons and all users with Make/Remove-admin + Remove controls. `export const dynamic = 'force-dynamic'`.

- [ ] **Step 1: Create `src/app/admin/UserRow.tsx`**

```tsx
'use client';

import { useTransition } from 'react';

export function ActionButton({
  label,
  action,
}: {
  label: string;
  action: () => Promise<{ error?: string }>;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await action();
          if (res?.error) alert(res.error);
        })
      }
    >
      {pending ? '…' : label}
    </button>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { approveUser, rejectUser, setAdmin, removeUser } from '@/app/actions/admin';
import { ActionButton } from './UserRow';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) redirect('/');

  const pending = await db.user.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  const all = await db.user.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: 16 }}>
      <h1>Admin</h1>

      <section>
        <h2>Pending approval ({pending.length})</h2>
        {pending.length === 0 && <p>No one waiting.</p>}
        <ul>
          {pending.map((u) => (
            <li key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{u.email} (@{u.username})</span>
              <ActionButton label="Approve" action={approveUser.bind(null, u.id)} />
              <ActionButton label="Reject" action={rejectUser.bind(null, u.id)} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>All users ({all.length})</h2>
        <ul>
          {all.map((u) => (
            <li key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>
                {u.email} — {u.status} {u.isAdmin ? '· admin' : ''}
              </span>
              <ActionButton
                label={u.isAdmin ? 'Remove admin' : 'Make admin'}
                action={setAdmin.bind(null, u.id, !u.isAdmin)}
              />
              <ActionButton label="Remove" action={removeUser.bind(null, u.id)} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add admin page with approval queue"
```

---

### Task 12: Session-aware nav + home guard, and end-to-end manual verification

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/Nav.tsx`

**Interfaces:**
- Consumes: `auth`/`AppSession`, `logout` action.
- Produces: a header showing Login/Signup when logged out and Admin (if admin) + Logout when logged in. Home becomes a server component that greets the session user.

- [ ] **Step 1: Create `src/app/Nav.tsx`**

```tsx
import Link from 'next/link';
import { auth, type AppSession } from '@/lib/auth';
import { logout } from '@/app/actions/auth';

export default async function Nav() {
  const session = (await auth()) as AppSession | null;
  return (
    <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ffffff22' }}>
      <Link href="/" style={{ fontWeight: 700 }}>WC26 KO</Link>
      <span style={{ flex: 1 }} />
      {session?.user ? (
        <>
          {session.user.isAdmin && <Link href="/admin">Admin</Link>}
          <form action={logout}>
            <button type="submit">Log out</button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login">Log in</Link>
          <Link href="/signup">Request account</Link>
        </>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Update `src/app/layout.tsx` to render the nav**

```tsx
import type { Metadata } from 'next';
import './globals.css';
import Nav from './Nav';

export const metadata: Metadata = {
  title: 'WC26 Knockout Bracket',
  description: 'World Cup 2026 knockout-stage bracket pool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update `src/app/page.tsx` to greet the session user**

```tsx
import { auth, type AppSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await auth()) as AppSession | null;
  return (
    <main style={{ padding: 24 }}>
      <h1>WC26 Knockout Bracket</h1>
      {session?.user ? (
        <p>Welcome, {session.user.name}. The bracket opens soon.</p>
      ) : (
        <p>Request an account to join the pool.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all tests pass (auth-helpers, profile, username-filter, auth-status, admin-guard).

- [ ] **Step 5: Manual end-to-end verification (requires a real DB + env)**

Pre-req: set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_EMAIL` in `.env`, then run `npx prisma db push`.
Run: `npm run dev`
Verify in the browser:
1. Sign up with the `ADMIN_EMAIL` address → redirected to `/login?registered=1`.
2. Log in with that account → succeeds (auto-approved admin). `/admin` link appears.
3. Sign up a second, normal account → redirected to login.
4. Try to log in as the normal account → **rejected** with the awaiting-approval message.
5. As admin, open `/admin`, click **Approve** on the pending user.
6. Log in as the normal user → now **succeeds**.
7. Confirm a non-admin visiting `/admin` is redirected to `/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: session-aware nav and approval-gated auth end-to-end"
```

---

## Self-Review

**Spec coverage (Plan 1 scope):**
- New separate Postgres DB → Task 2 (schema) + `.env.example` (Task 1). ✓
- Ported auth (NextAuth v5 + bcrypt + Prisma) → Tasks 3, 6. ✓
- Admin-approval gate (the thing nfl26 lacks) → `UserStatus` (Task 2), `loginRejectionReason` (Task 5), `authorize()` rejection (Task 6), `PENDING` default + admin bootstrap (Task 7), approval queue + actions (Tasks 10, 11). ✓
- Admin bootstrap via `ADMIN_EMAIL` → Task 7. ✓
- Per-page server guards, no middleware → Tasks 11, 12. ✓
- Last-admin guards → Task 9. ✓

**Deferred to later plans (intentionally not in Plan 1):** password-reset email flow, complete-profile page, change-username/password, bracket model, results feed, scoring, leaderboard, themed UI. These belong to Plans 2–5.

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type consistency:** `ValidationResult`, `GuardResult`, `AppSession`, `SignupState`, `UserStatus` used identically across tasks. `loginRejectionReason` signature matches its caller in Task 6. `requireAdmin`/`approveUser`/etc. signatures match their callers in Task 11. ✓

---

## Subsequent Plans (roadmap)

- **Plan 2 — Bracket model & official-bracket admin:** `Team`, `Match` (31 slots, feeder wiring), `Bracket` models; team seed; admin R32-skeleton entry + kickoffs; bracket-tree derivation; lock-time computation + PST countdown component.
- **Plan 3 — User bracket UI & lock:** interactive bracket fill/submit; server-enforced lock at (first R32 kickoff − 1h).
- **Plan 4 — Results feed, scoring & leaderboard:** ported wc26 results-source with self-healing fallback; pure round-weighted scoring (perfect = 80); admin result overrides; leaderboard with shared ranks + pot.
- **Plan 5 — Post-lock visibility, browse others & themed UI:** post-lock visibility gate; `/brackets` + `/brackets/[user]`; `frontend-design`-driven WC26 football theme.
