# Tasks: tui-reader-screen

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~330 (per design.md) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain (cached YOLO mode) |
| Decision needed before apply | No |

---

## C1 — feat(domain): parseReference accepts chapter-only refs

**Files:** `src/domain/reference.ts`, `src/domain/reference.test.ts`

- [x] T1.1 **RED** `src/domain/reference.test.ts` — Append 5 failing tests for chapter-only parsing after the existing `describe` block's last test: `"john 3"` → whole-chapter ref, `"john 3 "` (trailing space), `"JOHN 3"` case-insensitive, `"jhn 3x"` → `malformed_chapter_verse`, `"john 0"` → `malformed_chapter_verse`. Run `bun test src/domain/reference.test.ts` — expect **5 failures**.
  _Satisfies: REQ-15, REQ-16, SCN-11, SCN-12, SCN-13_

- [x] T1.2 **GREEN** `src/domain/reference.ts` — Add `colonIdx === -1` branch before the colon-verse path: parse `rest` as an integer, validate `chapter >= 1` and exact string match, return `{ ok: true, value: { book, chapter, verses: { start: 1, end: Number.MAX_SAFE_INTEGER } } }`. Also update the file-level format comment (line ~161) from `"no whole-chapter (D4)"` to `"<book> <chapter> or <book> <chapter>:<verse>"`. Run `bun test src/domain/reference.test.ts` — expect **all pass** including regression suite.
  _Satisfies: REQ-15, REQ-16, SCN-11, SCN-12, SCN-13_

---

## C2 — feat(tui): reader reducer + async passage fetch hook

**Files:** `src/tui/reader/reader-reducer.ts`, `src/tui/reader/reader-reducer.test.ts`, `src/tui/reader/use-passage-fetch.ts`

- [x] T2.1 **RED** `src/tui/reader/reader-reducer.test.ts` — Create file with full test suite as specified in design.md §4: `describe("readerReducer")` covering initial state, QueryTyped, QuerySubmitted, PassageFetched, FetchFailed, ChapterAdvanced, ChapterRetreated, and PaletteReopened — 22 tests total. Run `bun test src/tui/reader/reader-reducer.test.ts` — expect **import-or-module failure** (file not found).
  _Satisfies: REQ-9, REQ-10, REQ-11, REQ-17, SCN-1–8, SCN-14_

- [x] T2.2 **GREEN** `src/tui/reader/reader-reducer.ts` — Create file with `ReaderState` union type, `ReaderAction` union type, `handlers` object constrained via `satisfies { [K in ReaderAction["type"]]: ... }` (no switch), `readerReducer` function, and `initialReaderState` export — exact content from design.md §3. Run `bun test src/tui/reader/reader-reducer.test.ts` — expect **all 22 tests pass**.
  _Satisfies: REQ-9, REQ-10, REQ-11, REQ-17, SCN-1–8, SCN-14_

- [x] T2.3 **IMPL** `src/tui/reader/use-passage-fetch.ts` — Create file with `usePassageFetch(state, dispatch, repo)` hook: `useEffect` guarded by `state.kind === "loading"`, `cancelled` flag, calls `getPassage(repo, ref)`, dispatches `PassageFetched` or `FetchFailed`, narrows `AppError` via `isRepoError`, deps array `[state.kind, state.kind === "loading" ? state.ref.book : null, state.kind === "loading" ? state.ref.chapter : null]`. No automated test (PTY hook). Run `bun run tsc --noEmit` — expect **0 errors**.
  _Satisfies: REQ-13, REQ-18, SCN-8_

---

## C3 — feat(tui): reader screen replaces welcome on no-args

**Files:** `src/tui/reader/reader-screen.tsx`, `src/tui/tui-driver.tsx`, `src/index.tsx`

- [x] T3.1 **IMPL** `src/tui/reader/reader-screen.tsx` — Create file with `ReaderScreen({ state, dispatch, repo })` component: calls `usePassageFetch`, spinner `useEffect` (80ms interval, `SPINNER_FRAMES` from `@/cli/loading`), renders four branches — `awaiting` (palette overlay with focused `<input>`, inline parse error when `state.parseError !== null`), `loading` (single-line spinner), `network-error` (last-chapter hint when `reason.kind === "chapter_not_found"`), `loaded` (header + verses + status-bar hint). No automated test (PTY-only render). Run `bun run tsc --noEmit` — expect **0 errors**.
  _Satisfies: REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-14, SCN-1, SCN-6, SCN-7_

- [x] T3.2 **IMPL** `src/tui/tui-driver.tsx` — Replace `welcomeReducer`/`WelcomeScreen` imports with `readerReducer`/`initialReaderState`/`ReaderScreen`; rename `App` component to `ReaderApp` and add `repo: BibleRepository` prop; add `]/[//` keyboard handlers dispatching `ChapterAdvanced`/`ChapterRetreated`/`PaletteReopened`; update `tuiDriver` signature from `(): Promise<void>` to `(repo: BibleRepository): Promise<void>` and pass `repo` to `ReaderApp`. TTY/size guards and renderer/SIGINT plumbing unchanged. Run `bun run tsc --noEmit` — expect **0 errors**.
  _Satisfies: REQ-1, REQ-2, REQ-9, REQ-10, REQ-11, REQ-12, SCN-2, SCN-3, SCN-4, SCN-5, SCN-9_

- [x] T3.3 **IMPL** `src/index.tsx` — Add `import { createHelloAoBibleRepository } from "@/api/hello-ao-bible-repository"`, construct `const repo = createHelloAoBibleRepository()` inside the `argv.length === 0` branch, change `tuiDriver()` to `tuiDriver(repo)`. Run `bun run tsc --noEmit` — expect **0 errors**.
  _Satisfies: REQ-2, SCN-10_

- [x] T3.4 **VERIFY** Run `bun test` — expect all pre-existing tests (≥99) plus new reducer tests (22) plus chapter-only `parseReference` tests (5) to pass; target total 115–125. Run `bun run tsc --noEmit` — expect **exit 0**.
  _Satisfies: REQ-20, REQ-21, NFR-2, NFR-3_

---

## Task Summary

| Commit | Tasks | RED/GREEN/IMPL | Key files |
|--------|-------|----------------|-----------|
| C1 | T1.1–T1.2 | 1 RED + 1 GREEN | `reference.ts`, `reference.test.ts` |
| C2 | T2.1–T2.3 | 1 RED + 1 GREEN + 1 IMPL | `reader-reducer.ts`, `reader-reducer.test.ts`, `use-passage-fetch.ts` |
| C3 | T3.1–T3.4 | 3 IMPL + 1 VERIFY | `reader-screen.tsx`, `tui-driver.tsx`, `index.tsx` |
| **Total** | **9** | | |

All 9 tasks are strictly sequential within each commit. C1 → C2 → C3 ordering is required (reducer imports `parseReference`; screen imports reducer and hook; driver imports screen).
