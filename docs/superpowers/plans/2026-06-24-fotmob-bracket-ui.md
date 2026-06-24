# FotMob Bracket UI + FIFA Routing — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-wire the knockout bracket to FIFA's real WC26 routing and restyle it to look like FotMob — single-direction columnar layout, country flags, round labels, mobile shrink-scroll.

**Architecture:** Replace the computed adjacency feeders in `bracket-structure.ts` with an explicit FIFA-routing map (same 31-slot binary tree, different wiring). Add a `variant` prop to the existing recursive `BracketLayout` to render the whole tree single-direction (rooted at the Final) reusing the already-validated `.bx.left` connector CSS. Add a flag system and FotMob card styling shared by both the read-only and interactive renders.

**Tech Stack:** Next.js 15 (App Router, stock), React 19, TypeScript, Vitest 4, Tailwind v4 + hand-written CSS, `flag-icons` (new dep).

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code — this is a modified Next.js; APIs may differ from training data (per `AGENTS.md`).
- Windows/Prisma gotcha: do NOT run `prisma generate`/`db push` while the dev server runs (EPERM on the engine DLL). No Prisma changes in this plan, so this only matters if a task restarts tooling.
- This plan is **Plan 1 of 2**. Plan 2 (ESPN-standings projection engine + "As it stands"/"Confirmed" toggle) builds on this and is authored separately. Do NOT add projection logic or the toggle here.
- Card content in this plan = flag + team name + winner highlight. **No scores** (the data model carries no scores yet; out of scope).
- Spec: `docs/superpowers/specs/2026-06-24-fotmob-bracket-projections-design.md`.
- End every commit message with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Verify commands: `npx tsc --noEmit` · `npx vitest run` · `npx next build`.

---

## FIFA WC26 routing reference (used by Task 1)

Source: official FIFA bracket (Wikipedia "2026 FIFA World Cup knockout stage"). FIFA match
numbers 73–104 map to app slots by `slot = match − 72` for matches 73–102; the Final
(match 104; 103 is the third-place playoff, omitted) maps to slot 31. Resulting feeder map
(app slot → its two feeder slots):

```
R16:  17←[2,5]  18←[1,3]  19←[4,6]  20←[7,8]
      21←[11,12] 22←[9,10] 23←[14,16] 24←[13,15]
QF:   25←[17,18] 26←[21,22] 27←[19,20] 28←[23,24]
SF:   29←[25,26] 30←[27,28]
FIN:  31←[29,30]
```

Validity (checked): the R16 feeders consume R32 slots {1..16} exactly once; QF consumes
R16 {17..24} once; SF consumes QF {25..28} once; Final consumes SF {29,30}. Still a
complete 31-slot binary tree, so `bracket-picks`, `scoring`, and `bracket-view` keep
working through `feedersForSlot`.

---

## Task 1: Re-wire feeders to FIFA routing

**Files:**
- Modify: `src/lib/bracket-structure.ts` (replace `feedersForSlot`)
- Test: `src/lib/bracket-structure.test.ts` (update feeder assertions)
- Test: `src/lib/bracket-picks.test.ts` (update slot-17 feeder usage)
- Test: `src/lib/bracket-view.test.ts` (update slot-17 feeder usage)

**Interfaces:**
- Produces: `feedersForSlot(slot: number): [number, number] | null` — unchanged signature; returns the FIFA feeder pair for slots 17–31, `null` for R32 slots 1–16, throws `RangeError` outside 1–31. The new pairs are the map above.
- Consumes: nothing new.

- [ ] **Step 1: Update the feeder assertions in `bracket-structure.test.ts`**

Replace the `describe('feedersForSlot', …)` block (lines ~40–56) with:

```ts
describe('feedersForSlot', () => {
  it('returns null for R32', () => {
    expect(feedersForSlot(1)).toBeNull();
    expect(feedersForSlot(16)).toBeNull();
  });
  it('wires R16 from the FIFA WC26 routing', () => {
    expect(feedersForSlot(17)).toEqual([2, 5]);
    expect(feedersForSlot(18)).toEqual([1, 3]);
    expect(feedersForSlot(23)).toEqual([14, 16]);
    expect(feedersForSlot(24)).toEqual([13, 15]);
  });
  it('wires QF, SF, FINAL', () => {
    expect(feedersForSlot(25)).toEqual([17, 18]);
    expect(feedersForSlot(26)).toEqual([21, 22]);
    expect(feedersForSlot(28)).toEqual([23, 24]);
    expect(feedersForSlot(29)).toEqual([25, 26]);
    expect(feedersForSlot(30)).toEqual([27, 28]);
    expect(feedersForSlot(31)).toEqual([29, 30]);
  });
  it('every R32 slot feeds exactly one R16 slot', () => {
    const used = [17, 18, 19, 20, 21, 22, 23, 24].flatMap((s) => feedersForSlot(s)!);
    expect(used.sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});
```

Also update the `participantsForSlot` "derives R16 participants" test (lines ~82–88) so the feeders match the new wiring for slot 17 (now slots 2 and 5):

```ts
  it('derives R16 participants from feeder winners', () => {
    const matches = {
      2: { teamA: 'ARG', teamB: 'BRA', winner: 'ARG' },
      5: { teamA: 'ESP', teamB: 'FRA', winner: 'FRA' },
    };
    expect(participantsForSlot(17, matches)).toEqual({ teamA: 'ARG', teamB: 'FRA' });
  });
  it('returns nulls when feeders are undecided', () => {
    const matches = {
      2: { teamA: 'ARG', teamB: 'BRA', winner: null },
      5: { teamA: 'ESP', teamB: 'FRA', winner: 'FRA' },
    };
    expect(participantsForSlot(17, matches)).toEqual({ teamA: null, teamB: 'FRA' });
  });
```

- [ ] **Step 2: Run the structure tests to verify they fail**

Run: `npx vitest run src/lib/bracket-structure.test.ts`
Expected: FAIL — current `feedersForSlot(17)` returns `[1, 2]`, not `[2, 5]`.

- [ ] **Step 3: Replace `feedersForSlot` with the FIFA map**

In `src/lib/bracket-structure.ts`, replace the existing `feedersForSlot` function (lines ~32–38) with:

```ts
// FIFA WC26 official routing. Match numbers 73–104 map to app slots
// (slot = match − 72; Final match 104 → slot 31). Each higher slot lists its two feeders.
const FEEDERS: Record<number, [number, number]> = {
  17: [2, 5],  18: [1, 3],  19: [4, 6],  20: [7, 8],
  21: [11, 12], 22: [9, 10], 23: [14, 16], 24: [13, 15],
  25: [17, 18], 26: [21, 22], 27: [19, 20], 28: [23, 24],
  29: [25, 26], 30: [27, 28],
  31: [29, 30],
};

export function feedersForSlot(slot: number): [number, number] | null {
  layerForSlot(slot); // validates range (throws RangeError outside 1..31)
  return FEEDERS[slot] ?? null;
}
```

(Leave `LAYERS`, `layerForSlot`, `roundForSlot`, `slotsForRound`, `participantsForSlot`, `ROUND_POINTS`, `TOTAL_SLOTS` unchanged.)

- [ ] **Step 4: Run the structure tests to verify they pass**

Run: `npx vitest run src/lib/bracket-structure.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix `bracket-picks.test.ts` for the new slot-17 feeders**

Slot 17 now feeds from slots 2 and 5 (was 1 and 2). Update `OFFICIAL` and the slot-17 tests so the advanced teams come from slots 2 and 5:

```ts
const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
  5: { teamA: 'GER', teamB: 'POR' },
};
```

In `contestantsForSlot` "returns the user feeder-pick winners" (lines ~14–18):

```ts
  it('returns the user feeder-pick winners for a later slot', () => {
    const picks: Picks = { 2: 'FRA', 5: 'GER' };
    // slot 17 feeds from slots 2 and 5
    expect(contestantsForSlot(17, OFFICIAL, picks)).toEqual({ teamA: 'FRA', teamB: 'GER' });
  });
```

In `applyPick` "clears a downstream pick…" (lines ~31–42):

```ts
  it('clears a downstream pick that is no longer valid after changing an upstream winner', () => {
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 5, 'GER');
    picks = applyPick(OFFICIAL, picks, 17, 'FRA');
    expect(picks[17]).toBe('FRA');
    // Change slot 2 to ESP. FRA no longer reaches slot 17, so the slot-17 pick must clear.
    picks = applyPick(OFFICIAL, picks, 2, 'ESP');
    expect(picks[2]).toBe('ESP');
    expect(picks[17]).toBeUndefined();
  });
```

In `applyPick` "keeps a downstream pick that is still valid" (lines ~43–51):

```ts
  it('keeps a downstream pick that is still valid', () => {
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 5, 'GER');
    picks = applyPick(OFFICIAL, picks, 17, 'GER');
    // Change slot 2 to ESP — slot 17 pick was GER (from slot 5), still valid.
    picks = applyPick(OFFICIAL, picks, 2, 'ESP');
    expect(picks[17]).toBe('GER');
  });
```

In `applyPick` "clears the entire downstream chain…" (lines ~52–70): the chain 17→25→29→31 is unchanged (25←[17,18], 29←[25,26], 31←[29,30]); only adjust the R32 feeders driving slot 17:

```ts
  it('clears the entire downstream chain when an upstream winner changes', () => {
    let picks: Picks = {};
    picks = applyPick(OFFICIAL, picks, 2, 'FRA');
    picks = applyPick(OFFICIAL, picks, 5, 'GER');
    picks = applyPick(OFFICIAL, picks, 17, 'FRA');
    picks = applyPick(OFFICIAL, picks, 25, 'FRA');
    picks = applyPick(OFFICIAL, picks, 29, 'FRA');
    picks = applyPick(OFFICIAL, picks, 31, 'FRA');
    expect(picks[31]).toBe('FRA');
    // Change slot 2 to ESP: FRA never advances, so the whole chain (17,25,29,31) must clear.
    picks = applyPick(OFFICIAL, picks, 2, 'ESP');
    expect(picks[2]).toBe('ESP');
    expect(picks[17]).toBeUndefined();
    expect(picks[25]).toBeUndefined();
    expect(picks[29]).toBeUndefined();
    expect(picks[31]).toBeUndefined();
  });
```

- [ ] **Step 6: Fix `bracket-view.test.ts` for the new slot-17 feeders**

Update `OFFICIAL` and the "derives later-round contestants" test (lines ~6–9, ~32–36):

```ts
const OFFICIAL: OfficialR32 = {
  1: { teamA: 'ARG', teamB: 'BRA' },
  2: { teamA: 'ESP', teamB: 'FRA' },
  5: { teamA: 'GER', teamB: 'POR' },
};
```

```ts
  it('derives later-round contestants from the user picks', () => {
    const picks: Picks = { 2: 'FRA', 5: 'GER', 17: 'FRA' };
    const s17 = buildBracketView(OFFICIAL, picks, {}).find((s) => s.slot === 17)!;
    expect(s17).toMatchObject({ teamA: 'FRA', teamB: 'GER', pick: 'FRA' });
  });
```

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: PASS (all suites, ~132 tests). If another suite hard-codes a feeder pair, update it to the map above the same way.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bracket-structure.ts src/lib/bracket-structure.test.ts src/lib/bracket-picks.test.ts src/lib/bracket-view.test.ts
git commit -m "feat: wire bracket to FIFA WC26 official routing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Flag system (`flag-icons` + FIFA→ISO map)

**Files:**
- Modify: `package.json` (add `flag-icons` dependency)
- Modify: `src/app/layout.tsx` (import the flag-icons CSS)
- Create: `src/lib/team-flag.ts`
- Create: `src/lib/team-flag.test.ts`

**Interfaces:**
- Produces: `flagClass(code: string | null): string | null` — returns a flag-icons class suffix like `"fi-ar"`, `"fi-gb-eng"`; `null` for null/unknown codes.

- [ ] **Step 1: Install flag-icons**

Run: `npm install flag-icons`
Expected: adds `flag-icons` to `package.json` dependencies; no Prisma involvement.

- [ ] **Step 2: Write the failing test** — `src/lib/team-flag.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { flagClass } from './team-flag';

describe('flagClass', () => {
  it('maps FIFA codes to flag-icons ISO classes', () => {
    expect(flagClass('ARG')).toBe('fi-ar');
    expect(flagClass('USA')).toBe('fi-us');
    expect(flagClass('KOR')).toBe('fi-kr');
    expect(flagClass('KSA')).toBe('fi-sa');
  });
  it('maps the UK home nations to flag-icons gb-* classes', () => {
    expect(flagClass('ENG')).toBe('fi-gb-eng');
    expect(flagClass('SCO')).toBe('fi-gb-sct');
  });
  it('returns null for null or unknown codes', () => {
    expect(flagClass(null)).toBeNull();
    expect(flagClass('ZZZ')).toBeNull();
  });
  it('covers every team in TEAMS', async () => {
    const { TEAMS } = await import('./teams');
    for (const t of TEAMS) expect(flagClass(t.code)).toMatch(/^fi-/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/team-flag.test.ts`
Expected: FAIL — `team-flag` not found.

- [ ] **Step 4: Implement `src/lib/team-flag.ts`**

```ts
// Maps each FIFA 3-letter team code to its flag-icons class suffix
// (ISO 3166-1 alpha-2, plus gb-eng / gb-sct for the UK home nations).
const ISO: Record<string, string> = {
  ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', BEL: 'be', BIH: 'ba', BRA: 'br', CAN: 'ca',
  CIV: 'ci', COD: 'cd', COL: 'co', CPV: 'cv', CRO: 'hr', CUW: 'cw', CZE: 'cz', ECU: 'ec',
  EGY: 'eg', ENG: 'gb-eng', ESP: 'es', FRA: 'fr', GER: 'de', GHA: 'gh', HAI: 'ht', IRN: 'ir',
  IRQ: 'iq', JOR: 'jo', JPN: 'jp', KOR: 'kr', KSA: 'sa', MAR: 'ma', MEX: 'mx', NED: 'nl',
  NOR: 'no', NZL: 'nz', PAN: 'pa', PAR: 'py', POR: 'pt', QAT: 'qa', RSA: 'za', SCO: 'gb-sct',
  SEN: 'sn', SUI: 'ch', SWE: 'se', TUN: 'tn', TUR: 'tr', URU: 'uy', USA: 'us', UZB: 'uz',
};

export function flagClass(code: string | null): string | null {
  if (!code) return null;
  const iso = ISO[code];
  return iso ? `fi-${iso}` : null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/team-flag.test.ts`
Expected: PASS (incl. the "covers every team" check — all 48 codes mapped).

- [ ] **Step 6: Import the flag-icons stylesheet**

In `src/app/layout.tsx`, add near the existing global CSS import:

```ts
import 'flag-icons/css/flag-icons.min.css';
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add package.json package-lock.json src/lib/team-flag.ts src/lib/team-flag.test.ts src/app/layout.tsx
git commit -m "feat: add flag-icons + FIFA-to-ISO flag class map

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Single-direction layout variant

**Files:**
- Modify: `src/app/_components/BracketLayout.tsx`
- Modify: `src/app/globals.css` (single-direction wrapper + labels classes)

**Interfaces:**
- Consumes: `feedersForSlot` (Task 1), the existing `Node` recursion + `.bx.left` CSS.
- Produces: `BracketLayout({ render, variant }: { render: (slot: number) => ReactNode; variant?: 'single' | 'two-sided' })` — default `'single'` renders the full tree rooted at the Final (slot 31) flowing left→right with a round-label header; `'two-sided'` keeps the prior split render.

- [ ] **Step 1: Read the Next.js client-component guide**

Read `node_modules/next/dist/docs/` for the App Router server/client component rules before editing (these components render under server pages; `BracketLayout` has no hooks so it stays a server component).

- [ ] **Step 2: Rewrite `BracketLayout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { feedersForSlot } from '@/lib/bracket-structure';

type Side = 'left' | 'right';

// Recursively renders a balanced sub-bracket rooted at `slot`, each match
// vertically centered between its two feeder matches.
function Node({
  slot,
  side,
  render,
}: {
  slot: number;
  side: Side;
  render: (slot: number) => ReactNode;
}) {
  const feeders = feedersForSlot(slot);
  if (!feeders) return <div className="bx-leaf">{render(slot)}</div>;

  const kids = (
    <div className="bx-kids">
      <Node slot={feeders[0]} side={side} render={render} />
      <Node slot={feeders[1]} side={side} render={render} />
    </div>
  );
  const self = <div className="bx-self">{render(slot)}</div>;

  return (
    <div className={`bx ${side}`}>
      {side === 'left' ? (<>{kids}{self}</>) : (<>{self}{kids}</>)}
    </div>
  );
}

const ROUND_LABELS = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

/**
 * Tournament bracket. `variant='single'` (default) renders the whole tree one
 * direction (R32 left → Final right) with a round-label header — the FotMob look.
 * `variant='two-sided'` keeps the symmetric split with the Final in the center.
 */
export default function BracketLayout({
  render,
  variant = 'single',
}: {
  render: (slot: number) => ReactNode;
  variant?: 'single' | 'two-sided';
}) {
  if (variant === 'two-sided') {
    return (
      <div className="bx-wrap">
        <Node slot={29} side="left" render={render} />
        <div className="bx-final">
          <div className="bx-final-tag">Final</div>
          {render(31)}
          <div className="bx-trophy">🏆</div>
        </div>
        <Node slot={30} side="right" render={render} />
      </div>
    );
  }

  return (
    <div className="bx-scroll">
      <div className="fm-labels">
        {ROUND_LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="bx-wrap single">
        <Node slot={31} side="left" render={render} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the single-direction + labels CSS**

In `src/app/globals.css`, after the existing `.bx-wrap` rule, add:

```css
/* single-direction (FotMob) variant */
.bx-scroll { overflow-x: auto; }
.bx-wrap.single { width: max-content; justify-content: flex-start; }
.fm-labels { display: flex; gap: var(--bx-cw); padding: 0 4px 8px; width: max-content; }
.fm-labels span {
  width: var(--bx-card); text-align: center;
  font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.1em;
  font-size: 0.66rem; color: var(--line-dim);
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: no type or build errors. (Visual check happens in Task 6 after the cards are restyled.)

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/BracketLayout.tsx src/app/globals.css
git commit -m "feat: single-direction bracket layout variant with round labels

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: FotMob card style + flags (read-only + interactive)

**Files:**
- Create: `src/app/_components/TeamFlag.tsx`
- Modify: `src/app/_components/MarchMadnessBracket.tsx`
- Modify: `src/app/bracket/BracketFill.tsx`
- Modify: `src/app/globals.css` (`.fm-match` / `.fm-row` / `.fm-flag` / `.fm-chip` classes)

**Interfaces:**
- Consumes: `flagClass` (Task 2), `BracketLayout` `variant` (Task 3), existing `teamName` / `SlotView` / `contestantsForSlot`.
- Produces: `TeamFlag({ code }: { code: string | null })` — renders `<span class="fi fi-xx fm-flag">` for a known code, else a neutral `<span class="fm-chip">`.

- [ ] **Step 1: Create `TeamFlag.tsx`**

```tsx
import { flagClass } from '@/lib/team-flag';

export default function TeamFlag({ code }: { code: string | null }) {
  const fc = flagClass(code);
  if (!fc) return <span className="fm-chip" aria-hidden />;
  return <span className={`fi ${fc} fm-flag`} role="img" aria-label={code ?? undefined} />;
}
```

- [ ] **Step 2: Restyle the read-only render — `MarchMadnessBracket.tsx`**

Replace the file with (FotMob card markup, flag instead of color chip, single-direction variant):

```tsx
import type { SlotView } from '@/lib/bracket-view';
import { teamName } from '@/lib/team-name';
import BracketLayout from './BracketLayout';
import TeamFlag from './TeamFlag';

function teamRow(code: string | null, winner: string | null) {
  const isWin = code !== null && code === winner;
  return (
    <div className={`fm-row${isWin ? ' win' : ''}`}>
      <TeamFlag code={code} />
      <span className="fm-nm">{teamName(code)}</span>
      {isWin && <span className="fm-tick">✓</span>}
    </div>
  );
}

function card(s: SlotView | undefined) {
  if (!s) return <div className="fm-match" />;
  return (
    <div className={`fm-match ${s.status}`}>
      {teamRow(s.teamA, s.officialWinner)}
      {teamRow(s.teamB, s.officialWinner)}
    </div>
  );
}

export default function MarchMadnessBracket({ slots }: { slots: SlotView[] }) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  return <BracketLayout render={(slot) => card(bySlot.get(slot))} />;
}
```

- [ ] **Step 3: Restyle the interactive render — `BracketFill.tsx`**

Change the import block to add `TeamFlag` and drop `teamColor`:

```tsx
import { teamName } from '@/lib/team-name';
import TeamFlag from '@/app/_components/TeamFlag';
```

Replace `teamBtn` and `card` (lines ~43–66) with:

```tsx
  function teamBtn(slot: number, team: string | null) {
    const selected = team !== null && picks[slot] === team;
    return (
      <button
        type="button"
        className={`fm-btn${selected ? ' sel' : ''}`}
        disabled={locked || !team}
        onClick={() => pick(slot, team)}
      >
        <TeamFlag code={team} />
        <span className="fm-nm">{teamName(team)}</span>
      </button>
    );
  }

  function card(slot: number) {
    const { teamA, teamB } = contestantsForSlot(slot, officialR32, picks);
    return (
      <div className="fm-match">
        {teamBtn(slot, teamA)}
        {teamBtn(slot, teamB)}
      </div>
    );
  }
```

(The `BracketLayout` call stays `<BracketLayout render={(slot) => card(slot)} />` — default `'single'`.)

- [ ] **Step 4: Add the FotMob card CSS**

In `src/app/globals.css`, add (and keep the old `.mm-*`/`.bx-*` connector rules):

```css
/* FotMob-style match card */
.bx-wrap .fm-match { width: var(--bx-card); flex: none; }
.fm-match {
  border: 1px solid var(--chalk); border-radius: var(--radius-sm);
  background: rgba(8, 28, 18, 0.72); overflow: hidden;
}
.fm-match.correct { box-shadow: inset 3px 0 0 var(--grass); }
.fm-match.wrong { box-shadow: inset 3px 0 0 var(--crimson); }
.fm-row, .fm-btn {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 7px 10px; font-size: 0.85rem; text-align: left;
}
.fm-row + .fm-row, .fm-btn + .fm-btn { border-top: 1px solid var(--chalk); }
.fm-row.win { color: #fff; font-weight: 700; }
.fm-row.win .fm-tick { margin-left: auto; color: var(--gold); }
.fm-nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fm-flag {
  width: 20px; height: 14px; border-radius: 2px; flex: none;
  background-size: cover; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
}
.fm-chip { width: 14px; height: 14px; border-radius: 3px; flex: none; background: rgba(255,255,255,0.18); }
/* interactive pick buttons */
.fm-btn {
  background: transparent; color: var(--line); border: none; border-radius: 0;
  box-shadow: none; cursor: pointer; font-weight: 500; transition: background 0.12s ease;
}
.fm-btn:hover:not(:disabled) { background: rgba(255,255,255,0.07); filter: none; transform: none; }
.fm-btn.sel { background: rgba(255, 210, 63, 0.2); color: var(--gold); font-weight: 800; }
.fm-btn:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: no errors (confirm no remaining `teamColor` import in `BracketFill.tsx`).

- [ ] **Step 6: Commit**

```bash
git add src/app/_components/TeamFlag.tsx src/app/_components/MarchMadnessBracket.tsx src/app/bracket/BracketFill.tsx src/app/globals.css
git commit -m "feat: FotMob-style bracket cards with country flags

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Mobile shrink + scroll

**Files:**
- Modify: `src/app/globals.css` (mobile media query)

**Interfaces:** none new — tunes the CSS variables the bracket already uses.

- [ ] **Step 1: Add the mobile media query**

In `src/app/globals.css`, append:

```css
@media (max-width: 700px) {
  :root { --bx-card: 132px; --bx-cw: 18px; }
  .bx-wrap .fm-match, .fm-row, .fm-btn { font-size: 0.78rem; }
  .fm-row, .fm-btn { padding: 6px 8px; gap: 6px; }
  .fm-flag { width: 17px; height: 12px; }
  .fm-labels span { font-size: 0.6rem; }
}
```

- [ ] **Step 2: Build**

Run: `npx next build`
Expected: no errors. (Mobile rendering is verified visually in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: shrink bracket cards/connectors on mobile

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Visual verification (desktop + mobile)

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (http://localhost:3000). Log in as admin (`gondaniel852@gmail.com`).

- [ ] **Step 2: Screenshot `/official` (desktop) with headless Edge**

The pages are auth-gated, so screenshot with a logged-in session. Reuse the working Edge screenshot recipe from this session's scratchpad (`--headless=new --disable-gpu --no-sandbox --user-data-dir=<fresh> --window-size=1900,900 --screenshot=<out> <url>`), pointing at `http://localhost:3000/official`. If auth blocks the headless profile, instead open `/official` in a normal browser and capture manually.
Expected: single-direction bracket, round labels aligned to columns, flags in every card, winners highlighted gold, connectors clean.

- [ ] **Step 3: Screenshot `/bracket` (interactive) and a 375px-wide mobile viewport**

Capture `/bracket` at `--window-size=1900,900` and again at `--window-size=375,800`.
Expected: pick buttons show flags; selected team highlighted; on the 375px shot the cards/connectors shrink and the bracket scrolls horizontally without overflowing the layout.

- [ ] **Step 4: Confirm and (if needed) tune**

Compare against the approved Mock A (`Desktop\bracket-mockA-fotmob-columnar.png`). If labels are off-column or spacing is loose, adjust `--bx-card`/`--bx-cw`/`.fm-labels` and re-screenshot. Commit any tuning:

```bash
git add src/app/globals.css
git commit -m "ui: tune bracket spacing and label alignment

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Full verification gate**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: all pass (Vitest ~132+ tests green).

---

## Self-review (done while writing)

- **Spec coverage:** FIFA routing → Task 1; flags → Task 2; single-direction Mock A layout → Task 3; FotMob cards + flags on read-only & interactive → Task 4; round labels → Task 3; mobile shrink-scroll → Task 5; verification → Task 6. Projection engine + toggle are intentionally Plan 2. Home-page hero unchanged (per resolved scope).
- **Placeholder scan:** none — every code/test step shows complete code; the only "adjust if another suite hard-codes a feeder" note (Task 1 Step 7) gives the exact map to apply.
- **Type consistency:** `flagClass` (Task 2) consumed by `TeamFlag` (Task 4); `variant` prop (Task 3) consumed by both renders (Task 4); `feedersForSlot` signature unchanged (Task 1). `BracketFill` drops `teamColor` (Task 4 Step 3/5).
