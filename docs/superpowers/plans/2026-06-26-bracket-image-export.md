# Bracket Image Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-bracket **Export image** button to the My Brackets list that snapshots a completed bracket to a PNG client-side, then opens the native share sheet (mobile) or downloads the file (desktop).

**Architecture:** Reuse the existing read-only bracket components (`MarchMadnessBracket` → a new static layout) rendered into a hidden, off-screen, in-tree stage so React context (LangProvider) and the app's global CSS — including `flag-icons` — apply. `html-to-image` snapshots that node to a PNG. Delivery prefers the Web Share API and falls back to a download.

**Tech Stack:** Next.js 15.5 App Router, React 19, TypeScript, `html-to-image`, Vitest 4, the project's EN/ES i18n dictionary (`src/lib/i18n.ts`).

## Global Constraints

- TypeScript strict; `npx tsc --noEmit` must stay clean.
- Tests: Vitest, `npx vitest run` must stay green. Pure logic in `src/lib/` is unit-tested; React/DOM glue is not (jsdom can't rasterize).
- Lint: `npx next lint` must stay clean. Use `/* ignore */` in intentionally empty catch blocks (existing convention).
- i18n: every new key MUST be added to BOTH the `en` and `es` blocks of `src/lib/i18n.ts` — the `Record<StringKey, string>` drift guard makes a missing key a compile error. Spanish is casual northern-Mexican (Sonoran).
- Commit author is the repo default (Oswaldo Gonzalez <Oswaldo@calvada.local>); do not pass `--author` or alter git identity.
- App background for the exported PNG: `--pitch-900` = `#06150d`.
- Image content is the bracket only — no header/footer chrome.
- Export button appears ONLY for complete brackets (hidden, not disabled, for partial).

---

### Task 1: Pure export helpers (`bracket-export.ts`)

**Files:**
- Create: `src/lib/bracket-export.ts`
- Test: `src/lib/bracket-export.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `bracketImageFilename(name: string): string` — slugified `<slug>.png` (lowercase, diacritics stripped, non-alphanumerics → single hyphens, trimmed, capped; `bracket.png` when empty).
  - `canShareFiles(nav: { canShare?: (data?: unknown) => boolean } | undefined, file: File): boolean` — Web Share API file-capability probe, SSR/throw-safe.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/bracket-export.test.ts
import { describe, it, expect } from 'vitest';
import { bracketImageFilename, canShareFiles } from './bracket-export';

describe('bracketImageFilename', () => {
  it('slugifies a normal name', () => {
    expect(bracketImageFilename("Babo's Bracket")).toBe('babo-s-bracket.png');
  });
  it('collapses punctuation and spaces to single hyphens', () => {
    expect(bracketImageFilename('My  Cool -- Bracket!!')).toBe('my-cool-bracket.png');
  });
  it('strips diacritics', () => {
    expect(bracketImageFilename('Peña Ñoño')).toBe('pena-nono.png');
  });
  it('falls back to bracket.png when empty/blank/punctuation-only', () => {
    expect(bracketImageFilename('')).toBe('bracket.png');
    expect(bracketImageFilename('   ')).toBe('bracket.png');
    expect(bracketImageFilename('!!!')).toBe('bracket.png');
  });
  it('caps the slug length at 60 chars', () => {
    const out = bracketImageFilename('x'.repeat(100));
    expect(out).toBe(`${'x'.repeat(60)}.png`);
  });
});

describe('canShareFiles', () => {
  const file = {} as File;
  it('false when navigator is undefined', () => {
    expect(canShareFiles(undefined, file)).toBe(false);
  });
  it('false when canShare is absent', () => {
    expect(canShareFiles({}, file)).toBe(false);
  });
  it('delegates to navigator.canShare', () => {
    expect(canShareFiles({ canShare: () => true }, file)).toBe(true);
    expect(canShareFiles({ canShare: () => false }, file)).toBe(false);
  });
  it('false when canShare throws', () => {
    expect(canShareFiles({ canShare: () => { throw new Error('x'); } }, file)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bracket-export.test.ts`
Expected: FAIL — cannot find module `./bracket-export`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/bracket-export.ts

/** Slugify a bracket name into a safe PNG filename. Falls back to `bracket.png`. */
export function bracketImageFilename(name: string): string {
  const slug = (name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // non-alphanumeric runs → single hyphen
    .replace(/^-+|-+$/g, '')         // trim leading/trailing hyphens
    .slice(0, 60);
  return `${slug || 'bracket'}.png`;
}

/** True when the platform can share this file via the Web Share API. SSR- and throw-safe. */
export function canShareFiles(
  nav: { canShare?: (data?: unknown) => boolean } | undefined,
  file: File,
): boolean {
  if (!nav || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bracket-export.test.ts`
Expected: PASS (9 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-export.ts src/lib/bracket-export.test.ts
git commit -m "feat(export): pure helpers for bracket image filename + share capability"
```

---

### Task 2: Static bracket layout for capture

**Files:**
- Modify: `src/app/_components/BracketLayout.tsx` (export `BracketStatic`; reuse it inside `BracketZoom`)
- Modify: `src/app/_components/MarchMadnessBracket.tsx` (add `layout` prop)
- Modify: `src/app/globals.css` (add off-screen stage + static wrapper styles)

**Interfaces:**
- Consumes: `Node`, `Centerpiece` (existing, internal to `BracketLayout.tsx`).
- Produces:
  - `BracketStatic({ render }: { render: (slot: number) => ReactNode }): JSX.Element` — exported from `BracketLayout.tsx`; renders the full two-sided tree (`.brd-desktop-inner`) with no camera/pan/zoom.
  - `MarchMadnessBracket` gains `layout?: 'interactive' | 'static'` (default `'interactive'`). `'static'` renders `<div className="brd brd-export"><BracketStatic .../></div>`.

This task is presentational (no unit test); verified by typecheck + lint, and visually in Task 4.

- [ ] **Step 1: Export `BracketStatic` and reuse it in `BracketZoom`**

In `src/app/_components/BracketLayout.tsx`, add this exported component just above `BracketZoom`:

```tsx
// Full two-sided tree with no camera — used by the pan/zoom view and by image export.
export function BracketStatic({ render }: { render: (slot: number) => ReactNode }) {
  return (
    <div className="brd-desktop-inner">
      <Node slot={29} side="left" render={render} />
      <div className="brd-final"><Centerpiece render={render} /></div>
      <Node slot={30} side="right" render={render} />
    </div>
  );
}
```

Then in `BracketZoom`'s JSX, replace the inline `.brd-desktop-inner` block:

```tsx
          <div className="brd-desktop-inner">
            <Node slot={29} side="left" render={render} />
            <div className="brd-final"><Centerpiece render={render} /></div>
            <Node slot={30} side="right" render={render} />
          </div>
```

with:

```tsx
          <BracketStatic render={render} />
```

- [ ] **Step 2: Add the `layout` prop to `MarchMadnessBracket`**

Replace the entire body of `src/app/_components/MarchMadnessBracket.tsx` with:

```tsx
'use client';

import type { SlotView } from '@/lib/bracket-view';
import { formatMatchDate } from '@/lib/match-date';
import BracketLayout, { BracketStatic } from './BracketLayout';
import BracketCard from './BracketCard';

export default function MarchMadnessBracket({
  slots,
  dates,
  layout = 'interactive',
}: {
  slots: SlotView[];
  dates?: Record<number, string | null>;
  layout?: 'interactive' | 'static';
}) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  const render = (slot: number) => {
    const s = bySlot.get(slot);
    if (!s) return <BracketCard teamA={null} teamB={null} isFinal={slot === 31} />;
    return (
      <BracketCard
        teamA={s.teamA}
        teamB={s.teamB}
        highlight={s.pick ?? s.officialWinner}
        status={s.status}
        dateLabel={formatMatchDate(dates?.[slot])}
        isFinal={slot === 31}
      />
    );
  };

  if (layout === 'static') {
    return <div className="brd brd-export"><BracketStatic render={render} /></div>;
  }
  return <BracketLayout render={render} />;
}
```

- [ ] **Step 3: Add the off-screen stage + static wrapper CSS**

Append to `src/app/globals.css` (after the `.brd-final-card::after` block near line 656):

```css
/* ---- Off-screen render target for exporting a bracket to a PNG ---- */
.brd-export { display: inline-block; }
.brd-export-stage {
  position: fixed; left: -100000px; top: 0; z-index: -1;
  pointer-events: none;
  padding: 28px; background: var(--pitch-900);
}
```

- [ ] **Step 4: Verify typecheck and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: both clean (no errors).

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/BracketLayout.tsx src/app/_components/MarchMadnessBracket.tsx src/app/globals.css
git commit -m "feat(export): static full-bracket layout + off-screen capture stage"
```

---

### Task 3: i18n keys for the export button

**Files:**
- Modify: `src/lib/i18n.ts` (add 3 keys to BOTH `en` and `es`)

**Interfaces:**
- Produces: string keys `bracket.export`, `bracket.exporting`, `bracket.exportFailed` (typed `StringKey`), usable via `t(...)`.

- [ ] **Step 1: Add the English keys**

In `src/lib/i18n.ts`, in the `en` dictionary, immediately after the line `'bracket.err.lockedRename': ...` (or any existing `bracket.*` line), add:

```ts
  'bracket.export': 'Export image',
  'bracket.exporting': 'Exporting…',
  'bracket.exportFailed': "Couldn't export the image — try again.",
```

- [ ] **Step 2: Add the Spanish keys**

In the `es` dictionary, at the matching location among the other `bracket.*` keys, add:

```ts
  'bracket.export': 'Exportar imagen',
  'bracket.exporting': 'Exportando…',
  'bracket.exportFailed': 'No se pudo exportar la imagen — vuelve a intentar.',
```

- [ ] **Step 3: Verify the drift guard compiles**

Run: `npx tsc --noEmit`
Expected: clean. (A key in only one block would be a compile error.)

- [ ] **Step 4: Run the i18n test**

Run: `npx vitest run src/lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "i18n(export): add bracket.export / exporting / exportFailed (EN+ES)"
```

---

### Task 4: Export button component + wire into My Brackets

**Files:**
- Install: `html-to-image`
- Create: `src/app/bracket/BracketExportButton.tsx`
- Modify: `src/app/bracket/MyBrackets.tsx` (render the button per complete row)

**Interfaces:**
- Consumes:
  - `getBracket(id)` from `@/app/actions/bracket-entry` → `{ view, error }` where `view.effectiveR32` (`OfficialR32`) and `view.picks` (`Picks`).
  - `buildBracketView(officialR32, picks, winners)` from `@/lib/bracket-view` → `SlotView[]`.
  - `MarchMadnessBracket` with `layout="static"` (Task 2).
  - `bracketImageFilename`, `canShareFiles` from `@/lib/bracket-export` (Task 1).
  - i18n keys from Task 3.
  - `MyBracketRow.complete: boolean` (existing field).
- Produces: default-exported `BracketExportButton({ id, name, complete }: { id: string; name: string; complete: boolean })`.

This task is DOM/share glue — not unit-tested. Verified by typecheck, lint, and manual capture (Step 5/6).

- [ ] **Step 1: Install the dependency**

Run: `npm install html-to-image`
Expected: package added to `package.json` dependencies.

- [ ] **Step 2: Create the export button component**

```tsx
// src/app/bracket/BracketExportButton.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { getBracket } from '@/app/actions/bracket-entry';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';
import { bracketImageFilename, canShareFiles } from '@/lib/bracket-export';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';

export default function BracketExportButton({
  id,
  name,
  complete,
}: {
  id: string;
  name: string;
  complete: boolean;
}) {
  const t = useT();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<StringKey | null>(null);
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  async function start() {
    setError(null);
    setWorking(true);
    try {
      const { view, error: e } = await getBracket(id);
      if (e || !view) throw new Error('load failed');
      // Picks-only image (no scoring colors): pass empty official winners.
      setSlots(buildBracketView(view.effectiveR32, view.picks, {}));
    } catch {
      setError('bracket.exportFailed');
      setWorking(false);
    }
  }

  // Capture runs after the off-screen stage has rendered (slots set).
  useEffect(() => {
    if (!slots) return;
    let cancelled = false;
    (async () => {
      try {
        const node = stageRef.current;
        if (!node) throw new Error('no node');
        // Fonts + flag background images must be painted before snapshotting.
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: '#06150d' });
        if (cancelled) return;

        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], bracketImageFilename(name), { type: 'image/png' });

        let shared = false;
        if (canShareFiles(typeof navigator !== 'undefined' ? navigator : undefined, file)) {
          try {
            await navigator.share({ files: [file], title: name });
            shared = true;
          } catch (err) {
            // User dismissed the share sheet — treat as done, don't also download.
            if ((err as Error)?.name === 'AbortError') shared = true;
          }
        }
        if (!shared && !cancelled) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } catch {
        if (!cancelled) setError('bracket.exportFailed');
      } finally {
        if (!cancelled) {
          setSlots(null);
          setWorking(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slots, name]);

  if (!complete) return null;

  return (
    <>
      <button type="button" className="btn btn-sm" disabled={working} onClick={start}>
        {working ? t('bracket.exporting') : t('bracket.export')}
      </button>
      {error && (
        <span className="banner error" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}>
          {t(error)}
        </span>
      )}
      {slots && (
        <div className="brd-export-stage" ref={stageRef} aria-hidden>
          <MarchMadnessBracket slots={slots} layout="static" />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Render the button in the My Brackets list**

In `src/app/bracket/MyBrackets.tsx`, add the import near the other imports:

```tsx
import BracketExportButton from './BracketExportButton';
```

Then replace the Edit cell:

```tsx
                <td><Link href={`/bracket/${b.id}`} className="btn btn-sm">{t('bracket.edit')}</Link></td>
```

with:

```tsx
                <td>
                  <Link href={`/bracket/${b.id}`} className="btn btn-sm">{t('bracket.edit')}</Link>
                  {' '}
                  <BracketExportButton id={b.id} name={b.name} complete={b.complete} />
                </td>
```

- [ ] **Step 4: Verify typecheck, lint, and full test suite**

Run: `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: types clean, lint clean, all tests pass (204 files including the new `bracket-export.test.ts`).

- [ ] **Step 5: Manual capture verification (the primary risk)**

Run: `npm run dev`, log in as admin (`gondaniel852@gmail.com`), go to `/bracket`, create + fully fill a bracket so it is **complete**, then click **Export image**.

Verify on desktop:
- A PNG downloads named after the bracket.
- Open it: the FULL two-sided bracket tree is present, with **country flags visible** (not blank boxes), correct fonts, dark `#06150d` background, and the highlighted picks.

If flags are blank, fix before committing: preload the flag CSS or pass `html-to-image` a `fontEmbedCSS`/`skipFonts: false` option, or call `toPng` twice (first call warms the cache; the cache-bust second call embeds). Re-verify.

- [ ] **Step 6: Manual share verification (optional, if a phone is handy)**

Open the deployed/preview URL on a phone, tap **Export image** on a complete bracket → the native share sheet should appear with the PNG attached. Cancelling it does nothing (no error banner).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/app/bracket/BracketExportButton.tsx src/app/bracket/MyBrackets.tsx
git commit -m "feat(export): Export image button on My Brackets (share sheet + download)"
```

---

## Self-Review

**Spec coverage:**
- Per-bracket Export button on My Brackets, complete-only, hidden for partial → Task 4 (button `if (!complete) return null`, wired in MyBrackets). ✓
- Bracket-only image, no chrome → Task 2 (`BracketStatic`, no header band). ✓
- Client-side `html-to-image` snapshot of existing components → Tasks 2 + 4. ✓
- Native share with download fallback → Task 4 (`canShareFiles` → `navigator.share`, else `<a download>`). ✓
- Filename = slugified bracket name → Task 1 (`bracketImageFilename`) used in Task 4. ✓
- Reuse `getBracket` + `bracket-view.ts` → Task 4. ✓
- Pure helpers unit-tested; glue not → Tasks 1 (tested) + 4 (manual). ✓
- EN+ES i18n with drift guard → Task 3. ✓
- Error handling: inline `.banner error`, AbortError = no-op, teardown in `finally` → Task 4. ✓
- Font/flag embedding risk verified first → Task 4 Step 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `SlotView` (from `bracket-view.ts`) used in Tasks 2 + 4; `bracketImageFilename`/`canShareFiles` signatures match between Task 1 definition and Task 4 use; `layout` prop name consistent between Tasks 2 + 4; i18n keys consistent between Tasks 3 + 4. ✓
