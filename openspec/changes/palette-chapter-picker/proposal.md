# Proposal: palette-chapter-picker

## TL;DR

- Extends the palette flow from PR #12 (palette-suggestions) with two new picker stages: chapter grid after book Tab-accept, and verse picker overlay after chapter loads.
- Chapter count comes from a hardcoded `BOOK_CHAPTERS` table (66 entries); verse count comes lazily from `passage.verses.length` — no 1189-row data file.
- Free-typing always wins: any `QueryTyped` resets to `phase: "book"`, and a bare `Enter` parses the literal query and routes straight to `loading` with `intent: "view"`.
- One PR, ~320 lines; under the 400-line review budget.
- Single atomic `ReaderState` extension — no new domain service or infrastructure layer.

## Why

User request: "chapter verse pick, remember make some UI sketches." Three approaches were explored and sketched; the user confirmed the **lazy verse list** approach (fetch verse count from the chapter passage already fetched, no hardcoded table).

## What Changes

| File | Status | Description |
|------|--------|-------------|
| `src/domain/book-chapters.ts` | New | `BOOK_CHAPTERS` map (66 entries) + `chaptersForBook()` helper |
| `src/domain/book-chapters.test.ts` | New | Unit tests for `chaptersForBook()` |
| `src/tui/reader/reader-reducer.ts` | Modified | Phase field, `intent` on `loading`, `versePicker` on `loaded`, 6 new actions |
| `src/tui/reader/reader-reducer.test.ts` | Modified | ~12 test sites updated for new `awaiting` shape; new transition tests |
| `src/tui/reader/reader-screen.tsx` | Modified | Chapter grid render, verse picker overlay, `NumberGrid` helper |
| `src/tui/tui-driver.tsx` | Modified | `versePicker !== null` gate + suppression of reading-view keybinds |

## What Does NOT Change

- Domain types (`Reference`, `Passage`, `BookSuggestion`, `ParseError`) — unchanged.
- Application use cases (`GetPassageUseCase`, `repository` contracts`) — unchanged.
- CLI entry points (`run`, `vod`) — unchanged.
- ADR 0010 TS-native dialect (Rule 13 + 14) retained throughout.
- `SuggestionAccepted` action preserved as-is (now branches on `phase`); test backwards-compat maintained.

## State Machine Extension

```ts
type ReaderState =
  | {
      kind: "awaiting";
      phase: "book" | "chapter";        // NEW
      query: string;
      parseError: ParseError | null;
      suggestions: BookSuggestion[];
      chapters: number[];               // NEW — populated when phase: "chapter"
      bookChosen: BookSuggestion | null; // NEW
      selectedIndex: number;
    }
  | {
      kind: "loading";
      ref: Reference;
      intent: "view" | "pick-verse";    // NEW
    }
  | {
      kind: "loaded";
      passage: Passage;
      ref: Reference;
      cursorIndex: number;
      pageStartIndex: number;
      versePicker: { selectedIndex: number } | null; // NEW
    }
  | { kind: "network-error"; ref: Reference; reason: RepoError };
```

New actions: `BookChosen`, `ChapterChosen`, `VersePickerMovedUp`, `VersePickerMovedDown`, `VersePickerMovedLeft`, `VersePickerMovedRight`, `VersePickerAccepted`, `VersePickerCancelled`, `PickerBackedOut`.

## Pick Flow

1. **Book picker** — existing behavior (PR #12). Tab on suggestion dispatches `SuggestionAccepted` → `phase: "chapter"`.
2. **Chapter picker** — numeric grid (10 per row). `↑`/`↓` move by 10 rows; `←`/`→` move by 1. Tab dispatches `SuggestionAccepted` → `loading` with `intent: "pick-verse"`.
3. **Spinner** — existing Braille spinner from `usePassageFetch`. One extra round-trip between chapter pick and verse picker.
4. **Verse picker overlay** — `PassageFetched` lands; reducer sets `versePicker: { selectedIndex: 0 }`. Same `NumberGrid` component. Esc dispatches `VersePickerCancelled`, Tab/Enter dispatches `VersePickerAccepted`.
5. **Verse accepted** — `cursorIndex` set to picked verse; `pageStartIndex` computed via `Math.floor(cursorIndex / VERSES_PER_PAGE) * VERSES_PER_PAGE`; `versePicker` set to `null`.
6. **Free-typing override** — `QueryTyped` always resets to `phase: "book"`; `QuerySubmitted` parses literal and routes to `loading` with `intent: "view"`, bypassing verse picker entirely.

## Driver Gate Change

New branch at the top of the key-event handler, above existing `loaded` keybinds:

```ts
if (readerState.kind === "loaded" && readerState.versePicker !== null) {
  if (keyEvent.name === "up")     { dispatch({ type: "VersePickerMovedUp" });    return; }
  if (keyEvent.name === "down")   { dispatch({ type: "VersePickerMovedDown" });  return; }
  if (keyEvent.name === "left")   { dispatch({ type: "VersePickerMovedLeft" });  return; }
  if (keyEvent.name === "right")  { dispatch({ type: "VersePickerMovedRight" }); return; }
  if (keyEvent.name === "tab")    { dispatch({ type: "VersePickerAccepted" });   return; }
  if (keyEvent.name === "return") { dispatch({ type: "VersePickerAccepted" });   return; }
  if (keyEvent.name === "escape") { dispatch({ type: "VersePickerCancelled" });  return; }
  return; // suppress all other keybinds ([ ] n p / etc.)
}
```

`q`/`Q` quit sits above this gate and always wins.

## First Reviewable Cut

Single PR, ~320 lines. If `NumberGrid` extraction is needed to stay under budget, it moves to its own component file (adds ~0 net lines, just reorganizes).

## Success Criterion

- `verbum` → palette opens → type `joh` → Tab on John → chapter grid renders → Tab on 3 → spinner shows briefly → verse picker overlay renders → `↓↓` to verse 16 → Tab → reader loads John 3 with cursor on verse 16.
- Separately: type `john 3:16` → Enter → reader loads John 3:16 directly, no picker shown at any step.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `makeAwaiting` / `initialReaderState` shape cascade — ~12 test sites need `phase`, `chapters`, `bookChosen` fields | Med | Mechanical; tackle first in apply |
| `loaded` shape change — existing `loaded` tests need `versePicker: null` | Med | Mechanical; one-pass fix |
| `left`/`right` arrow key names not yet verified in OpenTUI `KeyHandler` | Low | Verify at apply time; fallback to checking the existing `KeyEvent` type |
| `escape` key name — currently unused, assumed `"escape"` | Low | Confirm at apply time via `KeyEvent` type |

## Out of Scope

- Verse-count hardcoded data table (1189 entries) — deliberately deferred in favour of lazy fetch.
- Recent references / passage history — separate feature.
- Chapter list displayed inside palette suggestion rows — different feature.
- Translation switching — separate feature.

## Capabilities

### New Capabilities

- `chapter-verse-picker`: Multi-stage palette flow — chapter numeric grid and verse overlay — driven by the extended `ReaderState` machine and `BOOK_CHAPTERS` domain module.

### Modified Capabilities

- `palette-suggestions`: `awaiting` state shape gains `phase`, `chapters`, `bookChosen`; `SuggestionAccepted` branches on phase; driver gate updated.

## Approach

Pure state-machine extension inside the existing reducer. No new infrastructure. New domain module `book-chapters.ts` is side-effect-free and independently testable. View layer adds one reusable `NumberGrid` helper and one overlay branch in the reader screen.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/book-chapters.ts` | New | Canonical chapter counts + lookup helper |
| `src/tui/reader/reader-reducer.ts` | Modified | Phase, intent, versePicker, 9 new actions |
| `src/tui/reader/reader-screen.tsx` | Modified | Chapter grid + verse picker overlay |
| `src/tui/tui-driver.tsx` | Modified | versePicker-mode key gate |

## Rollback Plan

All changes are additive to `ReaderState`. To revert: `git revert` the single PR. No data migration, no infrastructure change, no external dependency added.

## Dependencies

- PR #12 (palette-suggestions) — merged. This change builds directly on top.

## Next Steps (Backlog)

- USFM alignment polish (separate change).
- Recent references / passage history.
- Translation switching.
