# Tasks: palette-suggestions

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~246 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain (cached YOLO mode) |
| Decision needed before apply | No |

---

## Commit C1 — `feat(domain): book-suggestions module + BOOK_ALIASES export`

Sequential. Must complete before C2.

### [x] C1-T1 — RED: write `src/domain/book-suggestions.test.ts`
- **Spec**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06
- **Tests to write**:
  - Empty string → returns `[]`
  - Whitespace-only string → returns `[]`
  - `"jhn"` subsequence → result includes entry with `displayName: "John"`
  - `"xyzzy"` non-subsequence → returns `[]`
  - Exact match `"john"` scores above prefix match `"johnny"` (John before Johnny in results)
  - Prefix beats mid-string subsequence for the same query
  - Default limit: query matching >5 aliases returns exactly 5 results
  - Custom limit: `suggestBooks(query, 3)` returns at most 3 results
  - Score ordering: `"joh"` results include John, 1 John, 2 John, 3 John with higher scores first
  - Numbered book: `suggestBooks("1sam")` returns entry with `displayName: "1 Samuel"`
  - Shape guard: each result has `alias`, `canonical`, `displayName` fields
- **Expect**: all tests red (module does not exist)

### [x] C1-T2 — GREEN: export `BOOK_ALIASES` from `src/domain/reference.ts`
- **Spec**: REQ-01
- Add `export` keyword to the existing `BOOK_ALIASES` constant — one-word change
- **Parallel with**: C1-T2 can happen alongside C1-T1 (no dependency between test file and this edit)

### [x] C1-T3 — GREEN: write `src/domain/book-suggestions.ts`
- **Spec**: REQ-02, REQ-03, REQ-04, REQ-05, REQ-06
- **Depends on**: C1-T2 (needs exported `BOOK_ALIASES`)
- Implement:
  - `BookSuggestion` type: `{ alias: string; canonical: string; displayName: string }`
  - `DISPLAY_NAMES` map — built at module load from `BOOK_ALIASES`; longest alias per USFM code, title-cased; regex `"1samuel"` → `"1 Samuel"`
  - `scoreAlias(alias: string, q: string): number` — returns `-1` if not subsequence; adds prefix bonus (50), exact-match bonus (100), density bonus (`q.length / alias.length * 30`)
  - `suggestBooks(query: string, limit = 5): BookSuggestion[]` — filters all ~130 entries via `scoreAlias`, sorts descending, slices to `limit`; returns `[]` for empty/whitespace query
- No IO, no side effects, no new runtime dependencies

### [x] C1-T4 — VERIFY: run `bun test`
- **Depends on**: C1-T3
- All C1 tests must pass; no regressions in existing suite
- Baseline: 156 tests currently passing

---

## Commit C2 — `feat(tui): reader-reducer suggestion state + actions`

Sequential after C1. Must complete before C3.

### [x] C2-T1 — RED: extend `src/tui/reader/reader-reducer.test.ts`
- **Spec**: REQ-07, REQ-08, REQ-09, REQ-10, REQ-11
- **Changes**:
  - Add `suggestions: [], selectedIndex: -1` to EVERY existing assertion that checks an `awaiting`-state shape (~12 tests will fail once the state type is extended)
  - New test group — `initialReaderState`: `suggestions` is `[]`, `selectedIndex` is `-1`
  - New test group — `PaletteReopened` sets `suggestions: []` and `selectedIndex: -1`
  - New test group — `QueryTyped`: dispatching with `"joh"` populates `suggestions`; dispatching any query resets `selectedIndex` to `-1`
  - New test group — `SuggestionMovedDown`:
    - `selectedIndex: -1`, suggestions length 4 → becomes `0`
    - `selectedIndex: 3`, suggestions length 4 → remains `3` (clamp)
    - Empty suggestions → state unchanged
  - New test group — `SuggestionMovedUp`:
    - `selectedIndex: 2` → becomes `1`
    - `selectedIndex: 0` → remains `0` (no wrap to -1)
    - Empty suggestions → state unchanged
  - New test group — `SuggestionAccepted`:
    - `selectedIndex: 1`, `suggestions[1].displayName = "John"` → `query` is `"John "`, `suggestions` is `[]`, `selectedIndex` is `-1`
    - `selectedIndex: -1` → state unchanged
- **Expect**: ~12 existing tests red + all new tests red

### [x] C2-T2 — GREEN: extend `src/tui/reader/reader-reducer.ts`
- **Spec**: REQ-07, REQ-08, REQ-09, REQ-10, REQ-11
- **Depends on**: C2-T1
- **Changes**:
  - Import `BookSuggestion` from `@/domain/book-suggestions`; import `suggestBooks` from `@/domain/book-suggestions`
  - Extend `awaiting` variant: add `suggestions: BookSuggestion[]` and `selectedIndex: number`
  - Add three new action types to `ReaderAction`: `SuggestionMovedUp`, `SuggestionMovedDown`, `SuggestionAccepted`
  - Update `initialReaderState` — add `suggestions: [], selectedIndex: -1`
  - Update `QueryTyped` handler — add `suggestions: suggestBooks(a.query), selectedIndex: -1`
  - Update `PaletteReopened` handler — add `suggestions: [], selectedIndex: -1`
  - Add `SuggestionMovedDown` handler — clamp increment at `suggestions.length - 1`; no-op when empty
  - Add `SuggestionMovedUp` handler — clamp decrement at `0`; no-op when empty
  - Add `SuggestionAccepted` handler — guard `selectedIndex >= 0`; set `query` to `suggestions[selectedIndex].displayName + " "`, clear `suggestions`, reset `selectedIndex: -1`
  - All new handlers added to the `satisfies` object-dispatch (NF-04: object-dispatch pattern required)
  - No useless comments (NF-05)

### [x] C2-T3 — VERIFY: run `bun test`
- **Depends on**: C2-T2
- All existing + new C1 + new C2 tests must pass

---

## Commit C3 — `feat(tui): suggestion list view + driver gate split`

Sequential after C2.

### [x] C3-T1 — Update `src/tui/reader/reader-screen.tsx` — suggestion list render
- **Spec**: REQ-14, REQ-15, REQ-16
- In the `awaiting` branch, below `<input>`:
  - Render `state.suggestions.map((s, i) => ...)` when `state.suggestions.length > 0`; render nothing when empty
  - Selected row (`i === state.selectedIndex`): marker `"› "` and display name use `fg={ACCENT_HEX}`; canonical code always uses `attributes={DIM}`
  - Unselected rows: no `fg` prop on marker/name; canonical code still uses `attributes={DIM}`
- Update `bottomTitleFor` awaiting case to: `" Tab complete  •  ↑↓ suggest  •  Enter open  •  q quit "`

### [x] C3-T2 — Update `src/tui/tui-driver.tsx` — split awaiting gate
- **Spec**: REQ-12, REQ-13
- Replace the monolithic `if (readerState.kind === "awaiting") return` with a partial intercept:
  ```
  if (readerState.kind === "awaiting") {
    if (keyEvent.name === "down") { dispatch({ type: "SuggestionMovedDown" }); return; }
    if (keyEvent.name === "up")   { dispatch({ type: "SuggestionMovedUp" }); return; }
    if (keyEvent.name === "tab")  { dispatch({ type: "SuggestionAccepted" }); return; }
    return; // all other keys suppressed
  }
  ```
- Verify `q`/`Q` quit handler remains ABOVE this block (REQ-13)
- **Tab consumption risk**: verify Tab is not captured by `<input>` element before `useKeyboard` fires; if it IS consumed, use a documented fallback key (e.g. `ctrl-space`) and record the deviation in apply-progress
- **Parallel with**: C3-T1 (both edits touch different files; can be done in same commit)

### [x] C3-T3 — VERIFY: run `bun test` + `tsc`
- **Depends on**: C3-T1, C3-T2
- `bun test` — 180+ tests passing (156 baseline + ≥20 new from C1/C2 + any new C3 tests)
- `bun run tsc --noEmit` — exits 0 (NF-03)

---

## Dependency Order

```
C1-T1 ──┐
C1-T2 ──┼──► C1-T3 ──► C1-T4 ──► C2-T1 ──► C2-T2 ──► C2-T3 ──► C3-T1 ──┐
                                                                   C3-T2 ──┼──► C3-T3
```

C1-T1 and C1-T2 are the only parallel pair. All other tasks are strictly sequential within and across commits.

---

## Non-Functional Checklist

| # | Requirement | Enforced at |
|---|-------------|-------------|
| NF-01 | No new runtime dependencies | C1-T3 (import only from stdlib + existing domain) |
| NF-02 | Test count grows to ≥180 | C3-T3 verify step |
| NF-03 | `tsc` exits clean | C3-T3 verify step |
| NF-04 | New reducer handlers use object-dispatch pattern | C2-T2 |
| NF-05 | No useless comments in new code | C1-T3, C2-T2 review |
