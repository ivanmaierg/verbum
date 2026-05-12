# Exploration: palette-chapter-picker

Builds on PR #12 (`palette-suggestions`). Adds two more stages to the palette flow: a chapter picker after book pick, and a verse picker after the chapter loads. Both pickers are bypass-able via free-typing the full `<book> <chapter>:<verse>` reference.

## Locked Flow (user-confirmed)

1. **Book picker** — current behavior (PR #12). Type → fuzzy match → ↑/↓ select → Tab accepts.
2. **Chapter picker** — Tab on book transitions palette to chapter mode. Numeric grid (10 per row) with `▶` cursor on selected. Chapter count from `BOOK_CHAPTERS` table (hardcoded, ~70 lines, public-domain canon data — Genesis 50, Exodus 40, ..., Revelation 22).
3. **Tab on chapter** — fires a `loading` state with `intent: "pick-verse"`. Triggers the existing async fetch via `usePassageFetch`. Loading spinner shows briefly.
4. **Verse picker** — once `PassageFetched` lands, the reducer sees `intent: "pick-verse"` and renders an overlay over the loaded view: numeric grid 1..passage.verses.length. User picks → cursor lands on that verse, overlay closes, reader is in normal `loaded` state.
5. **Esc on verse picker** — closes overlay, keeps cursor at verse 1 (whole-chapter reading).
6. **Free-typing override** — at any palette stage, typing `:digits` or hitting Enter dispatches `QuerySubmitted` which parses the literal query and goes straight to `loading` with `intent: "view"` (no verse picker overlay).

## Data Story

**No hardcoded verse-count table.** Verse count for the picker comes from `passage.verses.length` — the chapter fetch we already do. One extra round-trip latency between chapter pick and verse picker (shown as the existing Braille spinner), but zero data commitment in the repo. Hardcoded verse counts would be ~1189 chapter entries; lazy is a clean trade.

**`BOOK_CHAPTERS` IS hardcoded** — 66 entries, ~70 lines. Static, canonical, won't churn. Lives at `src/domain/book-chapters.ts`.

## State Machine

Three changes to `ReaderState`:

```ts
type ReaderState =
  | {
      kind: "awaiting";
      phase: "book" | "chapter";        // NEW phase field
      query: string;
      parseError: ParseError | null;
      suggestions: BookSuggestion[];
      chapters: number[];               // NEW — populated when phase: "chapter"
      bookChosen: BookSuggestion | null; // NEW — set when phase: "chapter"
      selectedIndex: number;
    }
  | {
      kind: "loading";
      ref: Reference;
      intent: "view" | "pick-verse";    // NEW — drives PassageFetched landing
    }
  | {
      kind: "loaded";
      passage: Passage;
      ref: Reference;
      cursorIndex: number;
      pageStartIndex: number;
      versePicker: { selectedIndex: number } | null;  // NEW — overlay state
    }
  | { kind: "network-error"; ref: Reference; reason: RepoError };
```

## New Actions

- `BookChosen` — replaces the book-phase branch of `SuggestionAccepted`. Sets `phase: "chapter"`, populates `chapters: chaptersForBook(canonical)`, sets `bookChosen`, resets `selectedIndex` to 0.
- `ChapterChosen` — replaces the chapter-phase branch. Transitions to `{ kind: "loading", ref: { book, chapter: selectedChapter, verses: { start: 1, end: 1 } }, intent: "pick-verse" }`.
- `VersePickerMovedUp/Down/Left/Right` — grid navigation. Grid is 10 columns; `Left/Right` move by 1, `Up/Down` move by 10 (clamped).
- `VersePickerAccepted` — sets `cursorIndex` to the selected verse's index, computes `pageStartIndex`, sets `versePicker: null`.
- `VersePickerCancelled` — Esc. Sets `versePicker: null`, cursor stays at 0.

The existing `SuggestionAccepted` is preserved but only fires in `phase: "book"` (delegates to `BookChosen` via dispatch chain — or kept as an alias for backwards compat with tests).

## Reducer Logic Sketch

```ts
SuggestionAccepted: (s, _a) => {
  if (s.kind !== "awaiting" || s.selectedIndex < 0) return s;
  if (s.phase === "book") {
    const book = s.suggestions[s.selectedIndex];
    const chapters = chaptersForBook(book.canonical);
    return { ...s, phase: "chapter", bookChosen: book, chapters, selectedIndex: 0, suggestions: [], query: `${book.displayName} ` };
  }
  if (s.phase === "chapter") {
    if (!s.bookChosen) return s;
    const chapter = s.chapters[s.selectedIndex];
    const book = bookIdFromCanonical(s.bookChosen.canonical);
    return {
      kind: "loading",
      ref: { book, chapter, verses: { start: 1, end: 1 } },
      intent: "pick-verse",
    };
  }
  return s;
},

PassageFetched: (s, a) => {
  if (s.kind !== "loading") return s;
  const targetVerse = s.ref.verses.start;
  const foundIndex = a.passage.verses.findIndex((v) => v.number === targetVerse);
  const cursorIndex = foundIndex >= 0 ? foundIndex : 0;
  const pageStartIndex = Math.floor(cursorIndex / VERSES_PER_PAGE) * VERSES_PER_PAGE;
  const versePicker = s.intent === "pick-verse" ? { selectedIndex: 0 } : null;
  return { kind: "loaded", passage: a.passage, ref: s.ref, cursorIndex, pageStartIndex, versePicker };
},

QueryTyped: (s, a) => {
  if (s.kind !== "awaiting") return s;
  // Any keystroke drops back to book phase — free-typing always wins.
  return {
    ...s,
    phase: "book",
    bookChosen: null,
    chapters: [],
    query: a.query,
    parseError: null,
    suggestions: suggestBooks(a.query),
    selectedIndex: -1,
  };
},
```

## View

- `phase: "book"`: existing suggestion list.
- `phase: "chapter"`: numeric grid below the input. Selected cell in accent. Title shows chosen book.
- `loaded` with `versePicker !== null`: overlay box over the dimmed reading view. Same numeric grid pattern. Esc cancels, Enter/Tab accepts.

Grid rendering helper:

```tsx
function NumberGrid({ numbers, selectedIndex, columns = 10 }) {
  const rows: number[][] = [];
  for (let i = 0; i < numbers.length; i += columns) {
    rows.push(numbers.slice(i, i + columns));
  }
  return (
    <box flexDirection="column">
      {rows.map((row, ri) => (
        <text key={ri}>
          {row.map((n, ci) => {
            const idx = ri * columns + ci;
            const focused = idx === selectedIndex;
            return (
              <span key={n} fg={focused ? ACCENT_HEX : undefined}>
                {focused ? `▶ ${String(n).padStart(2)}  ` : `  ${String(n).padStart(2)}  `}
              </span>
            );
          })}
        </text>
      ))}
    </box>
  );
}
```

## Driver Keybind Changes

Current `awaiting` gate works for both `phase: "book"` and `phase: "chapter"` since the action handlers branch on `phase`. No driver change there.

But we now need keybinds for verse picker (in `loaded` state when `versePicker !== null`):
- `↑`/`↓`/`←`/`→` → `VersePickerMovedUp/Down/Left/Right`
- `Tab` or `Enter` → `VersePickerAccepted`
- `Esc` → `VersePickerCancelled`
- Reading view's existing keybinds (`[`/`]`/`n`/`p`/`/`) must be GATED OFF when `versePicker !== null`

Driver gate addition:
```ts
if (readerState.kind === "loaded" && readerState.versePicker !== null) {
  if (keyEvent.name === "up")     { dispatch({ type: "VersePickerMovedUp" }); return; }
  if (keyEvent.name === "down")   { dispatch({ type: "VersePickerMovedDown" }); return; }
  if (keyEvent.name === "left")   { dispatch({ type: "VersePickerMovedLeft" }); return; }
  if (keyEvent.name === "right")  { dispatch({ type: "VersePickerMovedRight" }); return; }
  if (keyEvent.name === "tab")    { dispatch({ type: "VersePickerAccepted" }); return; }
  if (keyEvent.name === "return") { dispatch({ type: "VersePickerAccepted" }); return; }
  if (keyEvent.name === "escape") { dispatch({ type: "VersePickerCancelled" }); return; }
  return; // suppress everything else
}
```

`q`/`Q` quit still sits above and wins.

## Approaches Considered

| Approach | Pros | Cons |
|---|---|---|
| Hardcoded verse-count table (1189 entries) | No fetch latency | ~30KB data file; maintenance if any translation differs |
| **Lazy verse list from fetched passage (chosen)** | Zero data commitment; verse count is authoritative for the loaded translation | One extra spinner between chapter pick and verse picker |
| No verse picker (chapter pick loads immediately, cursor on verse 1) | Simplest | Doesn't satisfy "verse pick" requirement |

## Slicing

One PR, estimated:

| File | Lines |
|------|-------|
| `src/domain/book-chapters.ts` (new) | ~70 |
| `src/domain/book-chapters.test.ts` (new) | ~25 |
| `src/tui/reader/reader-reducer.ts` | ~80 (phase + intent + versePicker + 6 new actions + existing handlers updated) |
| `src/tui/reader/reader-reducer.test.ts` | ~80 (existing awaiting tests need `phase: "book"`, `chapters: []`, `bookChosen: null`; new tests for all new transitions) |
| `src/tui/reader/reader-screen.tsx` | ~50 (chapter grid render, verse picker overlay, NumberGrid helper) |
| `src/tui/tui-driver.tsx` | ~15 (versePicker-mode gate) |
| **Total** | **~320 lines** |

Under 400-line budget but close. If the budget gets tight, the NumberGrid helper extracts to its own component file.

## Risks

1. **`makeAwaiting` and `initialReaderState` shape change** — every test that builds an `awaiting` state needs `phase: "book"`, `chapters: []`, `bookChosen: null` added. ~12 test sites, mechanical.
2. **`loaded` shape change** — `versePicker: null` added. Existing `loaded` tests need the field.
3. **Verse picker grid keybinds** — `Left`/`Right` arrow keys aren't currently handled anywhere. Verify they exist in OpenTUI key event names (almost certainly `"left"` / `"right"` per the `KeyHandler` convention).
4. **Free-typing edge case** — when in `phase: "chapter"`, if user types a digit, our `QueryTyped` drops back to `phase: "book"`. The query becomes "John 3" (input had "John " + user typed "3"). `suggestBooks("John 3")` matches nothing — empty suggestions. On Enter, `parseReference` parses it correctly as John 3. Works.
5. **Esc keybind** — currently unused. Confirm `keyEvent.name === "escape"`.

## Open Questions for Proposal

1. **Grid columns**: 10 per row is standard. For chapters (≤150) and verses (≤176 in Psalm 119), 10 cols × 15 rows fits comfortably. Lock at 10.
2. **Verse picker `pageStartIndex`**: when `VersePickerAccepted` lands the cursor on verse N, the page must scroll to show it. Compute as `Math.floor(cursorIndex / VERSES_PER_PAGE) * VERSES_PER_PAGE`. Lock.
3. **`q` from chapter phase**: quits the app. The user might expect Esc to go back to book picker. Recommend: `Esc` goes back to book phase from chapter phase (clears `bookChosen`, restores book suggestions if query non-empty). Adds one more action `PickerBackedOut`. Small addition.

## Ready for Proposal

Yes. The state machine is concrete; the lazy verse list resolves the data question; the picker overlay pattern reuses the verse-cursor accent styling.
