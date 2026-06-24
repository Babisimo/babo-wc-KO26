# WC26 Knockout — Plan 5: Post-Lock Visibility & WC2026 Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let members browse each other's brackets *after the global lock* (own bracket always visible), rendered as a connected knockout tree, and give the whole app a cohesive "Broadcast Pitch" WC2026 theme.

**Architecture:** A pure visibility predicate + a pure bracket view-model (`buildBracketView`, reusing Plan 3's `contestantsForSlot` and Plan 4's winners) feed two new gated pages (`/brackets`, `/brackets/[user]`). A `BracketTree` component renders the view-model as round columns. The visual system lives in a redesigned `globals.css` (design tokens + base-element styling so existing pages lift automatically) plus display/body web fonts.

**Tech Stack:** Next.js 15.5 (App Router), React 19, Tailwind v4 + hand-written CSS, `next/font/google`, Vitest 4. Builds on Plans 1–4.

## Global Constraints

- Builds on Plans 1–4. Reuse: `@/lib/db`; `@/lib/auth` (`auth`, `AppSession`); `@/lib/bracket-structure` (`TOTAL_SLOTS`, `roundForSlot`, `slotsForRound`, `ROUND_POINTS`); `@/lib/bracket-picks` (`contestantsForSlot`, `Picks`, `OfficialR32`); `@/lib/official-r32` (`officialR32FromSlots`); `@/lib/lock` (`isLocked`); `@/lib/scoring` (`scoreBracket`, `OfficialWinners`); `@/app/actions/bracket` (`getOfficialBracket`); `@/app/actions/results` (`currentWinners`).
- Path alias `@/*` → `./src/*`. Colocated `*.test.ts`, run `npx vitest run`. Commit after each task. Never commit `.superpowers/`, `*.tsbuildinfo`, `.next/`, or anything under `.worktrees/`. Before committing a fix, confirm the active branch with `git rev-parse --abbrev-ref HEAD` — do NOT create a new worktree/branch.
- **Visibility rule:** a user may view another user's bracket ONLY after the global lock (`isLocked(now, lockTime)`); a user may ALWAYS view their own. Enforced server-side in the data actions, not just the UI.
- No live DB / no visual runtime here: verify with `npx prisma generate` (if needed), `npx tsc --noEmit`, `npx vitest run`, `npx next build`. The theme is verified to COMPILE; a visual pass needs the running app (DB) and is a follow-up.
- **Theme direction ("Broadcast Pitch"):** dark stadium-night pitch base, chalk-line motifs, **goal-gold** primary accent + **crimson** for live/alerts; display font **Big Shoulders Display**, body **Hanken Grotesk**. KEEP the existing CSS variable names `--accent` and `--line` (existing components reference them) and enrich around them so older pages restyle for free.
- Out of scope: editing every legacy inline-styled component. Lift them via global base-element styling; give bespoke treatment only to the bracket tree, browse pages, home leaderboard, and nav.

---

### Task 1: Bracket visibility predicate — TDD

**Files:**
- Create: `src/lib/bracket-visibility.ts`, `src/lib/bracket-visibility.test.ts`

**Interfaces:**
- Produces: `canViewUserBracket(opts: { isOwner: boolean; locked: boolean }): boolean` — `true` iff the viewer is the owner OR brackets are locked.

- [ ] **Step 1: Write the failing test**

`src/lib/bracket-visibility.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { canViewUserBracket } from './bracket-visibility';

describe('canViewUserBracket', () => {
  it('lets the owner view their own bracket anytime', () => {
    expect(canViewUserBracket({ isOwner: true, locked: false })).toBe(true);
    expect(canViewUserBracket({ isOwner: true, locked: true })).toBe(true);
  });
  it('hides others until lock', () => {
    expect(canViewUserBracket({ isOwner: false, locked: false })).toBe(false);
  });
  it('shows others after lock', () => {
    expect(canViewUserBracket({ isOwner: false, locked: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bracket-visibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/bracket-visibility.ts`:
```ts
/** A viewer may see a bracket if it's their own, or once brackets are locked. */
export function canViewUserBracket(opts: { isOwner: boolean; locked: boolean }): boolean {
  return opts.isOwner || opts.locked;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bracket-visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-visibility.ts src/lib/bracket-visibility.test.ts
git commit -m "feat: add bracket visibility predicate"
```

---

### Task 2: Bracket view-model builder — TDD

**Files:**
- Create: `src/lib/bracket-view.ts`, `src/lib/bracket-view.test.ts`

**Interfaces:**
- Consumes: `TOTAL_SLOTS`, `roundForSlot` from `@/lib/bracket-structure`; `contestantsForSlot`, `OfficialR32`, `Picks` from `@/lib/bracket-picks`; `OfficialWinners` from `@/lib/scoring`; `Round` from `@prisma/client`.
- Produces:
  - `type SlotStatus = 'correct' | 'wrong' | 'pending'`
  - `type SlotView = { slot: number; round: Round; teamA: string | null; teamB: string | null; pick: string | null; officialWinner: string | null; status: SlotStatus }`
  - `buildBracketView(officialR32: OfficialR32, picks: Picks, winners: OfficialWinners): SlotView[]` — one entry per slot 1..31; `teamA`/`teamB` are the bracket's contestants given these picks; `status` is `correct` (decided + pick matches), `wrong` (decided + mismatch), or `pending` (undecided).

- [ ] **Step 1: Write the failing test**

`src/lib/bracket-view.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildBracketView } from './bracket-view';
import type { OfficialR32, Picks } from './bracket-picks';
import type { OfficialWinners } from './scoring';

const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
};

describe('buildBracketView', () => {
  it('returns one entry per slot with the round', () => {
    const view = buildBracketView(OFFICIAL, {}, {});
    expect(view).toHaveLength(31);
    expect(view[0].round).toBe('R32');
    expect(view[30].round).toBe('FINAL');
  });
  it('marks a correct decided pick', () => {
    const picks: Picks = { 1: 'ARG' };
    const winners: OfficialWinners = { 1: 'ARG' };
    const s1 = buildBracketView(OFFICIAL, picks, winners)[0];
    expect(s1).toMatchObject({ slot: 1, teamA: 'ARG', teamB: 'BRA', pick: 'ARG', officialWinner: 'ARG', status: 'correct' });
  });
  it('marks a wrong decided pick', () => {
    const s1 = buildBracketView(OFFICIAL, { 1: 'BRA' }, { 1: 'ARG' })[0];
    expect(s1.status).toBe('wrong');
  });
  it('marks an undecided slot pending', () => {
    const s1 = buildBracketView(OFFICIAL, { 1: 'ARG' }, {})[0];
    expect(s1.status).toBe('pending');
  });
  it('derives later-round contestants from the user picks', () => {
    const picks: Picks = { 1: 'ARG', 2: 'FRA', 17: 'ARG' };
    const s17 = buildBracketView(OFFICIAL, picks, {}).find((s) => s.slot === 17)!;
    expect(s17).toMatchObject({ teamA: 'ARG', teamB: 'FRA', pick: 'ARG' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bracket-view.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/bracket-view.ts`:
```ts
import { TOTAL_SLOTS, roundForSlot } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32, type Picks } from '@/lib/bracket-picks';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';
import type { Round } from '@prisma/client';

export type SlotStatus = 'correct' | 'wrong' | 'pending';
export type SlotView = {
  slot: number;
  round: Round;
  teamA: string | null;
  teamB: string | null;
  pick: string | null;
  officialWinner: string | null;
  status: SlotStatus;
};

export function buildBracketView(
  officialR32: OfficialR32,
  picks: Picks,
  winners: OfficialWinners,
): SlotView[] {
  const out: SlotView[] = [];
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
    const pick = picks[slot] ?? null;
    const officialWinner = winners[slot] ?? null;
    let status: SlotStatus = 'pending';
    if (officialWinner) status = pick === officialWinner ? 'correct' : 'wrong';
    out.push({ slot, round: roundForSlot(slot), teamA, teamB, pick, officialWinner, status });
  }
  return out;
}

// Re-export so consumers that already hold OfficialWinners can normalize if needed.
export { winnersToPicks };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bracket-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-view.ts src/lib/bracket-view.test.ts
git commit -m "feat: add bracket view-model builder"
```

---

### Task 3: Shared picks-JSON helper + browse server actions (gated)

**Files:**
- Create: `src/lib/picks-json.ts`, `src/lib/picks-json.test.ts`
- Create: `src/app/actions/browse.ts`

**Interfaces:**
- Consumes: `db`; `auth`/`AppSession`; `getOfficialBracket`; `officialR32FromSlots`; `isLocked`; `currentWinners`; `scoreBracket`; `buildBracketView`/`SlotView`; `canViewUserBracket`; `Picks`.
- Produces:
  - `coercePicks(raw: unknown): Picks` from `@/lib/picks-json` — turns a stored JSON blob into a numeric-keyed `Picks` map (rejects arrays, non-integer keys, non-string values). This is the canonical home for this helper; `browse.ts` imports it instead of redefining it. (Two pre-existing inline copies in `leaderboard.ts`/`bracket-entry.ts` from earlier plans are left as-is — not refactored here to avoid touching merged code — but new code uses this shared one.)
  - `type BracketsIndex = { locked: boolean; entries: { username: string; name: string; total: number }[] }`
  - `getBracketsIndex(): Promise<BracketsIndex>` — when locked, all submitted brackets with display name + score (sorted by score desc then name); when unlocked, `{ locked: false, entries: [] }`.
  - `type UserBracketView = { visible: boolean; locked: boolean; isOwner: boolean; name: string | null; total: number; slots: SlotView[] }`
  - `getUserBracketView(username: string): Promise<UserBracketView>` — resolves the target by username; returns the built view + score only if `canViewUserBracket` allows; otherwise `visible: false` with empty slots.

- [ ] **Step 1: Write the failing test for the shared helper**

`src/lib/picks-json.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { coercePicks } from './picks-json';

describe('coercePicks', () => {
  it('keeps integer-key string-value entries', () => {
    expect(coercePicks({ 1: 'ARG', 17: 'FRA' })).toEqual({ 1: 'ARG', 17: 'FRA' });
  });
  it('rejects arrays, non-strings, and non-integer keys', () => {
    expect(coercePicks(['ARG'])).toEqual({});
    expect(coercePicks({ 1: 5, x: 'ARG' })).toEqual({});
    expect(coercePicks(null)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/picks-json.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/picks-json.ts`**

```ts
import type { Picks } from '@/lib/bracket-picks';

/** Turn a stored JSON blob into a numeric-keyed Picks map (rejects arrays / non-string values / non-integer keys). */
export function coercePicks(raw: unknown): Picks {
  const out: Picks = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const slot = Number(k);
      if (Number.isInteger(slot) && typeof v === 'string') out[slot] = v;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/picks-json.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/app/actions/browse.ts`**

```ts
'use server';

import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { getOfficialBracket } from '@/app/actions/bracket';
import { officialR32FromSlots } from '@/lib/official-r32';
import { isLocked } from '@/lib/lock';
import { currentWinners } from '@/app/actions/results';
import { scoreBracket } from '@/lib/scoring';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';
import { canViewUserBracket } from '@/lib/bracket-visibility';
import { coercePicks } from '@/lib/picks-json';

async function lockedNow(): Promise<{ locked: boolean; lockTimeIso: string | null }> {
  const official = await getOfficialBracket();
  return {
    locked: isLocked(new Date(), official.lockTimeIso ? new Date(official.lockTimeIso) : null),
    lockTimeIso: official.lockTimeIso,
  };
}

export type BracketsIndex = {
  locked: boolean;
  entries: { username: string; name: string; total: number }[];
};

export async function getBracketsIndex(): Promise<BracketsIndex> {
  const { locked } = await lockedNow();
  if (!locked) return { locked: false, entries: [] };

  const [brackets, winners] = await Promise.all([
    db.bracket.findMany({ select: { userId: true, picks: true } }),
    currentWinners(),
  ]);
  const users = await db.user.findMany({
    where: { id: { in: brackets.map((b) => b.userId) } },
    select: { id: true, name: true, username: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const entries = brackets
    .map((b) => {
      const u = byId.get(b.userId);
      return {
        username: u?.username ?? '',
        name: u?.username ?? u?.name ?? 'Unknown',
        total: scoreBracket(coercePicks(b.picks), winners),
      };
    })
    .filter((e) => e.username !== '')
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return { locked: true, entries };
}

export type UserBracketView = {
  visible: boolean;
  locked: boolean;
  isOwner: boolean;
  name: string | null;
  total: number;
  slots: SlotView[];
};

export async function getUserBracketView(username: string): Promise<UserBracketView> {
  const session = (await auth()) as AppSession | null;
  const viewerId = session?.user?.id ?? null;
  const { locked } = await lockedNow();

  const target = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: { id: true, name: true, username: true },
  });
  if (!target) {
    return { visible: false, locked, isOwner: false, name: null, total: 0, slots: [] };
  }

  const isOwner = viewerId === target.id;
  if (!canViewUserBracket({ isOwner, locked })) {
    return { visible: false, locked, isOwner, name: target.username ?? target.name, total: 0, slots: [] };
  }

  const [bracket, winners, official] = await Promise.all([
    db.bracket.findUnique({ where: { userId: target.id }, select: { picks: true } }),
    currentWinners(),
    getOfficialBracket(),
  ]);
  const picks = coercePicks(bracket?.picks);
  const officialR32 = officialR32FromSlots(official.slots);

  return {
    visible: true,
    locked,
    isOwner,
    name: target.username ?? target.name,
    total: scoreBracket(picks, winners),
    slots: buildBracketView(officialR32, picks, winners),
  };
}
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/picks-json.ts src/lib/picks-json.test.ts src/app/actions/browse.ts
git commit -m "feat: add shared picks-json helper and gated browse actions"
```

---

### Task 4: WC2026 "Broadcast Pitch" theme — fonts + globals.css

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: display/body web fonts wired through `next/font/google` and a redesigned `globals.css` design system. KEEPS `--accent` and `--line` variable names (now mapped to the new palette) so existing components restyle automatically; base-element styling (`body`, `h1`–`h3`, `a`, `button`, `input`, `select`, `table`) lifts legacy pages. Adds utility classes used by later tasks: `.shell`, `.panel`, `.pill`, `.chip`, `.bk-tree`, `.bk-round`, `.bk-match`, `.bk-team`.

- [ ] **Step 1: Wire fonts in `src/app/layout.tsx`**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { Big_Shoulders_Display, Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import Nav from './Nav';

const display = Big_Shoulders_Display({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-display' });
const body = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'WC26 Knockout Bracket',
  description: 'World Cup 2026 knockout-stage bracket pool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `src/app/globals.css` with the theme**

```css
@import "tailwindcss";

:root {
  /* Broadcast Pitch palette */
  --pitch-900: #07180f;
  --pitch-800: #0a2114;
  --pitch-700: #0e2c1b;
  --pitch-600: #143a25;
  --line: #eafff2;            /* chalk text (kept name) */
  --line-dim: rgba(234, 255, 242, 0.62);
  --chalk: rgba(255, 255, 255, 0.14);
  --grass: #2fb564;
  --gold: #ffd23f;
  --accent: var(--gold);      /* kept name: primary accent */
  --crimson: #ff3b50;
  --ink: #06210f;             /* text on gold */
  --radius: 12px;
}

* { box-sizing: border-box; }
html, body { height: 100%; }

body {
  margin: 0;
  color: var(--line);
  font-family: var(--font-body), system-ui, sans-serif;
  background:
    radial-gradient(1100px 520px at 50% -8%, rgba(47, 181, 100, 0.18), transparent 60%),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.022) 0 64px, transparent 64px 128px),
    linear-gradient(180deg, var(--pitch-800), var(--pitch-900) 70%);
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-display), system-ui, sans-serif;
  font-weight: 800;
  letter-spacing: 0.01em;
  line-height: 0.98;
  text-transform: uppercase;
  margin: 0 0 0.5rem;
}
h1 { font-size: clamp(2rem, 5vw, 3.2rem); }
h2 { font-size: clamp(1.3rem, 3vw, 1.8rem); color: var(--line); }

a { color: var(--gold); text-decoration: none; }
a:hover { text-decoration: underline; }

button {
  font: inherit;
  font-weight: 700;
  color: var(--ink);
  background: var(--gold);
  border: none;
  border-radius: 999px;
  padding: 8px 16px;
  cursor: pointer;
  transition: transform 0.08s ease, filter 0.15s ease;
}
button:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }
button:disabled { opacity: 0.45; cursor: not-allowed; }

input, select {
  font: inherit;
  color: var(--line);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--chalk);
  border-radius: 8px;
  padding: 8px 10px;
}
input:focus, select:focus { outline: 2px solid var(--gold); outline-offset: 1px; }
select option { color: #000; }

table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-family: var(--font-display); text-transform: uppercase; font-size: 0.85rem; color: var(--line-dim); padding: 6px 8px; }
td { padding: 8px; border-top: 1px solid var(--chalk); }

/* Layout helpers */
.shell { max-width: 1040px; margin: 0 auto; padding: 24px 18px 64px; }
.panel {
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015));
  border: 1px solid var(--chalk);
  border-radius: var(--radius);
  padding: 18px;
}
.pill {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--chalk); border-radius: 999px;
  padding: 4px 12px; font-size: 0.8rem; color: var(--line-dim);
}
.chip {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  vertical-align: middle; margin-right: 6px;
}

/* Bracket tree */
.bk-tree { display: flex; gap: 18px; overflow-x: auto; padding-bottom: 12px; }
.bk-round { display: flex; flex-direction: column; justify-content: space-around; gap: 12px; min-width: 168px; }
.bk-round h3 { font-size: 0.95rem; color: var(--gold); margin-bottom: 4px; }
.bk-match {
  border: 1px solid var(--chalk); border-left: 3px solid var(--chalk);
  border-radius: 10px; background: rgba(255,255,255,0.03); overflow: hidden;
}
.bk-match.correct { border-left-color: var(--grass); }
.bk-match.wrong { border-left-color: var(--crimson); }
.bk-team {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; font-size: 0.9rem;
}
.bk-team + .bk-team { border-top: 1px solid var(--chalk); }
.bk-team.pick { background: rgba(255, 210, 63, 0.14); font-weight: 700; }
.bk-team.win { color: var(--gold); }
.muted { color: var(--line-dim); }
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx next build`
Expected: compiles (fonts fetched at build). If the build cannot reach Google Fonts in this environment and fails ONLY on font fetch, report it as a concern (do NOT remove the fonts) — `next/font` is the correct approach and will work where network is available.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: add WC2026 Broadcast Pitch theme (fonts + design system)"
```

---

### Task 5: BracketTree component

**Files:**
- Create: `src/app/_components/BracketTree.tsx`
- Create: `src/lib/team-name.ts`, `src/lib/team-name.test.ts`

**Interfaces:**
- Consumes: `SlotView` from `@/lib/bracket-view`; `slotsForRound` from `@/lib/bracket-structure`; `TEAMS` from `@/lib/teams`; `Round` from `@prisma/client`.
- Produces:
  - `teamName(code: string | null): string` and `teamColor(code: string | null): string` from `@/lib/team-name` — look up a team's display name / color by code (fallbacks: the code itself / a neutral grey).
  - `BracketTree` (default export) from `@/app/_components/BracketTree` taking `{ slots: SlotView[] }`, rendering five round columns of match cards; each match shows its two teams with a color chip, highlights the user's pick, and the official winner; the card carries a `correct`/`wrong` class from `status`.

- [ ] **Step 1: Write the failing test for the helpers**

`src/lib/team-name.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { teamName, teamColor } from './team-name';

describe('teamName', () => {
  it('returns the team name for a known code', () => {
    expect(teamName('ARG')).toBe('Argentina');
  });
  it('falls back to the code for an unknown one and a dash for null', () => {
    expect(teamName('ZZZ')).toBe('ZZZ');
    expect(teamName(null)).toBe('—');
  });
});

describe('teamColor', () => {
  it('returns a hex color for a known code', () => {
    expect(teamColor('ARG')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it('returns a neutral grey for unknown/null', () => {
    expect(teamColor('ZZZ')).toBe('#888888');
    expect(teamColor(null)).toBe('#888888');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/team-name.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helpers**

`src/lib/team-name.ts`:
```ts
import { TEAMS } from '@/lib/teams';

const BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

export function teamName(code: string | null): string {
  if (!code) return '—';
  return BY_CODE.get(code)?.name ?? code;
}

export function teamColor(code: string | null): string {
  if (!code) return '#888888';
  return BY_CODE.get(code)?.color ?? '#888888';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/team-name.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the `BracketTree` component**

`src/app/_components/BracketTree.tsx`:
```tsx
import type { SlotView } from '@/lib/bracket-view';
import { slotsForRound } from '@/lib/bracket-structure';
import { teamName, teamColor } from '@/lib/team-name';
import type { Round } from '@prisma/client';

const ROUNDS: { round: Round; label: string }[] = [
  { round: 'R32', label: 'Round of 32' },
  { round: 'R16', label: 'Round of 16' },
  { round: 'QF', label: 'Quarters' },
  { round: 'SF', label: 'Semis' },
  { round: 'FINAL', label: 'Final' },
];

function teamRow(code: string | null, pick: string | null, winner: string | null) {
  const isPick = code !== null && code === pick;
  const isWin = code !== null && code === winner;
  return (
    <div className={`bk-team${isPick ? ' pick' : ''}${isWin ? ' win' : ''}`}>
      <span className="chip" style={{ background: teamColor(code) }} />
      <span>{teamName(code)}</span>
      {isWin && <span style={{ marginLeft: 'auto' }}>✓</span>}
    </div>
  );
}

export default function BracketTree({ slots }: { slots: SlotView[] }) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  return (
    <div className="bk-tree">
      {ROUNDS.map(({ round, label }) => (
        <div key={round} className="bk-round">
          <h3>{label}</h3>
          {slotsForRound(round).map((slotNum) => {
            const s = bySlot.get(slotNum);
            if (!s) return null;
            return (
              <div key={slotNum} className={`bk-match ${s.status}`}>
                {teamRow(s.teamA, s.pick, s.officialWinner)}
                {teamRow(s.teamB, s.pick, s.officialWinner)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck, full suite, build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.
Run: `npx next build`
Expected: compiles.

- [ ] **Step 7: Commit**

```bash
git add src/app/_components/BracketTree.tsx src/lib/team-name.ts src/lib/team-name.test.ts
git commit -m "feat: add BracketTree component and team-name helpers"
```

---

### Task 6: `/brackets` index page + nav link

**Files:**
- Create: `src/app/brackets/page.tsx`
- Modify: `src/app/Nav.tsx`

**Interfaces:**
- Consumes: `auth`/`AppSession`; `getBracketsIndex` (Task 3).
- Produces: `/brackets` route (login-guarded). After lock, lists all submitted brackets (rank by score) linking to `/brackets/[username]`; before lock, shows a "private until lock" notice. Adds a "Brackets" link to the nav for logged-in users.

- [ ] **Step 1: Create `src/app/brackets/page.tsx`**

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getBracketsIndex } from '@/app/actions/browse';

export const dynamic = 'force-dynamic';

export default async function BracketsPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const index = await getBracketsIndex();

  return (
    <main className="shell">
      <h1>Brackets</h1>
      {!index.locked ? (
        <div className="panel">
          <p className="muted">Everyone&apos;s brackets stay private until they lock (one hour before the first Round-of-32 kickoff). Check back after lock to see how everyone picked.</p>
        </div>
      ) : index.entries.length === 0 ? (
        <p className="muted">No brackets were submitted.</p>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr><th>#</th><th>Player</th><th style={{ textAlign: 'right' }}>Points</th></tr>
            </thead>
            <tbody>
              {index.entries.map((e, i) => (
                <tr key={e.username}>
                  <td className="muted">{i + 1}</td>
                  <td><Link href={`/brackets/${encodeURIComponent(e.username)}`}>{e.name}</Link></td>
                  <td style={{ textAlign: 'right' }}>{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add a "Brackets" link to `src/app/Nav.tsx`**

In `src/app/Nav.tsx`, in the logged-in branch, add a Brackets link next to "My bracket". Change:

```tsx
          <Link href="/bracket">My bracket</Link>
          {session.user.isAdmin && <Link href="/admin">Admin</Link>}
```

to:

```tsx
          <Link href="/bracket">My bracket</Link>
          <Link href="/brackets">Brackets</Link>
          {session.user.isAdmin && <Link href="/admin">Admin</Link>}
```

- [ ] **Step 3: Typecheck, full suite, build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.
Run: `npx next build`
Expected: compiles; `/brackets` in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/brackets/page.tsx src/app/Nav.tsx
git commit -m "feat: add /brackets index page and nav link"
```

---

### Task 7: `/brackets/[user]` page + themed home leaderboard

**Files:**
- Create: `src/app/brackets/[user]/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `auth`/`AppSession`; `getUserBracketView` (Task 3); `BracketTree` (Task 5); the existing home-page pieces.
- Produces: `/brackets/[user]` route (login-guarded) that renders a user's bracket as a `BracketTree` (with their score), or a "private until lock" / "not found" message when not visible. Also wraps the existing home leaderboard in the new `.shell`/`.panel` theme classes.

- [ ] **Step 1: Create `src/app/brackets/[user]/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { getUserBracketView } from '@/app/actions/browse';
import BracketTree from '@/app/_components/BracketTree';

export const dynamic = 'force-dynamic';

export default async function UserBracketPage({ params }: { params: Promise<{ user: string }> }) {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) redirect('/login');

  const { user } = await params;
  const view = await getUserBracketView(decodeURIComponent(user));

  if (!view.name) {
    return (
      <main className="shell">
        <h1>Bracket</h1>
        <p className="muted">No such player.</p>
      </main>
    );
  }

  if (!view.visible) {
    return (
      <main className="shell">
        <h1>{view.name}</h1>
        <div className="panel">
          <p className="muted">This bracket is private until brackets lock (one hour before the first Round-of-32 kickoff).</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1>{view.name}</h1>
        <span className="pill">{view.total} pts{view.isOwner ? ' · your bracket' : ''}</span>
      </div>
      <BracketTree slots={view.slots} />
    </main>
  );
}
```

- [ ] **Step 2: Wrap the home leaderboard in theme classes**

In `src/app/page.tsx`, change the outer `<main>` opening tag from its current inline-styled form to use the shell class, and wrap the leaderboard section in a panel. Specifically:

Change the opening main tag:
```tsx
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
```
to:
```tsx
    <main className="shell">
```

And change the leaderboard `<section style={{ marginTop: 24 }}>` opening tag to:
```tsx
      <section className="panel" style={{ marginTop: 24 }}>
```

(Leave the rest of `page.tsx` — the session greeting, Countdown, `dollars` helper, table, and pot/winners note — unchanged.)

- [ ] **Step 3: Typecheck, full suite, build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all green.
Run: `npx next build`
Expected: compiles; `/brackets/[user]` in the route list.

- [ ] **Step 4: Commit**

```bash
git add "src/app/brackets/[user]/page.tsx" src/app/page.tsx
git commit -m "feat: add /brackets/[user] tree view and theme the home leaderboard"
```

---

## Self-Review

**Spec coverage (Plan 5 scope):**
- Post-lock visibility: others viewable only after lock, own always → Task 1 (`canViewUserBracket`) enforced server-side in Task 3 (`getUserBracketView`, `getBracketsIndex` gate). ✓
- `/brackets` + `/brackets/[user]` → Tasks 6, 7. ✓
- Bracket-tree rendering (real connected layout) → Task 5 (`BracketTree`) over Task 2's view-model. ✓
- WC2026 football theme → Task 4 (palette, fonts, base-element styling lifts legacy pages; bracket-tree styles); applied on the new pages + home (Task 7). ✓
- Scoring shown per bracket → Task 3 returns `total`; Task 7 shows it. ✓
- Never leak picks before lock → Task 3 returns `visible:false` + empty slots for others pre-lock (server-side). ✓

**Verification limit (honest):** the theme is verified to COMPILE (`next build`) and tests cover the pure logic, but the *visual* result is not confirmed without running the app (which needs the DB). A visual pass + polish is a recommended follow-up once the DB is provisioned.

**Placeholder scan:** No TBD/TODO; all code complete. Apostrophes in JSX text use `&apos;` to satisfy `react/no-unescaped-entities`.

**Type consistency:** `SlotView`/`SlotStatus` defined in `bracket-view.ts` (Task 2), consumed by `BracketTree` (Task 5) and `getUserBracketView` (Task 3). `canViewUserBracket({isOwner,locked})` signature matches its caller. `BracketsIndex`/`UserBracketView` shapes match the pages. `teamName`/`teamColor` signatures match `BracketTree` usage. `coercePicks` is shared from `@/lib/picks-json` (Task 3) and imported by `browse.ts` — no NEW duplication; the two pre-existing inline copies in merged Plan 3/4 code are left untouched to avoid mid-plan refactoring of merged files (noted as deferred debt). `Round` imported from `@prisma/client` consistently.

---

## Project status after Plan 5

This is the final planned feature plan. With Plans 1–5 merged, the app supports: admin-approved accounts → admin sets the official R32 skeleton → users fill bracket predictions (locked 1h before first kickoff) → results arrive via ESPN feed or admin override → live scored leaderboard → post-lock browsing of everyone's brackets — all under a WC2026 Broadcast Pitch theme. The remaining work is operational, not feature: provision the separate Neon Postgres DB, set env vars (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`), `prisma db push`, `npm run db:seed`, and do a live end-to-end + visual-polish pass.
