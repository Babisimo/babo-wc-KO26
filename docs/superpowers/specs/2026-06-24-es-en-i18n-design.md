# EN/ES Language Toggle (Spanish Translation) — Design

_Date: 2026-06-24_
_Status: approved design (user-prescribed approach), pending spec review_

## Goal

Add a full Spanish translation to the public UI with a small **EN/ES toggle** in the nav,
remembered per browser. **Default = English; Spanish is opt-in.** Flipping the toggle
re-renders all pages instantly — **no reload, no URL change, no locale routing**. Translate
**all** user-facing public UI; leave admin/internal/key-gated screens in English.

## Dialect (Spanish)

Casual **northern-Mexican (Sonoran)** register:
- Informal **tú / ustedes**, never *vosotros*. No Spain-isms (no *vale*, *ordenador*, etc.).
- Use **"ocupar" = "to need"** (very Sonoran), e.g. "ocupas escoger todos los partidos".
- Keep loanwords people actually say (e.g. **"picks"**).
- Friendly, light regional flavor — still readable to any Spanish speaker.
- **Team names and proper names stay untranslated** (FIFA team names render from data).

## Scope — public surfaces (translate)

Pages: `src/app/page.tsx` (home leaderboard), `official/page.tsx`,
`bracket/page.tsx`, `bracket/[id]/page.tsx`, `brackets/page.tsx`,
`brackets/[user]/page.tsx`, `login/page.tsx`, `signup/page.tsx`.
Client components: `Nav.tsx`, `official/OfficialBracketView.tsx`,
`bracket/MyBrackets.tsx`, `bracket/BracketFill.tsx`, `_components/Countdown.tsx`,
`_components/MarchMadnessBracket.tsx` / `_components/BracketLayout.tsx` (round labels:
"Round of 32"…"Final"). `_components/TeamFlag.tsx` has no user-facing copy (aria-label is a
team code/name — leave as is). `_components/BracketTree.tsx` is dead code — skip.

**Out of scope (stay English):** everything under `src/app/admin/` (`admin/page.tsx`,
`admin/UserRow.tsx`, `admin/bracket/page.tsx`, `admin/bracket/R32SkeletonForm.tsx`,
`admin/bracket/ResultsPanel.tsx`). Server-action error strings surfaced to public users
**are** in scope (they show on public pages); admin-only action errors are not.

### String categories to cover (representative, not exhaustive — the plan enumerates every key)

- **Nav:** links (Home, Official, Your brackets, Brackets, Log out / Log in / Sign up), the new EN/ES toggle, the "WC 26'" wordmark stays as-is.
- **Home:** hero eyebrow/title/lead, countdown labels, leaderboard table headers (#, Player, Points, Pot), pot/share copy, empty state.
- **Official:** eyebrow/title/lead, "As it stands" / "Confirmed" toggle, "X / Y decided" pill, "not available yet" empty state, round labels.
- **Your brackets / edit:** "Your brackets", status badges (pending/approved/rejected), Edit/Delete, "New bracket" input placeholder + button, "awaiting approval"/"locked" notes, savebar ("Save bracket", "Pick every game (n/31)", "Saving…", "Bracket saved ✓"), error banners, "bracket isn't open yet".
- **Brackets browse:** "Brackets", private-until-lock message, table headers (#, Player, Brackets, Best), per-user page headings + "N pts · yours".
- **Login/signup:** field labels, placeholders, buttons, validation/auth error messages, helper copy.
- **Cross-cutting:** empty/loading/error states, "updated X ago"–style freshness chips (if present), table headers, tooltips/aria-labels.

## Tech approach — lightweight, NO new dependencies, NO locale routing

### 1. `src/lib/i18n.ts` — a typed string dictionary

```ts
const en = {
  'nav.home': 'Home',
  // …every key…
} as const;

export type StringKey = keyof typeof en;

// Record<StringKey, string> forces es to cover EVERY en key and add NONE extra,
// so the two languages can never drift.
const es: Record<StringKey, string> = {
  'nav.home': 'Inicio',
  // …same keys…
};

export const STRINGS = { en, es } as const;
export type Lang = keyof typeof STRINGS; // 'en' | 'es'

// Replace {placeholders} from vars; fall back to English, then to the raw key,
// so nothing ever renders blank.
export function translate(
  lang: Lang,
  key: StringKey,
  vars?: Record<string, string | number>,
): string { /* … */ }
```

`translate` resolves `STRINGS[lang][key] ?? STRINGS.en[key] ?? key`, then interpolates
`{name}`-style placeholders from `vars`.

### 2. `LangProvider` client component (React context)

- File: `src/app/_components/LangProvider.tsx` (`'use client'`).
- Holds `{ lang, setLang }`, **default `'en'`**.
- **Hydration-safe:** the server render and the first client paint both use `'en'`
  (the default). Read the saved preference from `localStorage` key **`'lang'`** in a
  `useEffect` that runs **after mount**, then apply it. `setLang` writes back to
  `localStorage`. (The root `<html>` already has `suppressHydrationWarning`.)
- Exposes `useT()` → a bound `t(key, vars?)` (calls `translate(lang, …)`), and
  `useLang()` → `{ lang, setLang }`.
- **Mounted once in the root layout**, inside `<body>`, wrapping the nav + children:
  `<body><LangProvider><Nav/>{children}</LangProvider></body>`.

### 3. Nav toggle

An **ES / EN segmented control** in `Nav.tsx` calling `setLang` (reuse the existing
`.fm-toggle` segmented-control styles from globals.css). `Nav` becomes a client component
(or splits the toggle into a small client child) so it can call `useLang`.

### 4. Route every hardcoded public string through `t('key')`

- Convert each public page/component to call `const t = useT();` and replace literals with
  `t('some.key')`. **Server-component pages** that render static copy must become (or
  delegate copy to) client components so they can use the hook — OR the page stays a server
  component and its visible copy is moved into small client subcomponents. (The plan picks
  the minimal split per page; most public pages are already dynamic and several already
  have client children.)
- For sentences with embedded bold/colored spans or different word order, **split into
  pre/post keys or interpolate plain vars** — never concatenate translated fragments
  assuming English word order. Example: render `t('bracket.pickEvery', { n })` →
  `"Escoge todos los partidos ({n}/31)"`, not `t('a') + n + t('b')`.

### 5. Locale-aware formatting where it matters

A shared **pure helper** (e.g. `src/lib/format-i18n.ts`) taking `(lang, …)`:
- The **countdown** unit labels (days/hours/minutes) and any **relative "updated X ago"**
  chip get language-specific buckets/words.
- Numbers/dates only where user-visible and ambiguous; team data and scores stay numeric.

## Architecture / data flow

`LangProvider` (context, top of `<body>`) → `useT()`/`useLang()` consumed by Nav + every
public page/component → `translate(lang, key, vars)` resolves from the typed dictionary.
Toggling `setLang` updates context → React re-renders all consumers instantly (no reload,
no URL change). `localStorage['lang']` persists the choice; read after mount to stay
hydration-safe.

## Error handling / fallbacks

`translate` never throws and never renders blank: missing-in-`es` → English → raw key.
The `Record<StringKey,string>` type makes a missing `es` key a **compile error**, so this
fallback is a runtime safety net, not the normal path.

## Quality bars (testing)

TDD the pure pieces (`src/lib/i18n.test.ts`, `src/lib/format-i18n.test.ts`):
- **Key-parity test:** `Object.keys(es)` set === `Object.keys(en)` set (no missing, no
  extra) — guarantees the two languages can't drift.
- **Interpolation test:** `translate('en'|'es', key, { name: 'X' })` replaces `{name}`.
- **Fallback test:** unknown/missing key → English → raw key (never blank).
- **Format helper test:** the freshness/countdown buckets are correct in both languages.
- Existing suite stays green; `tsc --noEmit` + `next build` pass.

## Framework note

This repo is **Next.js 15.5 (App Router, the stock/modified build — see `AGENTS.md`)**.
Before writing provider/layout code, confirm against `node_modules/next/dist/docs/` that a
client context provider mounted in the root layout behaves as expected for this version
(it does — server components can render a client provider that wraps `children`). No locale
routing, no middleware, no `next-intl`/`next-i18next` — plain React context only.

## Deliverable

- **New:** `src/lib/i18n.ts` (+ `i18n.test.ts`), `src/app/_components/LangProvider.tsx`,
  `src/lib/format-i18n.ts` (+ test) if a format helper is needed.
- **Edited:** root layout (mount `LangProvider`), `Nav.tsx` (toggle + translated links),
  and every public page/component switched to `t()`.
- **Where the Spanish strings live (for later wording tweaks):** the **`es` block of
  `src/lib/i18n.ts`** — one object, every key, easy to edit.

## Resolved placeholders / notes

- **localStorage key:** `'lang'`.
- **Framework:** Next.js 15 App Router (confirmed) — context provider in root layout.
- **Commit identity:** plain `Co-Authored-By` trailers commit fine in this local repo
  (no Vercel-Hobby co-author block here), so no special commit-identity handling is needed.

## Open questions for spec review

- Some public **pages are server components** with inline copy (e.g. `official/page.tsx`,
  `brackets/[user]/page.tsx`). Preferred conversion: (a) make the whole page a thin client
  component, or (b) keep the page a server component and move its visible copy into a small
  client subcomponent? (Recommendation: per-page minimal — most already have client
  children to extend; convert the page only when it's mostly copy.)
- Should the login/signup **server-action auth error strings** be translated (they render
  on public pages) — yes per "translate all public UI," but confirm you want auth errors in
  Spanish too.
