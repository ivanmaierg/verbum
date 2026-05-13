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
    suggestions: suggestBooks(a.query),
  };
},
```

## View

`NumberGrid` component (reusable):
```ts
type NumberGridProps = {
  numbers: number[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
  cols?: number; // default 10
};
```

Renders `numbers` in rows of `cols`, selected cell fg=ACCENT_HEX + ▶ prefix.

`bottomTitleFor` gains branch:
```ts
if (readerState.kind === "awaiting" && readerState.phase === "chapter") {
  const bookName = readerState.bookChosen?.displayName || "?";
  return `${bookName} — Pick a chapter`;
}
```

And for verse picker:
```ts
if (readerState.kind === "loaded" && readerState.versePicker !== null) {
  return "Pick a verse";
}
```

## Driver

New gate at top of loaded-state keybinds:

```ts
if (readerState.kind === "loaded" && readerState.versePicker !== null) {
  if (["up", "down", "left", "right"].includes(keyEvent.name)) {
    // dispatch move action
  }
  if (["tab", "return"].includes(keyEvent.name)) {
    // dispatch VersePickerAccepted
  }
  if (keyEvent.name === "escape") {
    // dispatch VersePickerCancelled
  }
  return; // suppress all other keys
}
```

For chapter phase:
```ts
if (readerState.kind === "awaiting" && readerState.phase === "chapter") {
  if (keyEvent.name === "escape") {
    dispatch({ type: "PickerBackedOut" });
    return;
  }
}
```

## Enter vs Tab

Tab = SuggestionAccepted (picker accept). Enter = QuerySubmitted (parse typed ref). If query is "John " without chapter, parseReference returns malformed error — same path as today.

## Line budget

~235 lines total across 5 files. Under 400-line budget. Single PR appropriate.

## Open questions for proposal

1. Smart filter vs drop-back on QueryTyped in chapter mode (recommend smart filter)
2. Grid vs column list (grid recommended — matches ui-sketches.md)
3. Enter on chapter with selectedIndex >= 0: add phase branch in QuerySubmitted or rely on Tab only
4. Psalms: 15 rows fits without windowing — accept for v1
