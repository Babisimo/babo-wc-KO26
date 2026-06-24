# MB Final Fixes Report

**Date:** 2026-06-24
**Branch:** feat/multi-bracket
**File edited:** `src/app/actions/bracket-entry.ts`

---

## Fix 1 — Normalize smart-quote apostrophes to ASCII

### Problem
Two error-message strings used Unicode curly apostrophes (U+2019, right single quote `'`) and the file also used U+2018 (left single quote) as string delimiters in several places, which caused TypeScript to report `Invalid character` errors.

### Changes made
- Line 77: `'The bracket isn’t open yet.'` → `"The bracket isn't open yet."` (double-quoted, ASCII apostrophe)
- Line 144: `'Approved brackets can’t be deleted.'` → `"Approved brackets can't be deleted."` (double-quoted, ASCII apostrophe)
- All other U+2018/U+2019 curly quotes used as string delimiters throughout the file were also replaced with plain ASCII apostrophes (U+0027) — these were pre-existing issues in the same file exposed by the same grep scan.

### Grep confirmation — no U+2019 (or U+2018) bytes remain
PowerShell byte scan result:
```
No curly quotes — good
```
(Checked for both E2-80-98 and E2-80-99 byte sequences.)

---

## Fix 2 — Race-condition comment in createBracket

Added the following comment block immediately above the `existingCount` query at line 85:

```typescript
  // NOTE: count-then-create is not atomic. A rapid double-submit could create two
  // brackets that both observe existingCount === 0 (two auto-approved "first" entries).
  // Accepted at this pool's scale: the client guards with disabled={pending}, and an
  // admin can reject a duplicate. Upgrade to a Serializable transaction if hard
  // prevention is ever needed.
```

---

## Verify output

### `npx tsc --noEmit`
```
(no output — clean)
```

### `npx vitest run`
```
 RUN  v4.1.9 C:/Users/Oswaldo/wc_ko_26

 Test Files  27 passed (27)
      Tests  154 passed (154)
   Start at  16:40:37
   Duration  520ms (transform 1.67s, setup 0ms, import 2.26s, tests 304ms, environment 2ms)
```

All 27 test files and 154 tests pass. No regressions.
