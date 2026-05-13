# Spec: palette-chapter-picker

## Capability

TUI palette — multi-stage book/chapter/verse picker with free-typing override.

Extends the palette flow from PR #12 (palette-suggestions) with two additional picker stages: a chapter numeric grid after a book is Tab-accepted, and a verse picker overlay after the fetched chapter passage lands. Free-typing always wins at any stage.

---

## Requirements

### Domain — `book-chapters.ts`

**REQ-01** A new file `src/domain/book-chapters.ts` exports `BOOK_CHAPTERS` as a `Record<string, number>` (or equivalent `Map<string, number>`) containing exactly 66 entries — one per canonical book name in standard Protestant canon order.

**REQ-02** `src/domain/book-chapters.ts` exports `chaptersForBook(canonical: string): number` that returns the chapter count for the given canonical key. Returns `0` (or a safe fallback) when the key is not found.

**REQ-03** `BOOK_CHAPTERS` is statically defined (no runtime fetch, no import from a JSON asset). It is the sole source of chapter counts in the codebase.

---

### State Machine — `awaiting` shape

**REQ-04** The `awaiting` variant of `ReaderState` gains three new fields:

```ts
phase: "book" | "chapter";
chapters: number[];
bookChosen: BookSuggestion | null;
```

`phase` defaults to `"book"`. `chapters` defaults to `[]`. `bookChosen` defaults to `null`.

**REQ-05** `makeAwaiting` (or equivalent `initialReaderState` factory) includes these three fields with their defaults. All existing call-sites that construct an `awaiting` value must supply them.

---

### State Machine — `loading` shape

**REQ-06** The `loading` variant of `ReaderState` gains one new field:

```ts
intent: "view" | "pick-verse";
```

Every transition that produces a `loading` state must supply `intent`.

---

### State Machine — `loaded` shape

**REQ-07** The `loaded` variant of `ReaderState` gains one new field:

```ts
versePicker: { selectedIndex: number } | null;
```

`versePicker` is `null` when the verse picker overlay is not active.

---

### New Actions

**REQ-08** `BookChosen` is a valid action type. It has no payload. It is only meaningful when the current state is `awaiting` with `phase: "book"` and `selectedIndex >= 0`.

**REQ-09** `ChapterChosen` is a valid action type. It has no payload. It is only meaningful when the current state is `awaiting` with `phase: "chapter"`, `bookChosen !== null`, and `selectedIndex >= 0`.

**REQ-10** `VersePickerMovedUp` is a valid action type with no payload.

**REQ-11** `VersePickerMovedDown` is a valid action type with no payload.

**REQ-12** `VersePickerMovedLeft` is a valid action type with no payload.

**REQ-13** `VersePickerMovedRight` is a valid action type with no payload.

**REQ-14** `VersePickerAccepted` is a valid action type with no payload.

**REQ-15** `VersePickerCancelled` is a valid action type with no payload.

**REQ-16** `PickerBackedOut` is a valid action type with no payload.

---

### Reducer transitions — `SuggestionAccepted` (book phase)

**REQ-17** When `SuggestionAccepted` fires in `awaiting` state with `phase: "book"` and `selectedIndex >= 0`, the reducer transitions to `awaiting` with:

- `phase: "chapter"`
- `bookChosen` set to `suggestions[selectedIndex]`
- `chapters` set to `chaptersForBook(bookChosen.canonical)` expressed as `[1, 2, ..., N]`
- `selectedIndex: 0`
- `suggestions: []`
- `query` rewritten to `"${bookChosen.displayName} "` (trailing space)

**REQ-18** When `SuggestionAccepted` fires in `awaiting` state with `phase: "book"` and `selectedIndex < 0`, the state is returned unchanged.

---

### Reducer transitions — `SuggestionAccepted` (chapter phase)

**REQ-19** When `SuggestionAccepted` fires in `awaiting` state with `phase: "chapter"`, `bookChosen !== null`, and `selectedIndex >= 0`, the reducer transitions to:

```ts
{
  kind: "loading",
  ref: { book: bookIdFromCanonical(bookChosen.canonical), chapter: chapters[selectedIndex], verses: { start: 1, end: 1 } },
  intent: "pick-verse",
}
```

**REQ-20** When `SuggestionAccepted` fires in `awaiting` state with `phase: "chapter"` but `bookChosen === null`, the state is returned unchanged.

---

### Reducer transitions — `QueryTyped`

**REQ-21** `QueryTyped` in `awaiting` state ALWAYS resets `phase` to `"book"`, clears `bookChosen` to `null`, clears `chapters` to `[]`, updates `query` to the new query string, and re-computes `suggestions` via `suggestBooks(query)`. This applies regardless of whether `phase` was previously `"book"` or `"chapter"`.

---

### Reducer transitions — `PassageFetched`

**REQ-22** When `PassageFetched` fires in `loading` state with `intent: "pick-verse"`, the reducer transitions to `loaded` with `versePicker: { selectedIndex: 0 }`.

**REQ-23** When `PassageFetched` fires in `loading` state with `intent: "view"`, the reducer transitions to `loaded` with `versePicker: null`.

**REQ-24** In both REQ-22 and REQ-23, `cursorIndex` and `pageStartIndex` are computed from the existing logic (`ref.verses.start` → `findIndex` in passage verses; `pageStartIndex = Math.floor(cursorIndex / VERSES_PER_PAGE) * VERSES_PER_PAGE`).

---

### Reducer transitions — `VersePickerAccepted`

**REQ-25** `VersePickerAccepted` in `loaded` state with `versePicker !== null` sets:

- `cursorIndex` to `versePicker.selectedIndex`
- `pageStartIndex` to `Math.floor(cursorIndex / VERSES_PER_PAGE) * VERSES_PER_PAGE`
- `versePicker` to `null`

**REQ-26** `VersePickerAccepted` when `versePicker === null` returns the state unchanged.

---

### Reducer transitions — `VersePickerCancelled`

**REQ-27** `VersePickerCancelled` in `loaded` state with `versePicker !== null` sets `versePicker` to `null`. `cursorIndex` is left at `0` (the value it has when `versePicker` was active since `PassageFetched` set it).

**REQ-28** `VersePickerCancelled` when `versePicker === null` returns the state unchanged.

---

### Reducer transitions — `VersePickerMovedUp` / `VersePickerMovedDown`

**REQ-29** `VersePickerMovedUp` in `loaded` state with `versePicker !== null` decrements `versePicker.selectedIndex` by 10, clamped to `0` (minimum).

**REQ-30** `VersePickerMovedDown` in `loaded` state with `versePicker !== null` increments `versePicker.selectedIndex` by 10, clamped to `passage.verses.length - 1` (maximum).

**REQ-31** `VersePickerMovedUp` and `VersePickerMovedDown` when `versePicker === null` return the state unchanged.

---

### Reducer transitions — `VersePickerMovedLeft` / `VersePickerMovedRight`

**REQ-32** `VersePickerMovedLeft` in `loaded` state with `versePicker !== null` decrements `versePicker.selectedIndex` by 1, clamped to `0`.

**REQ-33** `VersePickerMovedRight` in `loaded` state with `versePicker !== null` increments `versePicker.selectedIndex` by 1, clamped to `passage.verses.length - 1`.

**REQ-34** `VersePickerMovedLeft` and `VersePickerMovedRight` when `versePicker === null` return the state unchanged.

---

### Reducer transitions — `PickerBackedOut`

**REQ-35** `PickerBackedOut` in `awaiting` state with `phase: "chapter"` transitions to:

- `phase: "book"`
- `bookChosen: null`
- `chapters: []`
- `selectedIndex: -1`
- `suggestions` re-computed via `suggestBooks(query)`

**REQ-36** `PickerBackedOut` when `phase: "book"` or when state is not `awaiting` returns the state unchanged.

---

### Driver — key event routing

**REQ-37** In `tui-driver.tsx`, the `q`/`Q` quit handler is positioned above all other gates and fires unconditionally.

**REQ-38** When `readerState.kind === "loaded"` and `readerState.versePicker !== null`, the driver intercepts the following keys before any other `loaded`-state handler:

| Key name | Action dispatched |
|---|---|
| `"up"` | `VersePickerMovedUp` |
| `"down"` | `VersePickerMovedDown` |
| `"left"` | `VersePickerMovedLeft` |
| `"right"` | `VersePickerMovedRight` |
| `"tab"` | `VersePickerAccepted` |
| `"return"` | `VersePickerAccepted` |
| `"escape"` | `VersePickerCancelled` |

After dispatching, the handler returns immediately.

**REQ-39** When `readerState.kind === "loaded"` and `readerState.versePicker !== null`, all other key events (including `[`, `]`, `n`, `p`, `/`) are suppressed — the handler returns without dispatching.

**REQ-40** When `readerState.kind === "awaiting"` and `readerState.phase === "chapter"`, the `"escape"` key dispatches `PickerBackedOut`.

---

### View — chapter grid

**REQ-41** When `readerState.kind === "awaiting"` and `readerState.phase === "chapter"`, the palette renders a `NumberGrid` below the text input instead of the suggestion list.

**REQ-42** `NumberGrid` renders numbers in rows of exactly 10 columns. Numbers are right-padded to uniform width within a row.

**REQ-43** The selected cell (at `selectedIndex`) is rendered with `fg={ACCENT_HEX}` and prefixed with a `▶` marker. All other cells have no explicit foreground color override.

**REQ-44** The chapter grid title (`bottomTitleFor` or equivalent) displays a text variant identifying the chosen book and prompting the user to pick a chapter.

---

### View — verse picker overlay

**REQ-45** When `readerState.kind === "loaded"` and `readerState.versePicker !== null`, the reader screen renders a verse picker overlay on top of the (dimmed) reading view using the same `NumberGrid` component.

**REQ-46** The verse picker overlay numbers run from `1` to `passage.verses.length`, matching the verse numbers in the loaded passage.

**REQ-47** The verse picker overlay title (`bottomTitleFor` or equivalent) displays a text variant prompting the user to pick a verse.

---

### View — `bottomTitleFor` variants

**REQ-48** `bottomTitleFor` (or the equivalent title-string helper) produces distinct text for each of the following state combinations:

| State | Expected text variant |
|---|---|
| `awaiting`, `phase: "book"` | Book search prompt (existing) |
| `awaiting`, `phase: "chapter"` | Chapter pick prompt, includes book display name |
| `loading`, `intent: "view"` | Loading / fetching text (existing) |
| `loading`, `intent: "pick-verse"` | Loading / fetching text (may be identical to view variant) |
| `loaded`, `versePicker: null` | Reading view title (existing) |
| `loaded`, `versePicker !== null` | Verse pick prompt |
| `network-error` | Error text (existing) |

---

### Non-functional

**REQ-49** No new runtime dependencies are introduced. `BOOK_CHAPTERS` is a plain TypeScript object/map literal.

**REQ-50** TypeScript compilation passes cleanly (`tsc --noEmit`) with no new type errors.

**REQ-51** New action handlers in the reducer use object dispatch (Rule 13): each action type maps to a handler function in a lookup object rather than being handled inline in a `switch`/`if` chain. Existing handlers retain their current pattern; new handlers follow Rule 13.

**REQ-52** No comments that merely restate the code are added (Rule 14). Comments are permitted only for non-obvious intent, constraints, or external references.

**REQ-53** Test count grows from 178 to approximately 210 or more: mechanical updates account for the `awaiting` and `loaded` shape changes (~12 test sites × 1 assertion each), and new tests cover all new reducer transitions and the `chaptersForBook` helper.

---

## Acceptance Scenarios (excerpt)

All 21 scenarios defined in the full spec. Key scenarios include:

- SCENARIO-02: `chaptersForBook("gen")` returns 50
- SCENARIO-04–05: Multi-stage picker flow (book → chapter → loading/pick-verse)
- SCENARIO-09–16: Verse picker navigation and overlay transitions
- SCENARIO-20–21: End-to-end happy paths (guided flow and free-typing bypass)

---

## Out of Scope

- Hardcoded verse-count table (1189 entries) — verse counts come from `passage.verses.length` at runtime.
- Recent references / passage history.
- Palette result-list sections (References, Books, Commands).
- Translation switching.
- Chapter numbers displayed inside palette suggestion rows.

---

## Assumptions Made

1. `chaptersForBook` returns chapters as a sorted array `[1, 2, ..., N]` built from `BOOK_CHAPTERS[canonical]`.
2. `bookIdFromCanonical` is an existing or co-introduced helper that maps a canonical string to the `BookId` type.
3. Key names in OpenTUI `KeyEvent` are lowercase: `"escape"`, `"left"`, `"right"`, etc.
4. `VERSES_PER_PAGE` is already defined in the reducer or view layer.
