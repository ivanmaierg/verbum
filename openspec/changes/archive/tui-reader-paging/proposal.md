# Proposal: tui-reader-paging

## TL;DR

- The reader screen currently renders all passage verses in a single unbounded list with no cursor — only one verse is visible on first paint due to terminal scroll behavior.
- This change adds verse cursor navigation (`↑`/`↓`), page navigation (`[`/`]`), and rebinds chapter navigation to `n`/`p`.
- State is extended with `cursorIndex` and `pageStartIndex` (0-based array indices into `passage.verses`) — index-based to handle non-contiguous verse numbers.
- Fixes an existing driver bug: `/` fires `PaletteReopened` while the palette `<input>` is focused, because no `awaiting`-state gate existed.
- Ships as one PR, ~136 lines — well under the 400-line review budget.

---

## Why

The reader screen shipped with PR #10 (`tui-reader-screen`) renders `passage.verses` in full without any scrolling, cursor, or paging. In practice only the first verse is visible on first paint — the TUI renders a list taller than the terminal frame and the rest is cropped. The user cannot navigate or read the passage.

The request is to make the reader usable: show 8 verses per page, let the user move a cursor line by line, and page through the passage. Chapter navigation is retained but moves to `n`/`p` to free `[`/`]` for page navigation.

Additionally, the `awaiting`-state gate fixes a confirmed bug: pressing `/` while the palette `<input>` is active re-dispatches `PaletteReopened`, clearing the user's in-progress query.

---

## What Changes

| File | Change |
|---|---|
| `src/tui/reader/reader-reducer.ts` | Extend `loaded` variant with `cursorIndex`/`pageStartIndex`; add `CursorMovedUp`, `CursorMovedDown`, `PageAdvanced`, `PageRetreated` actions; update `PassageFetched` handler |
| `src/tui/reader/reader-reducer.test.ts` | RED-first tests for all new actions and the updated `loaded` shape; existing tests updated for new shape |
| `src/tui/reader/reader-screen.tsx` | Render page slice (`verses.slice(pageStartIndex, pageStartIndex + VERSES_PER_PAGE)`); `▶` gutter marker in `ACCENT_HEX`; `TextAttributes.INVERSE` on focused verse text; update `bottomTitleFor` |
| `src/tui/tui-driver.tsx` | `awaiting`-state gate; bind `↑`/`↓` to cursor actions; rebind `[`/`]` to page nav; add `n`/`p` for chapter nav |
| `src/tui/welcome/welcome-screen.tsx` | Update hint line to reflect new keybind scheme |

---

## What Does NOT Change

- **Domain layer**: `parseReference` and all reference parsing logic — untouched.
- **Application layer**: `getPassage` use case — untouched.
- **API adapter**: `BibleApiAdapter` / `EsvApiAdapter` — untouched.
- **CLI entry point**: `run` / `vod` commands — untouched.
- **ADR 0010 dialect**: existing reducer action names (`ChapterAdvanced`, `ChapterRetreated`, `PassageFetched`, `PaletteReopened`) are retained. The keybinds that trigger them change in the driver, not the reducer.
- **`loading` and `network-error` state variants**: no cursor fields added — chapter transitions go through `loading → loaded`, which resets to `cursorIndex: 0, pageStartIndex: 0` via the `PassageFetched` handler.

---

## State Machine Extension

### New `loaded` variant shape

```ts
| {
    kind: "loaded";
    passage: Passage;
    ref: Reference;
    cursorIndex: number;      // 0-based array index of focused verse in passage.verses
    pageStartIndex: number;   // 0-based array index of first verse on current page
  }
```

Index-based rationale: `passage.verses[0].number` is not guaranteed to be `1`. A passage like John 3:14–18 has `verses[0].number === 14`. Storing array indices keeps all page arithmetic correct on any passage slice.

### PassageFetched handler

```ts
PassageFetched: (s, a) =>
  s.kind === "loading"
    ? { kind: "loaded", passage: a.passage, ref: s.ref, cursorIndex: 0, pageStartIndex: 0 }
    : s,
```

### New action union members

```ts
| { type: "CursorMovedUp" }
| { type: "CursorMovedDown" }
| { type: "PageAdvanced" }
| { type: "PageRetreated" }
```

### Boundary behavior

| Action | Boundary | Behavior |
|---|---|---|
| `CursorMovedDown` | Last verse, last page | Clamp — no-op |
| `CursorMovedDown` | Last verse, not last page | Advance page; cursor = `pageStartIndex` of new page |
| `CursorMovedUp` | First verse, first page | Clamp — no-op |
| `CursorMovedUp` | First verse, not first page | Retreat page; cursor = last verse of retreated page |
| `PageAdvanced` | Last page | Clamp silently |
| `PageRetreated` | First page | Clamp silently |

---

## Keybind Map

| Key | Action dispatched | Notes |
|---|---|---|
| `↑` (`keyEvent.name === "up"`) | `CursorMovedUp` | New |
| `↓` (`keyEvent.name === "down"`) | `CursorMovedDown` | New |
| `[` | `PageRetreated` | Rebound — was `ChapterRetreated` in PR #10 |
| `]` | `PageAdvanced` | Rebound — was `ChapterAdvanced` in PR #10 |
| `n` | `ChapterAdvanced` | New keybind for existing action |
| `p` | `ChapterRetreated` | New keybind for existing action |
| `/` | `PaletteReopened` | Unchanged; bug fixed by `awaiting` gate |
| `q` / `Q` | quit | Unchanged; sits above `awaiting` gate |

---

## First Reviewable Cut

One PR, ~136 lines estimated:

| File | Lines |
|---|---|
| `reader-reducer.ts` | ~35 |
| `reader-reducer.test.ts` | ~60 |
| `reader-screen.tsx` | ~25 |
| `tui-driver.tsx` | ~15 |
| `welcome-screen.tsx` | ~1 |
| **Total** | **~136** |

---

## Success Criterion

End-to-end acceptance path:

1. `verbum` → welcome screen renders
2. Any key → reader screen, palette opens
3. Type `john 3`, Enter → spinner → page 1 shows verses 1–8 with `▶` on verse 1 (inverse styling)
4. `↓` × 4 → cursor advances to verse 5; `▶` marker and inverse move down accordingly
5. `]` → page 2 renders (verses 9–16); cursor lands on verse 9
6. `[` → back to page 1; cursor lands on verse 1
7. `n` → spinner → John 4 page 1 (cursor reset to index 0)
8. `p` → spinner → John 3 page 1 (cursor reset to index 0)
9. `/` → palette opens with empty query field, no interference from `awaiting` gate
10. `q` → exits cleanly from any state

---

## Risks

- **`TextAttributes.INVERSE` not yet used in codebase**: `ui-sketches.md` calls for it as the `selection` style, but only `TextAttributes.DIM` is referenced today. Must confirm `INVERSE` is exported from the installed `@opentui/core` version before implementing. Trivial import check at spec/design time.
- **Arrow key name verification**: `keyEvent.name === "up"` / `"down"` confirmed from `mock-keys.d.ts` and the runtime bundle. Worth re-verifying at impl against the actual running environment — OpenTUI's key names have been stable but this is the first time arrow keys are bound in this project.
- **`[` / `]` keybind rebind**: Any user muscle memory or documentation that references `[`/`]` as chapter nav (from PR #10) will be broken. The welcome hint line and `bottomTitleFor` are both updated, but external docs (README, etc.) are out of scope for this change.

---

## Out of Scope

- **Dynamic `VERSES_PER_PAGE`** from `process.stdout.rows` — future change.
- **Cross-chapter cursor flow** (advancing past the last verse of a page auto-triggers `ChapterAdvanced`) — future change; keeps page and chapter nav strictly separate for now.
- **Visual feedback on page-boundary clamp** — future change; silent clamp is sufficient for v1.
- **Verse range passages** (e.g. `john 3:14-18`) — the index-based state handles them correctly but no special UX is added.

---

## Next Steps (possible follow-ups)

- **Dynamic page size**: compute `VERSES_PER_PAGE` from `process.stdout.rows` minus chrome rows; requires polling or a resize event.
- **Cross-chapter cursor flow**: when `CursorMovedDown` hits the last verse of the last page, dispatch `ChapterAdvanced` instead of clamping.
- **Page indicator in bottom title**: e.g. `"page 1 / 4"` inline with the status bar.
