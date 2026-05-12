# Delta Spec: palette-suggestions

**Capability**: TUI palette — live book-name suggestions with keyboard navigation

---

## ADDED Requirements

### Requirement: REQ-01 — BOOK_ALIASES exported from reference.ts

`BOOK_ALIASES` MUST be exported from `src/domain/reference.ts`.

#### Scenario: Domain module can import the alias map

- GIVEN `src/domain/reference.ts` defines `BOOK_ALIASES`
- WHEN another domain module imports `BOOK_ALIASES` from `reference.ts`
- THEN the import resolves without error and the map is available

---

### Requirement: REQ-02 — suggestBooks returns ranked BookSuggestion objects

`suggestBooks(query, limit?)` MUST return at most `limit` (default 5) `BookSuggestion` objects sorted by score descending. Each object MUST have shape `{ alias, canonical, displayName }`.

#### Scenario: Default limit

- GIVEN a query that matches more than 5 aliases
- WHEN `suggestBooks(query)` is called without a second argument
- THEN at most 5 results are returned

#### Scenario: Custom limit

- GIVEN a query that matches more than 3 aliases
- WHEN `suggestBooks(query, 3)` is called
- THEN at most 3 results are returned

#### Scenario: Results are score-ordered

- GIVEN a query `"joh"` that matches `"john"`, `"1john"`, `"2john"`, and `"3john"`
- WHEN `suggestBooks("joh")` is called
- THEN results appear with higher-scored entries first

---

### Requirement: REQ-03 — Empty or whitespace-only query returns empty array

`suggestBooks` MUST return `[]` when the query is empty or contains only whitespace.

#### Scenario: Empty string

- GIVEN `query` is `""`
- WHEN `suggestBooks(query)` is called
- THEN the return value is `[]`

#### Scenario: Whitespace-only string

- GIVEN `query` is `"   "`
- WHEN `suggestBooks(query)` is called
- THEN the return value is `[]`

---

### Requirement: REQ-04 — Subsequence matching

`suggestBooks` MUST match aliases where every character of the query appears in the alias in order (subsequence check).

#### Scenario: Abbreviation match

- GIVEN `query` is `"jhn"`
- WHEN `suggestBooks(query)` is called
- THEN the result set includes an entry whose `displayName` is `"John"`

#### Scenario: Non-subsequence excluded

- GIVEN `query` is `"xyzzy"`
- WHEN `suggestBooks(query)` is called
- THEN the return value is `[]`

---

### Requirement: REQ-05 — Score ordering: exact > prefix > mid-string subsequence

An exact-match alias MUST score higher than a prefix-only match. A prefix-only match MUST score higher than a mid-string subsequence match.

#### Scenario: Exact beats prefix

- GIVEN aliases `"john"` (exact) and `"johnny"` (prefix) both match query `"john"`
- WHEN `suggestBooks("john")` is called
- THEN the entry with alias `"john"` appears before any prefix-only match

#### Scenario: Prefix beats mid-string subsequence

- GIVEN a prefix alias and a mid-string subsequence alias both match the same query
- WHEN `suggestBooks` is called
- THEN the prefix alias entry has a higher position in the result list

---

### Requirement: REQ-06 — Display name derivation for numbered books

`DISPLAY_NAMES` map MUST derive display names such that numbered-book aliases like `"1samuel"` produce `"1 Samuel"`.

#### Scenario: Numbered book title-case

- GIVEN the alias `"1samuel"` exists in `BOOK_ALIASES`
- WHEN `suggestBooks` returns a suggestion for it
- THEN `displayName` is `"1 Samuel"`

---

### Requirement: REQ-07 — awaiting state extended with suggestion fields

The `awaiting` state variant MUST include `suggestions: BookSuggestion[]` and `selectedIndex: number` (default `-1`).

#### Scenario: Initial state shape

- GIVEN the application initialises
- WHEN `initialReaderState` is read
- THEN `initialReaderState.suggestions` is `[]` and `initialReaderState.selectedIndex` is `-1`

#### Scenario: PaletteReopened initialises new fields

- GIVEN the state is `loaded` or `network-error`
- WHEN `PaletteReopened` is dispatched
- THEN the resulting `awaiting` state has `suggestions: []` and `selectedIndex: -1`

---

### Requirement: REQ-08 — QueryTyped recomputes suggestions and resets selectedIndex

On `QueryTyped`, the reducer MUST call `suggestBooks(query)` and set `selectedIndex` to `-1`.

#### Scenario: Suggestions populate on typing

- GIVEN the state is `awaiting`
- WHEN `QueryTyped` is dispatched with `query: "joh"`
- THEN `suggestions` contains entries matching `"joh"` and `selectedIndex` is `-1`

#### Scenario: selectedIndex resets on new keystroke

- GIVEN `awaiting` state with `selectedIndex: 2`
- WHEN `QueryTyped` is dispatched with any query
- THEN `selectedIndex` is `-1`

---

### Requirement: REQ-09 — SuggestionMovedDown action

`SuggestionMovedDown` MUST increment `selectedIndex` by 1, clamped at `suggestions.length - 1`. It MUST NOT wrap.

#### Scenario: Move into list

- GIVEN `awaiting` with `suggestions` of length 4 and `selectedIndex: -1`
- WHEN `SuggestionMovedDown` is dispatched
- THEN `selectedIndex` is `0`

#### Scenario: Clamp at bottom

- GIVEN `awaiting` with `suggestions` of length 4 and `selectedIndex: 3`
- WHEN `SuggestionMovedDown` is dispatched
- THEN `selectedIndex` remains `3`

#### Scenario: No-op when no suggestions

- GIVEN `awaiting` with `suggestions: []`
- WHEN `SuggestionMovedDown` is dispatched
- THEN state is unchanged

---

### Requirement: REQ-10 — SuggestionMovedUp action

`SuggestionMovedUp` MUST decrement `selectedIndex` by 1, clamped at `0`. It MUST NOT wrap and MUST NOT return to `-1` once navigation has started.

#### Scenario: Move up from middle

- GIVEN `awaiting` with `selectedIndex: 2`
- WHEN `SuggestionMovedUp` is dispatched
- THEN `selectedIndex` is `1`

#### Scenario: Clamp at top (no return to -1)

- GIVEN `awaiting` with `selectedIndex: 0`
- WHEN `SuggestionMovedUp` is dispatched
- THEN `selectedIndex` remains `0`

#### Scenario: No-op when no suggestions

- GIVEN `awaiting` with `suggestions: []`
- WHEN `SuggestionMovedUp` is dispatched
- THEN state is unchanged

---

### Requirement: REQ-11 — SuggestionAccepted action

`SuggestionAccepted` with `selectedIndex >= 0` MUST set `query` to `displayName + " "`, clear `suggestions`, and reset `selectedIndex` to `-1`. With `selectedIndex < 0` it MUST be a no-op.

#### Scenario: Accept highlighted suggestion

- GIVEN `awaiting` with `selectedIndex: 1` and `suggestions[1].displayName = "John"`
- WHEN `SuggestionAccepted` is dispatched
- THEN `query` is `"John "`, `suggestions` is `[]`, and `selectedIndex` is `-1`

#### Scenario: No-op when nothing selected

- GIVEN `awaiting` with `selectedIndex: -1`
- WHEN `SuggestionAccepted` is dispatched
- THEN state is unchanged

---

### Requirement: REQ-12 — Driver intercepts up/down/tab in awaiting state

The TUI driver MUST intercept `up`, `down`, and `tab` keys while the state is `awaiting` and dispatch `SuggestionMovedUp`, `SuggestionMovedDown`, and `SuggestionAccepted` respectively. All other keys (except `q`/`Q`) MUST remain suppressed.

#### Scenario: Down arrow dispatches SuggestionMovedDown

- GIVEN the reader is in `awaiting` state
- WHEN the user presses the down-arrow key
- THEN `SuggestionMovedDown` is dispatched and no further processing occurs

#### Scenario: Tab dispatches SuggestionAccepted

- GIVEN the reader is in `awaiting` state
- WHEN the user presses Tab
- THEN `SuggestionAccepted` is dispatched and no further processing occurs

#### Scenario: Other keys still suppressed

- GIVEN the reader is in `awaiting` state
- WHEN the user presses any key that is not `up`, `down`, `tab`, `q`, or `Q`
- THEN no reader action is dispatched

---

### Requirement: REQ-13 — q/Q quit fires above the awaiting gate

The `q`/`Q` quit handler MUST be evaluated BEFORE the `awaiting`-state intercept block so it is always reachable regardless of state.

#### Scenario: Quit available in awaiting

- GIVEN the reader is in `awaiting` state
- WHEN the user presses `q`
- THEN the quit action fires (not suppressed by the awaiting gate)

---

### Requirement: REQ-14 — View renders suggestion list conditionally

The reader screen MUST render a suggestion row list when `suggestions.length > 0` and render nothing in its place when `suggestions.length === 0`.

#### Scenario: List renders when suggestions present

- GIVEN `awaiting` state with `suggestions` of length 3
- WHEN the screen renders
- THEN 3 suggestion rows appear below the input

#### Scenario: List hidden when no suggestions

- GIVEN `awaiting` state with `suggestions: []`
- WHEN the screen renders
- THEN no suggestion rows are rendered

---

### Requirement: REQ-15 — Selected row styled with accent; canonical code dimmed

The selected suggestion row MUST use `fg={ACCENT_HEX}` on both the marker character and the display name. The canonical USFM code MUST use `attributes={DIM}`.

#### Scenario: Accent applied to selected row

- GIVEN `selectedIndex: 1` and 3 suggestions
- WHEN the screen renders
- THEN the marker and display name of row 1 have `fg` set to `ACCENT_HEX`
- AND the marker and display name of rows 0 and 2 have no `fg` prop

#### Scenario: Canonical code always dimmed

- GIVEN any suggestion row (selected or not)
- WHEN the screen renders
- THEN the span containing the USFM canonical code has `attributes={DIM}`

---

### Requirement: REQ-16 — bottomTitleFor awaiting hint text

`bottomTitleFor` for the `awaiting` state MUST return `" Tab complete  •  ↑↓ suggest  •  Enter open  •  q quit "`.

#### Scenario: Hint text matches spec

- GIVEN the reader is in `awaiting` state
- WHEN `bottomTitleFor` is called
- THEN the return value is exactly `" Tab complete  •  ↑↓ suggest  •  Enter open  •  q quit "`

---

## Integration Scenario (from Success Criterion)

### Scenario: End-to-end palette suggestion flow

- GIVEN the reader is in `awaiting` state with an empty input
- WHEN the user types `"joh"`
- THEN suggestions include John, 1 John, 2 John, 3 John
- WHEN the user presses down-arrow once
- THEN `selectedIndex` is `0` (John highlighted)
- WHEN the user presses Tab
- THEN `query` becomes `"John "` and the suggestion list clears
- WHEN the user types `"3:16"` and presses Enter
- THEN `QuerySubmitted` fires with `"John 3:16"` and the verse loads
- AND the suggestion list is not shown

### Scenario: No suggestions for unknown query

- GIVEN the reader is in `awaiting` state
- WHEN the user types `"xyzzy"`
- THEN suggestions is `[]` and no list renders
- WHEN the user presses Enter
- THEN `QuerySubmitted` fires and the reducer produces a parse error

---

## Out of Scope

- Recent references / history
- Chapter-level suggestions
- Full palette result sections (References / Books / Commands)
- Translation switching from the palette

---

## Non-Functional Requirements

| # | Requirement |
|---|-------------|
| NF-01 | No new runtime dependencies introduced |
| NF-02 | Test count grows from 156 to ≥ 180 (≥ 20 new tests covering suggester + reducer extensions) |
| NF-03 | `tsc` must exit clean (zero errors) after all changes |
| NF-04 | New reducer handlers MUST use object-dispatch pattern (Rule 13) |
| NF-05 | No useless comments in new code (Rule 14) |
