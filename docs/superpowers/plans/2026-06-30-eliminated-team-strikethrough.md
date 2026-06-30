# Eliminated-team strikethrough + eliminator badge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strike through any team eliminated from the tournament wherever it appears on the read-only bracket views, with an inline badge naming who knocked them out.

**Architecture:** A new pure lib derives a global `eliminated team → eliminator` map from the official R32 draw + recorded knockout winners. Two server-side producers (the `/official` real-results page and the `browse.ts` user-bracket action) compute that map and pass it as one `eliminatedBy` prop down through `MarchMadnessBracket` to `BracketCard`, which strikes the matching team on every card and renders the eliminator badge.

**Tech Stack:** Next.js 15.5 App Router (React 19 client components), TypeScript, Prisma 6/Neon (read-only here — no schema change), Vitest 4, hand-written CSS in `globals.css`, `flag-icons`.

## Global Constraints

- **No schema change.** Pre-lock (no recorded winners) the map is empty and every view renders exactly as today.
- **i18n drift guard:** every new key MUST be added to BOTH the `en` and `es` blocks of `src/lib/i18n.ts` or `tsc` fails. Spanish is casual northern-Mexican (Sonoran); team codes/names stay untranslated.
- **Scope:** only `/official` (real-results branch) and `/brackets/[user]` (browse, incl. `isOwner`). The interactive fill page `/bracket/[id]`, the `/official` projection toggle (`OfficialBracketView`), and the PNG image export MUST stay unchanged — they simply never receive the new prop.
- **Verify before claiming done:** `rm -rf .next` then `npx tsc --noEmit` · `npx vitest run` · `npx next lint` · `npx next build` (Windows `.next` flake — clean first).
- Commit author is the repo default (`Oswaldo Gonzalez <Oswaldo@calvada.local>`) — do not change it.

---

### Task 1: `eliminations` pure lib

**Files:**
- Create: `src/lib/eliminations.ts`
- Test: `src/lib/eliminations.test.ts`

**Interfaces:**
- Consumes: `OfficialR32` (from `@/lib/bracket-picks`), `OfficialWinners` + `winnersToPicks` (from `@/lib/scoring`), `contestantsForSlot` (from `@/lib/bracket-picks`), `TOTAL_SLOTS` (from `@/lib/bracket-structure`).
- Produces: `eliminations(officialR32: OfficialR32, winners: OfficialWinners): Record<string, string>` — eliminated team code → eliminator team code. Champion never a key; slots without a recorded winner contribute nothing.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/eliminations.test.ts
import { describe, it, expect } from 'vitest';
import { eliminations } from './eliminations';
import type { OfficialR32 } from './bracket-picks';
import type { OfficialWinners } from './scoring';

// Same routing the bracket-view test relies on: slot 17 is fed by slots 2 and 5.
const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
  5: { teamA: 'GER', teamB: 'POR' },
};

describe('eliminations', () => {
  it('returns an empty map when no winners are recorded', () => {
    expect(eliminations(OFFICIAL, {})).toEqual({});
  });

  it('maps the loser of a single R32 result to its winner', () => {
    expect(eliminations(OFFICIAL, { 1: 'ARG' })).toEqual({ BRA: 'ARG' });
  });

  it('maps every non-champion loser across a multi-round chain', () => {
    const winners: OfficialWinners = { 2: 'FRA', 5: 'GER', 17: 'FRA' };
    // slot 2: FRA beats ESP · slot 5: GER beats POR · slot 17 (feeders 2,5): FRA beats GER
    expect(eliminations(OFFICIAL, winners)).toEqual({ ESP: 'FRA', POR: 'GER', GER: 'FRA' });
  });

  it('ignores a later-round winner whose feeders have no recorded winner yet', () => {
    // slot 17 has a winner but slots 2 and 5 do not -> no current contestants -> contributes nothing
    expect(eliminations(OFFICIAL, { 17: 'FRA' })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eliminations.test.ts`
Expected: FAIL — `eliminations` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/eliminations.ts
import { TOTAL_SLOTS } from '@/lib/bracket-structure';
import { contestantsForSlot, type OfficialR32 } from '@/lib/bracket-picks';
import { winnersToPicks, type OfficialWinners } from '@/lib/scoring';

/**
 * Global map of eliminated team -> the team that knocked them out, derived only from the
 * official R32 draw and the recorded knockout winners (independent of any user's picks).
 * For each decided slot, the loser is whichever official contestant is not the winner.
 * The champion (winner of the final slot) never loses, so never appears as a key.
 */
export function eliminations(
  officialR32: OfficialR32,
  winners: OfficialWinners,
): Record<string, string> {
  const cascade = winnersToPicks(winners);
  const out: Record<string, string> = {};
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const w = winners[slot];
    if (!w) continue;
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, cascade);
    const loser = w === teamA ? teamB : w === teamB ? teamA : null;
    if (loser) out[loser] = w;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/eliminations.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/eliminations.ts src/lib/eliminations.test.ts
git commit -m "feat(bracket): eliminations() lib mapping eliminated team -> eliminator"
```

---

### Task 2: i18n badge label

**Files:**
- Modify: `src/lib/i18n.ts` (the `en` block near `'bracket.viewFull'` line ~146, and the `es` block near line ~433)

**Interfaces:**
- Produces: string key `bracket.eliminatedBy` taking vars `{ team, by }` — used as the badge `title`/`aria-label`.

- [ ] **Step 1: Add the English key**

In the `en` dictionary, right after `'bracket.viewFull': 'Full',`:

```ts
  'bracket.eliminatedBy': '{team} eliminated by {by}',
```

- [ ] **Step 2: Add the Spanish key**

In the `es` dictionary, right after `'bracket.viewFull': 'Completo',`:

```ts
  'bracket.eliminatedBy': '{team} eliminado por {by}',
```

- [ ] **Step 3: Verify the drift guard is satisfied**

Run: `npx tsc --noEmit`
Expected: clean (a missing/extra key in either block is a compile error).

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "i18n: add bracket.eliminatedBy (EN+ES)"
```

---

### Task 3: BracketCard strikethrough + eliminator badge

**Files:**
- Modify: `src/app/_components/BracketCard.tsx`
- Modify: `src/app/globals.css` (near the `.bcard-team` rules ~line 610 and the tab-card overrides ~line 751)

**Interfaces:**
- Consumes: `eliminations()` output shape `Record<string, string>` (team → eliminator); `flagClass` (already imported), `teamName` (already imported), `useT` (from `@/app/_components/LangProvider`).
- Produces: `BracketCardProps.eliminatedBy?: Record<string, string>`.

- [ ] **Step 1: Add the prop and the `useT` import**

In `BracketCard.tsx`, add the import below the existing imports:

```ts
import { useT } from '@/app/_components/LangProvider';
```

Add to `BracketCardProps` (after `onPick?`):

```ts
  /** Global eliminated-team -> eliminator map; strikes matching teams and shows a badge. */
  eliminatedBy?: Record<string, string>;
```

Add `eliminatedBy` to the destructured params in the function signature (after `onPick,`):

```ts
  eliminatedBy,
```

- [ ] **Step 2: Render the strikethrough + badge in `side()`**

Replace the whole `side` function with this version (adds `t`, the `elimBy` lookup, the `elim` class, and the badge):

```tsx
  const t = useT();

  function side(code: string | null) {
    const sel = code != null && code === highlight;
    const elimBy = code != null ? (eliminatedBy?.[code] ?? null) : null;
    const cls = `bcard-team${sel ? ' sel' : ''}${elimBy ? ' elim' : ''}`;
    const body = (
      <>
        <Flag code={code} />
        {/* compact code in the dense tree; CSS swaps to the full name in the big mobile tab cards */}
        <span className="bcard-code">{code ?? 'TBD'}</span>
        <span className="bcard-name">{code ? teamName(code) : 'TBD'}</span>
        {elimBy && (
          <span
            className="bcard-elimby"
            title={t('bracket.eliminatedBy', { team: code!, by: elimBy })}
            aria-label={t('bracket.eliminatedBy', { team: code!, by: elimBy })}
          >
            <span aria-hidden>▸</span>
            <span className={`fi ${flagClass(elimBy) ?? ''} bcard-elimby-flag`} aria-hidden />
            {elimBy}
          </span>
        )}
      </>
    );
    if (interactive) {
      return (
        <button
          type="button"
          className={cls}
          disabled={disabled || code == null}
          onClick={() => code && onPick!(code)}
        >
          {body}
        </button>
      );
    }
    return <div className={cls}>{body}</div>;
  }
```

- [ ] **Step 3: Add the CSS**

Append to `src/app/globals.css` (after the existing `.bcard-*` rules):

```css
/* Eliminated team: struck through wherever it appears, with an eliminator badge. */
.bcard-team.elim .bcard-code,
.bcard-team.elim .bcard-name { text-decoration: line-through; opacity: 0.55; }
.bcard-elimby {
  display: inline-flex; align-items: center; gap: 4px;
  margin-left: auto; padding-left: 8px;
  font-size: 0.72em; font-weight: 700; color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}
.fi.bcard-elimby-flag { width: 16px; height: 12px; border-radius: 2px; }
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/BracketCard.tsx src/app/globals.css
git commit -m "feat(bracket): strike eliminated teams + eliminator badge in BracketCard"
```

---

### Task 4: Thread `eliminatedBy` through the two read-only producers

**Files:**
- Modify: `src/app/_components/MarchMadnessBracket.tsx`
- Modify: `src/app/official/page.tsx`
- Modify: `src/app/actions/browse.ts`
- Modify: `src/app/brackets/BrowseText.tsx`

**Interfaces:**
- Consumes: `eliminations()` (Task 1); `BracketCard.eliminatedBy` (Task 3).
- Produces: `MarchMadnessBracket` prop `eliminatedBy?: Record<string, string>`; `UserBracketView.eliminatedBy: Record<string, string>`.

- [ ] **Step 1: Forward the prop through `MarchMadnessBracket`**

In `MarchMadnessBracket.tsx`, add `eliminatedBy` to the component props:

```tsx
export default function MarchMadnessBracket({
  slots,
  dates,
  layout = 'interactive',
  eliminatedBy,
}: {
  slots: SlotView[];
  dates?: Record<number, string | null>;
  layout?: 'interactive' | 'static';
  eliminatedBy?: Record<string, string>;
}) {
```

And pass it to the populated card in `render` (the `if (!s)` fallback has no teams, leave it as-is):

```tsx
    return (
      <BracketCard
        teamA={s.teamA}
        teamB={s.teamB}
        highlight={s.pick ?? s.officialWinner}
        status={s.status}
        dateLabel={formatMatchDate(dates?.[slot])}
        isFinal={slot === 31}
        eliminatedBy={eliminatedBy}
      />
    );
```

- [ ] **Step 2: Compute + pass the map on the `/official` real-results branch**

In `src/app/official/page.tsx`, add the import:

```ts
import { eliminations } from '@/lib/eliminations';
```

Inside the `if (officialR32IsSet(officialR32)) {` block, after the `view` is built (before the `return`), add:

```ts
    const eliminatedBy = eliminations(officialR32, winners);
```

Pass it to that branch's bracket only:

```tsx
          <MarchMadnessBracket slots={view} dates={dates} eliminatedBy={eliminatedBy} />
```

(Leave the projection branch's `OfficialBracketView` untouched — out of scope.)

- [ ] **Step 3: Add `eliminatedBy` to `UserBracketView` and compute it in browse**

In `src/app/actions/browse.ts`, add the import:

```ts
import { eliminations } from '@/lib/eliminations';
```

Add the field to the `UserBracketView` type (after `dates`):

```ts
  eliminatedBy: Record<string, string>;
```

The two early returns must satisfy the type — add `eliminatedBy: {}` to each:

```ts
    return { visible: false, locked, isOwner: false, name: null, dates: {}, brackets: [], eliminatedBy: {} };
```
```ts
    return { visible: false, locked, isOwner, name: target.username ?? target.name, dates: {}, brackets: [], eliminatedBy: {} };
```

In the visible return, compute the map after `officialR32` is built (it already has `winners` from the `Promise.all`) and include it:

```ts
  const eliminatedBy = eliminations(officialR32, winners);
```
```ts
  return {
    visible: true,
    locked,
    isOwner,
    name: targetDisplay,
    dates,
    eliminatedBy,
    brackets: rows.map((r) => {
```

- [ ] **Step 4: Pass it through `BrowseText`'s `UserBody`**

In `src/app/brackets/BrowseText.tsx`, in `UserBody`, pass it to the bracket:

```tsx
        <MarchMadnessBracket slots={b.slots} dates={view.dates} eliminatedBy={view.eliminatedBy} />
```

- [ ] **Step 5: Full verification**

Run:
```bash
rm -rf .next
npx tsc --noEmit && npx vitest run && npx next lint && npx next build
```
Expected: `tsc` clean · all vitest tests pass (incl. the 4 from Task 1) · lint clean · build clean.

- [ ] **Step 6: Manual smoke check**

Start `npm run dev`. With at least one recorded knockout result (e.g. an R32 winner set in `/admin/bracket`):
- `/official` — the losing team is struck through with a `▸ <flag> <code>` badge in its match.
- `/brackets/<a user who picked that loser to advance>` — the loser is struck through in the later-round cards too (ghost picks), each with the badge.
- `/brackets/<your own username>` — same on your own scored bracket.
- `/bracket/<id>` (fill page) and the PNG export — unchanged, no strikethrough.

- [ ] **Step 7: Commit**

```bash
git add src/app/_components/MarchMadnessBracket.tsx src/app/official/page.tsx src/app/actions/browse.ts src/app/brackets/BrowseText.tsx
git commit -m "feat(bracket): wire eliminatedBy into /official + browse views"
```

---

## Self-Review

- **Spec coverage:** core lib → Task 1; i18n key → Task 2; rendering (strikethrough + badge on every struck card, both code/name layouts) → Task 3; threading via the two in-scope producers + `MarchMadnessBracket` → Task 4; scope exclusions (fill page, projection toggle, export) honored by never passing the prop. CSS + no-schema-change covered. All spec sections map to a task.
- **Type consistency:** `eliminations(officialR32, winners): Record<string,string>` is defined in Task 1 and consumed with that exact shape as the `eliminatedBy?: Record<string,string>` prop in Tasks 3–4 and the `UserBracketView.eliminatedBy: Record<string,string>` field in Task 4. `bracket.eliminatedBy` vars `{team, by}` defined in Task 2, used in Task 3.
- **Placeholder scan:** no TBD/placeholder steps; every code step shows full code.
