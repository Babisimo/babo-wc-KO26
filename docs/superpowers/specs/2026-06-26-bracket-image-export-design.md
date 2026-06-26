# Export bracket as image — design

_Date: 2026-06-26_

## Summary

Add a per-bracket **Export** button to the **My Brackets** list (`/bracket`) that
renders a completed bracket — official or unofficial — to a PNG image, fully
client-side, and either opens the native share sheet (mobile) or downloads the
file (desktop). The purpose is optional, low-friction sharing of a finished
bracket into a group chat.

## Goals

- One-tap export of a finished bracket to a clean PNG of the bracket tree.
- Image is **just the bracket** (the R32 → Final tree as it appears in-app) —
  no header/footer chrome, no branding band.
- **Smart delivery:** native share sheet via the Web Share API where supported
  (phones), download fallback everywhere else.
- Reuse the existing bracket rendering so the image is pixel-identical to the app.
- No server compute, no new route — entirely client-side.

## Non-goals

- No server-side / OG-image generation (`@vercel/og`/Satori). Rejected because it
  would require reimplementing the whole bracket layout in a CSS subset and
  inlining flags as SVGs — a parallel renderer that drifts from the real UI, plus
  per-export Vercel compute. Revisit only if a shareable image *URL* is wanted.
- No branded share card (title band, username, pot, site URL). Considered and
  declined in favor of a clean bracket-only image. Could be layered on later.
- No export for **partial** (incomplete) brackets — the button is hidden for them.
- No change to bracket data, scoring, visibility, or lock behavior.

## User-facing behavior

- In the **My Brackets** table (`MyBrackets.tsx`), each row for a **complete**
  bracket gets an **Export** button alongside **Edit**.
- Partial brackets show **no** Export button (hidden, not disabled-greyed).
- Clicking Export:
  1. Button enters an **Exporting…** pending state.
  2. The bracket renders off-screen and is snapshotted to a PNG.
  3. On a device that can share files, the **native share sheet** opens with the
     PNG attached. Otherwise the PNG **downloads** as `<bracket-name>.png`.
  4. If the user cancels the native share sheet, nothing happens (no error).
  5. On any real failure, an inline error banner appears under the table.
- Works for official and unofficial brackets identically.

## Architecture

### New dependency
- `html-to-image` — client DOM-node → PNG. Chosen for same-origin font/background
  embedding and a small API surface.

### Data path (reuse existing)
To render a bracket we need its resolved per-slot matchups + picks as
`SlotView[]`:
- Call the existing server action **`getBracket(id)`** (`actions/bracket-entry.ts`)
  → returns `{ view: { effectiveR32, picks, name, ... } }`.
- Build `SlotView[]` from `effectiveR32` + `picks` using the existing
  **`src/lib/bracket-view.ts`** — the same transformation the `/bracket/[id]`
  detail page relies on. No new data logic.

### Rendering for capture
- A **hidden, fixed-size off-screen container** is mounted on demand
  (`position: fixed; left: -99999px; top: 0; width: ~1400px`, light theme bg to
  match the app) containing the existing read-only **`MarchMadnessBracket`**
  (→ `BracketLayout` / `BracketCard`) rendered at **full natural size** — the
  entire R32 → Final tree in one static layout, NOT the interactive pan/zoom or
  round-tabs view.
- The off-screen subtree is rendered via React (portal or a transient mount the
  export component controls), captured, then unmounted.

### Capture + delivery
- `htmlToImage.toPng(node, { pixelRatio: 2, cacheBust: true })` → PNG blob/dataURL.
- Convert to a `File` named from the bracket name.
- Delivery decision:
  - If `navigator.canShare?.({ files: [file] })` is true →
    `await navigator.share({ files: [file], title, text })`.
  - Else → create an `<a download>` with an object URL and click it.

### Components / files
- **New:** `src/app/bracket/BracketExportButton.tsx` (client) — props
  `{ id: string; name: string; complete: boolean }`. Owns the click handler,
  pending state, off-screen render, capture, delivery, and inline error.
  Renders nothing when `!complete`.
- **New:** `src/lib/bracket-export.ts` (pure, unit-tested) —
  - `bracketImageFilename(name: string): string` — slugify the bracket name to a
    safe `<slug>.png` (lowercase, spaces/punctuation → hyphens, collapse repeats,
    trim, fall back to `bracket.png` when empty).
  - `canShareFiles(nav, file): boolean` — capability probe wrapping
    `navigator.canShare?.({ files: [file] })`, guarded for SSR/older browsers.
- **Edit:** `src/app/bracket/MyBrackets.tsx` — render `<BracketExportButton>` in
  each complete row's actions cell.
- **Edit:** `src/lib/i18n.ts` — add EN + ES keys (drift guard enforced at compile).

## Error handling

- All capture/share work is wrapped in `try/catch`.
- A `navigator.share` cancellation throws `AbortError` (or `NotAllowedError` in
  some browsers) — these are treated as **no-op**, not errors.
- Any other failure sets an inline error rendered with the existing
  `.banner error` pattern using a new key `bracket.exportFailed`.
- The off-screen node is always torn down (in a `finally`) so a failure never
  leaves an orphan in the DOM.

## i18n (EN + ES)

| Key | EN | ES (Sonoran casual) |
| --- | --- | --- |
| `bracket.export` | `Export image` | `Exportar imagen` |
| `bracket.exporting` | `Exporting…` | `Exportando…` |
| `bracket.exportFailed` | `Couldn't export the image — try again.` | `No se pudo exportar la imagen — vuelve a intentar.` |

## Testing

- **Unit (Vitest):** `bracket-export.test.ts`
  - `bracketImageFilename` — normal name, spaces/punctuation, emoji/unicode,
    empty/whitespace → `bracket.png`, length cap.
  - `canShareFiles` — `navigator` undefined, `canShare` absent, returns true/false.
- The DOM-capture and share glue is intentionally thin and **not** unit-tested
  (jsdom can't rasterize). Correctness of the visual output is verified manually
  against a real bracket (see Risks).
- `npx tsc --noEmit`, `npx vitest run`, `next lint` all clean before merge.

## Risks / things to verify first

- **Font + flag embedding (primary risk).** `flag-icons` renders country flags
  via CSS background images, and the app uses Google web fonts. The snapshot must
  embed both. `html-to-image` inlines same-origin resources automatically, and
  both fonts and flags are served same-origin by Next, so this is expected to
  work — but it will be **proven out first** with a real bracket capture before
  building the surrounding UI. Fallback if flags drop: preload the flag-icons CSS
  / pass `fontEmbedCSS` or `skipFonts:false` options, or inline the needed flag
  backgrounds.
- **Image width.** The full tree is wide; at `pixelRatio: 2` the PNG may be a few
  thousand px across. Acceptable for sharing; revisit sizing if files are too big.
- **Static full-bracket render.** `BracketLayout`'s default export is the
  interactive (tabs / pan-zoom) view. The capture needs the static full columnar
  layout; the plan will render the underlying static layout, not the interactive
  wrapper.

## Out of scope / future

- Branded share card variant (title, username, pot, site URL footer).
- Server-rendered shareable image URL (OG card) for link unfurls.
- Exporting the official/projection bracket from `/official`.
