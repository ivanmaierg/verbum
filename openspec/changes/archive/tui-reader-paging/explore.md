# Exploration: tui-reader-paging

## Current State

PR #10 (`tui-reader-screen`) shipped:

- `reader-reducer.ts` — state union: `awaiting | loading | loaded | network-error`. Current `loaded` shape: `{ kind: "loaded"; passage: Passage; ref: Reference }`.
- `reader-screen.tsx` — renders all passage verses in a single bordered frame, no cursor, no paging.
- `tui-driver.tsx` — `useKeyboard` binds `]`/`[` → `ChapterAdvanced`/`ChapterRetreated`, `/` → `PaletteReopened`. No guard against `awaiting` state (bug confirmed).
- `welcome-screen.tsx` — hint line: `"  any key to start  •  / palette  •  ] next ch  •  [ prev ch  •  q quit"`

The change required is a UX extension: verse cursor navigation + chapter paging within the reader, plus a keybind reshuffle and a driver-level state gate fix.

## Arrow Key Name Discovery

From `node_modules/@opentui/core/testing/mock-keys.d.ts`:

- `ARROW_UP` → escape sequence `\x1B[A`
- `ARROW_DOWN` → escape sequence `\x1B[B`
- `pressArrow(direction: "up" | "down" | "left" | "right")` — confirms the `keyEvent.name` strings.

**Confirmed**: `keyEvent.name === "up"` and `keyEvent.name === "down"`.

## Affected Areas

- `src/tui/reader/reader-reducer.ts` — extend `loaded` variant, add 4 new actions
- `src/tui/reader/reader-reducer.test.ts` — add tests for all new transitions
- `src/tui/reader/reader-screen.tsx` — filter verses to current page, add `▶` cursor gutter marker, update `bottomTitleFor`
- `src/tui/tui-driver.tsx` — rebind `[`/`]` to page nav, add `n`/`p` for chapter nav, gate reader keybinds, add arrow handlers
- `src/tui/welcome/welcome-screen.tsx` — update hint line with new keybind scheme

## State Machine Extensions

### New `loaded` variant

```ts
| {
    kind: "loaded";
    passage: Passage;
    ref: Reference;
    cursorIndex: number;     // 0-based array index of focused verse in passage.verses
    pageStartIndex: number;  // 0-based array index of first verse on current page
  }
```

**Index-based, NOT verse-number-based** — passage.verses verse numbers are not guaranteed contiguous (a passage starting at John 3:14 has verses[0].number === 14). Index-based state keeps page arithmetic correct on any passage slice.

`loading` and `network-error` variants are UNCHANGED — no cursor carry-over needed.

### New actions

```ts
| { type: "CursorMovedUp" }
| { type: "CursorMovedDown" }
| { type: "PageAdvanced" }
| { type: "PageRetreated" }
```

Existing `ChapterAdvanced` / `ChapterRetreated` keep their names and reducer logic — only their driver-level keybind changes from `]`/`[` to `n`/`p`.

### `PassageFetched` handler update

Set `cursorIndex: 0, pageStartIndex: 0`. Applies for both initial fetch and chapter-transition fetches.

## Page Boundaries Logic

```ts
export const VERSES_PER_PAGE = 8;
```

Rationale: 8 fits comfortably in a 20-row minimum terminal. Dynamic computation from terminal height is a future optimization.

**Page slice:** `verses.slice(pageStartIndex, pageStartIndex + VERSES_PER_PAGE)`

- `PageAdvanced` at last page: **clamp** silently — no wrap, no chapter cascade.
- `PageRetreated` at first page: **clamp** silently.
- `CursorMovedDown` at last verse on current page: advance to next page, cursor on first verse of new page. At last verse of last page: clamp.
- `CursorMovedUp` at first verse on current page: retreat to previous page, cursor on last verse of previous page. At first verse of first page: clamp.

## Reducer Handler Sketches

All handlers no-op when `s.kind !== "loaded"`.

```ts
CursorMovedDown: (s, _a) => {
  if (s.kind !== "loaded") return s;
  const total = s.passage.verses.length;
  const pageEnd = Math.min(s.pageStartIndex + VERSES_PER_PAGE - 1, total - 1);
  if (s.cursorIndex < pageEnd) {
    return { ...s, cursorIndex: s.cursorIndex + 1 };
  }
  const nextPageStart = s.pageStartIndex + VERSES_PER_PAGE;
  if (nextPageStart >= total) return s; // clamp at last page
  return { ...s, pageStartIndex: nextPageStart, cursorIndex: nextPageStart };
},

CursorMovedUp: (s, _a) => {
  if (s.kind !== "loaded") return s;
  if (s.cursorIndex > s.pageStartIndex) {
    return { ...s, cursorIndex: s.cursorIndex - 1 };
  }
  const prevPageStart = s.pageStartIndex - VERSES_PER_PAGE;
  if (prevPageStart < 0) return s; // clamp at first page
  const prevPageEnd = Math.min(prevPageStart + VERSES_PER_PAGE - 1, s.passage.verses.length - 1);
  return { ...s, pageStartIndex: prevPageStart, cursorIndex: prevPageEnd };
},

PageAdvanced: (s, _a) => {
  if (s.kind !== "loaded") return s;
  const nextPageStart = s.pageStartIndex + VERSES_PER_PAGE;
  if (nextPageStart >= s.passage.verses.length) return s;
  return { ...s, pageStartIndex: nextPageStart, cursorIndex: nextPageStart };
},

PageRetreated: (s, _a) => {
  if (s.kind !== "loaded") return s;
  const prevPageStart = s.pageStartIndex - VERSES_PER_PAGE;
  if (prevPageStart < 0) return s;
  return { ...s, pageStartIndex: prevPageStart, cursorIndex: prevPageStart };
},
```

## View Changes

```tsx
const pageVerses = state.passage.verses.slice(
  state.pageStartIndex,
  state.pageStartIndex + VERSES_PER_PAGE,
);

{pageVerses.map((v, i) => {
  const verseIndex = state.pageStartIndex + i;
  const isFocused = verseIndex === state.cursorIndex;
  return (
    <text key={v.number}>
      <span fg={isFocused ? ACCENT_HEX : undefined}>
        {isFocused ? "▶ " : "  "}
      </span>
      <span attributes={DIM}>{`${String(v.number).padStart(3)}  `}</span>
      <span attributes={isFocused ? TextAttributes.INVERSE : undefined}>
        {v.text}
      </span>
    </text>
  );
})}
```

Per `ui-sketches.md` Typography: focused verse uses `▶` marker (in accent color) + `selection` (`TextAttributes.INVERSE`) on the line.

**`bottomTitleFor` for loaded state:**
```ts
" ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit "
```

## Driver-Level Keybind Changes

```ts
useKeyboard((keyEvent) => {
  if (keyEvent.name === "q" || keyEvent.name === "Q") {
    renderer.destroy(); resolve(); return;
  }
  if (phase === "welcome") {
    setPhase("reader"); return;
  }
  if (readerState.kind === "awaiting") return;

  if (keyEvent.name === "up")   { dispatch({ type: "CursorMovedUp" }); return; }
  if (keyEvent.name === "down") { dispatch({ type: "CursorMovedDown" }); return; }
  if (keyEvent.name === "[")    { dispatch({ type: "PageRetreated" }); return; }
  if (keyEvent.name === "]")    { dispatch({ type: "PageAdvanced" }); return; }
  if (keyEvent.name === "n")    { dispatch({ type: "ChapterAdvanced" }); return; }
  if (keyEvent.name === "p")    { dispatch({ type: "ChapterRetreated" }); return; }
  if (keyEvent.name === "/")    { dispatch({ type: "PaletteReopened" }); return; }
});
```

The existing palette-key conflict (`/` clearing query while input focused) is fixed by the `awaiting`-state gate. `q`/`Q` sits above the guard — quit always works.

## Welcome Screen Hint Update

```ts
"  any key to start  •  ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit"
```

## Slicing Recommendation

**One PR.** Estimate:

| File | Lines changed |
|---|---|
| `reader-reducer.ts` | ~35 |
| `reader-reducer.test.ts` | ~60 |
| `reader-screen.tsx` | ~25 |
| `tui-driver.tsx` | ~15 |
| `welcome-screen.tsx` | ~1 |
| **Total** | **~136 lines** |

Well under the 400-line review budget.

## Approaches

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **A — One PR (recommended)** | Single coherent UX change; under budget; reducer + view ship together | None significant | Low |
| B — Split: reducer PR then view PR | Smaller diffs | No observable UX until view lands; artificial split | Medium overhead |
| C — Dynamic page size from terminal rows | Adaptive UX | More complex; deferred to future change | Medium |

**Recommendation: Approach A** with `VERSES_PER_PAGE = 8` constant, index-based state.

## Risks

- **Index vs. verse-number state** — verse numbers in `passage.verses` are not guaranteed contiguous (a passage starting at John 3:14 has `verses[0].number === 14`). Page arithmetic must use array indices, not verse numbers. Locked: index-based.
- **`useKeyboard` always fires** — the `awaiting`-state gate suppresses keybinds while `<input>` is focused. The guard must sit BELOW the `q`/`Q` check so quit always works.
- **`TextAttributes.INVERSE`** — confirm exported from `@opentui/core` (only `DIM` used in codebase today). Trivial check at impl time.

## Open Questions for Proposal

1. **Index-based vs verse-number-based state** — **LOCKED: index-based.** Verse numbers aren't contiguous in passage slices.
2. **`▶` marker color** — **LOCKED: ACCENT_HEX.** Per `ui-sketches.md` Typography table.
3. **`PageAdvanced` at last page behavior** — **LOCKED: silent clamp.** No visual feedback, no chapter cascade.

## Ready for Proposal

Yes. All decisions resolved with defensible defaults.
