# Spec: tui-reader-screen

**Capability:** TUI Reader screen — interactive Bible passage reader with palette input, async fetch with cancellation, chapter navigation, and reactive boundary detection.

---

## Requirements

### REQ-1 — No-args routing to ReaderApp

`verbum` invoked with no arguments MUST mount `ReaderApp` (not `WelcomeScreen`). The `welcome-screen.tsx` and `welcome-reducer.ts` files remain on disk but are not mounted on the no-args path.

### REQ-2 — `tuiDriver` signature accepts a repository

`tuiDriver` MUST accept `repo: BibleRepository` as its sole parameter. `src/index.tsx` MUST construct a `BibleRepository` via `createHelloAoBibleRepository()` (mirroring `src/cli/run.ts`) and pass it to `tuiDriver(repo)`.

### REQ-3 — Palette overlay renders when `state.kind === "awaiting"`

When `ReaderState.kind === "awaiting"`, the screen MUST render the palette overlay: a centered input field containing the current `state.query`. The Reading view MUST NOT be visible in this state.

### REQ-4 — Palette input is focused on mount

On first render the palette input MUST receive focus automatically (`focused` prop set). The user does not press Tab or click to begin typing.

### REQ-5 — Parse error renders inline when `awaiting.parseError !== null`

When `state.kind === "awaiting"` and `state.parseError !== null`, the overlay MUST render a one-line inline message of the form `⚠ couldn't parse "<query>"` beneath the input. The overlay remains open; no modal is shown; the input stays focused.

### REQ-6 — Reading view renders when `state.kind === "loaded"`

When `state.kind === "loaded"`, the screen MUST render the Reading view frame: a header showing the current reference, the chapter verses, and a status-bar hint row (`[ prev  •  ] next  •  / palette  •  q quit`). The palette overlay MUST NOT be visible.

### REQ-7 — Braille spinner renders when `state.kind === "loading"`

When `state.kind === "loading"`, the screen MUST render a single-line spinner that cycles through `SPINNER_FRAMES` at approximately 10 fps (one tick per ~100 ms). The spinner MUST be driven by a `useState` frame index incremented via `setInterval` inside a `useEffect` (ephemeral UI state per Rule 8). The interval MUST be cleared on cleanup.

### REQ-8 — Network error renders when `state.kind === "network-error"`

When `state.kind === "network-error"`, the screen MUST render a one-line error message. When `state.reason.kind === "chapter_not_found"`, the message MUST include a "last chapter" hint. In all other `network-error` cases the message states the chapter could not be loaded.

### REQ-9 — `]` key advances chapter

When `state.kind === "loaded"` and the user presses `]`, `dispatch({ type: "ChapterAdvanced" })` MUST be called. The reducer MUST transition to `{ kind: "loading", ref: { ...state.ref, chapter: state.ref.chapter + 1 } }`. There is no upper-bound guard in the reducer — boundary detection is reactive (REQ-8 handles `chapter_not_found`).

### REQ-10 — `[` key retreats chapter (floor at 1)

When `state.kind === "loaded"` and the user presses `[`, `dispatch({ type: "ChapterRetreated" })` MUST be called. The reducer MUST transition to `{ kind: "loading", ref: { ...state.ref, chapter: state.ref.chapter - 1 } }`. When `state.ref.chapter === 1`, `ChapterRetreated` MUST be a no-op (state unchanged, chapter does not go below 1).

### REQ-11 — `/` key reopens palette

When `state.kind === "loaded"` or `state.kind === "network-error"` and the user presses `/`, `dispatch({ type: "PaletteReopened" })` MUST be called. The reducer MUST transition to `{ kind: "awaiting", query: "", parseError: null }`.

### REQ-12 — `q`/`Q` exits cleanly

`q` and `Q` key presses MUST trigger a clean process exit via the same `useKeyboard` path used by the welcome driver. This is driver-level handling — not a reducer action.

### REQ-13 — Stale fetch results are dropped via cancelled flag

When `state.kind` transitions away from `"loading"` before the in-flight `getPassage` resolves (e.g. the user reopens the palette and submits a new reference), the previous fetch callback MUST check `if (cancelled) return` before dispatching. The `useEffect` cleanup MUST set `cancelled = true`. Old results MUST NOT land in state.

### REQ-14 — "Last chapter" hint on `chapter_not_found` network error

When `state.kind === "network-error"` and `state.reason.kind === "chapter_not_found"`, the rendered error line MUST include a hint indicating the user has reached the last chapter of the book. This is a visual-only requirement — the reducer transition to `network-error` is identical regardless of reason kind.

### REQ-15 — `parseReference` accepts chapter-only input

`parseReference` MUST accept `<book-alias> <chapter>` (no colon-verse token). For a valid book alias and a valid positive integer chapter, it MUST return `{ ok: true, value: { book, chapter, verses: { start: 1, end: Number.MAX_SAFE_INTEGER } } }`. Existing callers using the `<book> <chapter>:<verse>` format MUST be unaffected.

### REQ-16 — `parseReference` rejects still-malformed input

When the input after the book token contains a non-integer or non-numeric string that is not a valid chapter (e.g. `3x`, `abc`, `3:x`), `parseReference` MUST return `{ ok: false, error: { kind: "malformed_chapter_verse", input: <token> } }`.

### REQ-17 — `reader-reducer` uses object-dispatch handler table with `satisfies`

The `reader-reducer.ts` module MUST define a `handlers` object that maps every `ReaderAction["type"]` to a handler function, constrained via the `satisfies { [K in ReaderAction["type"]]: (s: ReaderState, a: Extract<ReaderAction, { type: K }>) => ReaderState }` pattern (Rule 13). A `switch` statement MUST NOT be used for action dispatch.

### REQ-18 — `useEffect` calls `getPassage`, never the repository port directly

All `useEffect` calls that perform async data fetching MUST invoke `getPassage(repo, ref)`. Direct calls to `repo.getChapter(...)` inside a `useEffect` are forbidden (Rule 9 retirement convention / ADR 0010).

### REQ-19 — No new runtime dependencies

This change MUST NOT add any new entries under `dependencies` in `package.json`. `SPINNER_FRAMES` is imported from the existing `src/cli/loading.ts` module.

### REQ-20 — TypeScript compilation is clean

`bun run tsc --noEmit` MUST exit 0 after all changes are applied.

### REQ-21 — Test count meets target

`bun test` MUST pass all pre-existing tests (baseline ≥ 99) plus the new reducer and `parseReference` tests. Target total: 115–125 passing tests.

### REQ-22 — No useless comments in new files

New source files MUST NOT contain file-banner comments, section-divider comments, rule-citation footnotes, or comments that restate the adjacent line of code (Rule 14). Comments are permitted only for non-obvious invariants, workarounds, or constraints the type system cannot capture.

---

## State Machine Contract

```
State kinds:  awaiting | loading | loaded | network-error

awaiting  --QuerySubmitted (parse ok)-->  loading
awaiting  --QuerySubmitted (parse err)--> awaiting (parseError set)
awaiting  --QueryTyped-->                 awaiting (query updated, parseError cleared)
loading   --PassageFetched-->             loaded
loading   --FetchFailed-->                network-error
loaded    --ChapterAdvanced-->            loading (chapter + 1)
loaded    --ChapterRetreated (ch > 1)-->  loading (chapter - 1)
loaded    --ChapterRetreated (ch = 1)-->  loaded (no-op)
loaded    --PaletteReopened-->            awaiting (query = "", parseError = null)
network-error --PaletteReopened-->        awaiting (query = "", parseError = null)
```

Actions from non-matching states return state unchanged (identity guard).

---

## Acceptance Scenarios

### SCN-1 — Happy path: palette → fetch → read

**Given** `verbum` is launched with no arguments  
**When** the TUI mounts  
**Then** state is `{ kind: "awaiting", query: "", parseError: null }` and the palette input is focused

**When** the user types `john 3` and presses Enter  
**Then** state transitions to `{ kind: "loading", ref: { book: "JHN", chapter: 3, verses: { start: 1, end: Number.MAX_SAFE_INTEGER } } }` and the spinner is visible

**When** `getPassage` resolves successfully  
**Then** state transitions to `{ kind: "loaded", passage: <John 3 passage>, ref: <John 3 ref> }` and the Reading view shows John 3 verses

### SCN-2 — Chapter forward navigation

**Given** `state.kind === "loaded"` showing John 3  
**When** the user presses `]`  
**Then** state transitions to `{ kind: "loading", ref: { ..., chapter: 4 } }` and spinner is visible  
**When** fetch resolves  
**Then** `state.kind === "loaded"` and Reading view shows John 4

### SCN-3 — Chapter backward navigation

**Given** `state.kind === "loaded"` showing John 4  
**When** the user presses `[`  
**Then** state transitions to `{ kind: "loading", ref: { ..., chapter: 3 } }`  
**When** fetch resolves  
**Then** Reading view shows John 3

### SCN-4 — Chapter retreat at floor (chapter 1)

**Given** `state.kind === "loaded"` showing Genesis 1 (`chapter: 1`)  
**When** the user presses `[`  
**Then** state is unchanged — still `{ kind: "loaded", ..., ref: { chapter: 1 } }`  
**And** the reducer does NOT dispatch a loading transition

### SCN-5 — Palette reopen from loaded state

**Given** `state.kind === "loaded"`  
**When** the user presses `/`  
**Then** state transitions to `{ kind: "awaiting", query: "", parseError: null }` and the palette overlay appears with an empty focused input

### SCN-6 — Inline parse error in palette

**Given** `state.kind === "awaiting"`  
**When** the user types `jhn 3x` and presses Enter  
**Then** `parseReference("jhn 3x")` returns `{ ok: false, error: { kind: "malformed_chapter_verse", input: "3x" } }`  
**And** state transitions to `{ kind: "awaiting", query: "jhn 3x", parseError: { kind: "malformed_chapter_verse", input: "3x" } }`  
**And** the palette renders `⚠ couldn't parse "jhn 3x"` inline below the input  
**And** the input remains focused and the overlay stays open

### SCN-7 — Last chapter hint on chapter_not_found

**Given** `state.kind === "loading"` and the fetch returns `{ ok: false, error: { kind: "chapter_not_found" } }` (as `RepoError`)  
**When** `FetchFailed` is dispatched  
**Then** state is `{ kind: "network-error", ..., reason: { kind: "chapter_not_found" } }`  
**And** the rendered error line includes a "last chapter" hint

### SCN-8 — Stale fetch is silently dropped

**Given** `state.kind === "loading"` for ref A  
**When** the state transitions away from `"loading"` (e.g. user reopens palette before fetch A completes)  
**And** fetch A later resolves  
**Then** `dispatch` is NOT called for fetch A's result — `cancelled === true` prevents dispatch

### SCN-9 — `q` exits cleanly

**Given** any `state.kind`  
**When** the user presses `q` or `Q`  
**Then** the process exits with code 0

### SCN-10 — Full integration walkthrough

**Given** `verbum` launched with no arguments  
1. Palette input is focused → type `john 3` → Enter → spinner ticks → John 3 verses render
2. Press `]` → spinner ticks → John 4 renders
3. Press `[` → spinner ticks → John 3 renders
4. Press `/` → palette opens with empty focused input
5. Type `jhn 3x` → Enter → `⚠ couldn't parse "jhn 3x"` inline error appears; palette stays open
6. Press `q` → process exits cleanly

### SCN-11 — `parseReference` accepts chapter-only format

**Given** input `"john 3"` (no colon-verse token)  
**When** `parseReference("john 3")` is called  
**Then** returns `{ ok: true, value: { book: "JHN", chapter: 3, verses: { start: 1, end: Number.MAX_SAFE_INTEGER } } }`

### SCN-12 — `parseReference` rejects partial numeric + non-numeric

**Given** input `"jhn 3x"` (chapter token is `"3x"`)  
**When** `parseReference("jhn 3x")` is called  
**Then** returns `{ ok: false, error: { kind: "malformed_chapter_verse", input: "3x" } }`

### SCN-13 — `parseReference` existing verse format is unaffected (regression)

**Given** input `"john 3:16"`  
**When** `parseReference("john 3:16")` is called  
**Then** returns `{ ok: true, value: { book: "JHN", chapter: 3, verses: { start: 16, end: 16 } } }`

### SCN-14 — Reducer handler table exhaustiveness

**Given** the `handlers` object in `reader-reducer.ts`  
**Then** TypeScript MUST enforce at compile time that every variant of `ReaderAction["type"]` has a corresponding handler (via the `satisfies` constraint) — no `switch` statement is used

---

## Out of Scope

- Palette result list sections (References / Books / Commands)
- Scroll-by-verse navigation
- Book picker and translation picker overlays
- Static chapter-count map (boundary detection remains reactive)
- Welcome screen modifications
- Caching layer on the repository
- `SPINNER_FRAMES` interval value other than ~80–100 ms (exact value is an implementation detail)

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Zero new entries under `dependencies` in `package.json` |
| NFR-2 | `bun run tsc --noEmit` exits 0 |
| NFR-3 | `bun test` passes all pre-existing tests (≥ 99) plus new reducer and `parseReference` tests; target 115–125 total |
| NFR-4 | No useless comments in new files (Rule 14) |
| NFR-5 | `reader-reducer.ts` uses object-dispatch handler table with `satisfies` mapped type (Rule 13) |
| NFR-6 | All `useEffect` fetch calls invoke `getPassage(repo, ref)` — never `repo.getChapter(...)` directly (Rule 9 convention, ADR 0010) |
| NFR-7 | Estimated diff ≤ 400 lines total (one PR, within review budget) |
