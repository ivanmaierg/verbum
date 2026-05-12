# Spec: tui-reader-paging

## 1. Capability

TUI Reader paging + verse cursor — extends the `loaded` state with index-based cursor and pageStart, adds 4 new actions, and rebinds chapter navigation keys.

---

## 2. Requirements

### State Shape

**REQ-1** — The `loaded` state variant MUST include two new fields:
- `cursorIndex: number` — 0-based array index of the focused verse in `passage.verses`
- `pageStartIndex: number` — 0-based array index of the first verse on the current page

**REQ-2** — The `loading`, `awaiting`, and `network-error` state variants MUST NOT include `cursorIndex` or `pageStartIndex`.

### Constant

**REQ-3** — `VERSES_PER_PAGE` MUST be exported as a named constant from `reader-reducer.ts` with value `8`.

### PassageFetched Handler

**REQ-4** — The `PassageFetched` handler MUST initialize `cursorIndex: 0` and `pageStartIndex: 0` when transitioning from `loading` to `loaded`. This applies for both initial fetch and chapter-transition fetches.

**REQ-5** — The `PassageFetched` handler MUST remain a no-op when `state.kind !== "loading"`.

### New Actions — General

**REQ-6** — Four new action types MUST be added to the reducer action union:
- `{ type: "CursorMovedUp" }`
- `{ type: "CursorMovedDown" }`
- `{ type: "PageAdvanced" }`
- `{ type: "PageRetreated" }`

**REQ-7** — All four new action handlers MUST be no-ops (return state unchanged) when `state.kind !== "loaded"`.

**REQ-8** — All four new action handlers MUST follow the Rule 13 object-dispatch pattern (handler map, not switch/if chains).

### CursorMovedDown

**REQ-9** — `CursorMovedDown` MUST increment `cursorIndex` by 1 when the cursor is not on the last verse of the current page and not on the last verse of the passage.

**REQ-10** — `CursorMovedDown` at the last verse of the current page (but NOT the last page) MUST advance to the next page: set `pageStartIndex` to `pageStartIndex + VERSES_PER_PAGE` and set `cursorIndex` to the new `pageStartIndex` (first verse of the new page).

**REQ-11** — `CursorMovedDown` at the last verse of the last page MUST clamp silently — state MUST remain unchanged.

### CursorMovedUp

**REQ-12** — `CursorMovedUp` MUST decrement `cursorIndex` by 1 when the cursor is not on the first verse of the current page.

**REQ-13** — `CursorMovedUp` at the first verse of the current page (but NOT the first page) MUST retreat to the previous page: set `pageStartIndex` to `pageStartIndex - VERSES_PER_PAGE` and set `cursorIndex` to the last verse of the retreated page (i.e., `min(pageStartIndex - 1, verses.length - 1)` using the new pageStartIndex).

**REQ-14** — `CursorMovedUp` at the first verse of the first page (`cursorIndex === 0`) MUST clamp silently — state MUST remain unchanged.

### PageAdvanced

**REQ-15** — `PageAdvanced` MUST set `pageStartIndex` to `pageStartIndex + VERSES_PER_PAGE` and set `cursorIndex` to the new `pageStartIndex`, when a next page exists.

**REQ-16** — `PageAdvanced` at the last page MUST clamp silently — state MUST remain unchanged.

### PageRetreated

**REQ-17** — `PageRetreated` MUST set `pageStartIndex` to `pageStartIndex - VERSES_PER_PAGE` (minimum 0) and set `cursorIndex` to the new `pageStartIndex`, when a previous page exists.

**REQ-18** — `PageRetreated` at the first page (`pageStartIndex === 0`) MUST clamp silently — state MUST remain unchanged.

### Existing Actions

**REQ-19** — `ChapterAdvanced` and `ChapterRetreated` reducer logic MUST remain unchanged. No `cursorIndex` or `pageStartIndex` fields are relevant to these handlers — their effect (triggering a new `loading` state) is unchanged; `PassageFetched` resets cursor/page on the subsequent `loaded` transition.

### Driver — Awaiting Gate

**REQ-20** — `tui-driver.tsx` `useKeyboard` MUST gate ALL reader-only keybinds behind `readerState.kind !== "awaiting"`. This gate MUST be placed AFTER the `q`/`Q` quit check so quit always works regardless of reader state.

**REQ-21** — With the gate in REQ-20, pressing `/` while the palette `<input>` is focused (state is `awaiting`) MUST NOT dispatch `PaletteReopened`. This fixes the existing confirmed bug.

### Driver — Keybind Map

**REQ-22** — The `useKeyboard` handler in `tui-driver.tsx` MUST dispatch according to the following table (all bindings active only after the awaiting gate):

| Key | Action dispatched | Notes |
|-----|-------------------|-------|
| `↑` (`keyEvent.name === "up"`) | `CursorMovedUp` | New |
| `↓` (`keyEvent.name === "down"`) | `CursorMovedDown` | New |
| `[` | `PageRetreated` | Rebound from `ChapterRetreated` |
| `]` | `PageAdvanced` | Rebound from `ChapterAdvanced` |
| `n` | `ChapterAdvanced` | New keybind for existing action |
| `p` | `ChapterRetreated` | New keybind for existing action |
| `/` | `PaletteReopened` | Unchanged; bug fixed by awaiting gate |
| `q`/`Q` | quit | Unchanged; above awaiting gate |

### Reader Screen — Page Slice

**REQ-23** — `reader-screen.tsx` loaded branch MUST render only the verses in the current page by slicing: `passage.verses.slice(pageStartIndex, pageStartIndex + VERSES_PER_PAGE)`.

### Reader Screen — Cursor Rendering

**REQ-24** — The verse at `cursorIndex` MUST render a `▶` character in the gutter with foreground color `ACCENT_HEX`. All other verses MUST render a space in the gutter.

**REQ-25** — The verse text at `cursorIndex` MUST be rendered with `TextAttributes.INVERSE`. All other verse texts MUST be rendered without `INVERSE`.

### Reader Screen — Bottom Title

**REQ-26** — `bottomTitleFor` for the `loaded` state MUST return exactly:
```
" ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit "
```

### Welcome Screen — Hint Line

**REQ-27** — `welcome-screen.tsx` hint line MUST read exactly:
```
"  any key to start  •  ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit"
```

---

## 3. Acceptance Scenarios

### REQ-1/REQ-2 — Loaded state shape

**Given** a `loading` state and a `PassageFetched` action  
**When** the reducer processes `PassageFetched`  
**Then** the resulting state has `kind: "loaded"`, `cursorIndex: 0`, and `pageStartIndex: 0`; neither `loading` nor `network-error` states carry these fields.

### REQ-3 — VERSES_PER_PAGE

**Given** the `reader-reducer` module  
**When** it is imported  
**Then** `VERSES_PER_PAGE` is a named export equal to `8`.

### REQ-4/REQ-5 — PassageFetched initializes cursor/page

**Given** a `loading` state  
**When** `PassageFetched` is dispatched with any valid passage  
**Then** state becomes `loaded` with `cursorIndex: 0` and `pageStartIndex: 0`.

**Given** a `loaded` state  
**When** `PassageFetched` is dispatched  
**Then** state is returned unchanged.

### REQ-7 — New actions are no-ops outside loaded

**Given** an `awaiting`, `loading`, or `network-error` state  
**When** any of `CursorMovedUp`, `CursorMovedDown`, `PageAdvanced`, `PageRetreated` is dispatched  
**Then** state is returned unchanged.

### REQ-9 — CursorMovedDown within page

**Given** a `loaded` state with 10 verses, `cursorIndex: 0`, `pageStartIndex: 0`  
**When** `CursorMovedDown` is dispatched  
**Then** `cursorIndex` becomes `1`; `pageStartIndex` remains `0`.

### REQ-10 — CursorMovedDown crosses page boundary

**Given** a `loaded` state with 16 verses, `cursorIndex: 7`, `pageStartIndex: 0`  
**When** `CursorMovedDown` is dispatched  
**Then** `pageStartIndex` becomes `8` and `cursorIndex` becomes `8`.

### REQ-11 — CursorMovedDown clamps at last verse of last page

**Given** a `loaded` state with 10 verses, `cursorIndex: 9`, `pageStartIndex: 8`  
**When** `CursorMovedDown` is dispatched  
**Then** state is unchanged (`cursorIndex` stays `9`, `pageStartIndex` stays `8`).

### REQ-12 — CursorMovedUp within page

**Given** a `loaded` state, `cursorIndex: 3`, `pageStartIndex: 0`  
**When** `CursorMovedUp` is dispatched  
**Then** `cursorIndex` becomes `2`; `pageStartIndex` remains `0`.

### REQ-13 — CursorMovedUp crosses page boundary

**Given** a `loaded` state with 16 verses, `cursorIndex: 8`, `pageStartIndex: 8`  
**When** `CursorMovedUp` is dispatched  
**Then** `pageStartIndex` becomes `0` and `cursorIndex` becomes `7` (last verse of the retreated page).

### REQ-14 — CursorMovedUp clamps at first verse of first page

**Given** a `loaded` state, `cursorIndex: 0`, `pageStartIndex: 0`  
**When** `CursorMovedUp` is dispatched  
**Then** state is unchanged.

### REQ-15 — PageAdvanced moves to next page

**Given** a `loaded` state with 16 verses, `pageStartIndex: 0`, `cursorIndex: 3`  
**When** `PageAdvanced` is dispatched  
**Then** `pageStartIndex` becomes `8` and `cursorIndex` becomes `8`.

### REQ-16 — PageAdvanced clamps at last page

**Given** a `loaded` state with 10 verses, `pageStartIndex: 8`, `cursorIndex: 9`  
**When** `PageAdvanced` is dispatched  
**Then** state is unchanged.

### REQ-17 — PageRetreated moves to previous page

**Given** a `loaded` state, `pageStartIndex: 8`, `cursorIndex: 10`  
**When** `PageRetreated` is dispatched  
**Then** `pageStartIndex` becomes `0` and `cursorIndex` becomes `0`.

### REQ-18 — PageRetreated clamps at first page

**Given** a `loaded` state, `pageStartIndex: 0`, `cursorIndex: 2`  
**When** `PageRetreated` is dispatched  
**Then** state is unchanged.

### REQ-19 — ChapterAdvanced/Retreated unchanged

**Given** a `loaded` state  
**When** `ChapterAdvanced` is dispatched  
**Then** state transitions to `loading` (unchanged from existing behavior); no cursor fields appear on the loading state.

### REQ-20/REQ-21 — Awaiting gate fixes palette bug

**Given** the reader is in `awaiting` state (palette `<input>` focused)  
**When** the user presses `/`  
**Then** `PaletteReopened` is NOT dispatched.

**Given** the reader is in `awaiting` state  
**When** the user presses `q`  
**Then** the app quits (quit check is above the gate).

### REQ-22 — Keybind map dispatches correct actions

**Given** the reader is in `loaded` state  
**When** the user presses `↑` / `↓` / `[` / `]` / `n` / `p` / `/`  
**Then** `CursorMovedUp` / `CursorMovedDown` / `PageRetreated` / `PageAdvanced` / `ChapterAdvanced` / `ChapterRetreated` / `PaletteReopened` are dispatched respectively.

### REQ-23 — Reader renders current page slice

**Given** a passage with 16 verses in `loaded` state, `pageStartIndex: 8`  
**When** `reader-screen` renders  
**Then** only verses at indices 8–15 are rendered; verses 0–7 are not present in the output.

### REQ-24/REQ-25 — Cursor marker and inverse on focused verse

**Given** a `loaded` state with `cursorIndex: 2`  
**When** `reader-screen` renders  
**Then** the verse at index 2 shows `▶` in `ACCENT_HEX` in the gutter and its text has `TextAttributes.INVERSE`; all other verses show a space in the gutter with no `INVERSE`.

### REQ-26 — Bottom title for loaded state

**Given** a `loaded` state  
**When** `bottomTitleFor` is called  
**Then** it returns `" ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit "`.

### REQ-27 — Welcome screen hint line

**Given** the welcome screen  
**When** it renders  
**Then** the hint line reads `"  any key to start  •  ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit"`.

### Integration Scenario (from proposal Success Criterion)

**Given** a loaded passage of 20 verses  
**When** the user presses `↓` eight times, then `]` once, then `↑` once  
**Then** the reader shows verses 9–16 with the cursor on verse 15 (0-based index 15 — last verse of page 2 after one `↑` from the top of page 3).

---

## 4. Out of Scope

- Dynamic `VERSES_PER_PAGE` derived from terminal row count
- Cross-chapter cursor flow (e.g. `CursorMovedDown` at last verse of last chapter triggers `ChapterAdvanced`)
- Visual / audible feedback on boundary clamp (silent clamp is the specified behavior)

---

## 5. Non-Functional Requirements

**NFR-1** — No new runtime dependencies. All new behavior MUST use packages already present in `package.json`.

**NFR-2** — `bun run tsc --noEmit` MUST exit 0 after all changes are applied.

**NFR-3** — Existing test suite (127 tests) MUST continue to pass. New tests for cursor and paging actions MUST bring the total to approximately 145–155 tests.

**NFR-4** — All new reducer action handlers MUST follow the Rule 13 object-dispatch pattern (handler map, no switch or if-chain).

**NFR-5** — Rule 14: no useless comments in any new or modified code. Comments MUST only appear where they communicate non-obvious intent.
