# Exploration: tui-reader-screen

## Current State

`src/index.tsx` routes `argv.length === 0` to `tuiDriver()`. The driver boots a React app with `useReducer(welcomeReducer, initialWelcomeState)` + a `useKeyboard` handler that quits on `q`/`Q` and passes everything else to the reducer. `WelcomeScreen` is a pure view-props component — no hooks, no effects. The reducer itself is trivially a no-op for all keys (quit is handled in the driver, not the reducer). The welcome screen currently renders the wordmark + open-book ASCII art and exits on `q`.

There is no Reader view, no palette, no async fetch in the TUI layer.

## Affected Areas

- `src/index.tsx` — routing: `verbum` no-args currently → welcome. Must route to reader instead (welcome retired for no-args path).
- `src/tui/tui-driver.tsx` — must accept `repo: BibleRepository` and mount `ReaderApp` instead of current `App`.
- `src/tui/welcome/welcome-screen.tsx` — read for chrome patterns; NOT modified.
- `src/tui/welcome/welcome-reducer.ts` — read as Rule 13 canonical example; NOT modified.
- `src/application/get-passage.ts` — the use case `useEffect` must call; read-only.
- `src/application/ports/bible-repository.ts` — port for `getChapter`; read-only.
- `src/domain/reference.ts` — `parseReference` used in palette query submission.
- `src/domain/errors.ts` — `ParseError`, `RepoError`, `AppError` for state branches.
- `src/domain/passage.ts` — `Passage`, `Chapter`, `Verse` types for loaded state.
- `src/cli/loading.ts` — `SPINNER_FRAMES` array reused in TUI loading state via React `useEffect + setInterval`.
- `src/presentation/colors.ts` — `ACCENT_HEX` for reference header styling.

New files:

- `src/tui/reader/reader-reducer.ts`
- `src/tui/reader/reader-reducer.test.ts`
- `src/tui/reader/reader-screen.tsx`
- `src/tui/reader/use-passage-fetch.ts` (optional extraction)

## Architecture Decisions

### 1. Welcome vs reader on `verbum` no-args

Reader REPLACES welcome for the `verbum` no-args path. The intake intent is explicit: "TUI boots a welcome and exits — the hex architecture's TUI seam is unverified. This slice makes verbum a real reader." Welcome served its purpose as skeleton scaffolding. The reader is the product. No flag needed.

### 2. State machine

```ts
type ReaderState =
  | { kind: "awaiting"; query: string; parseError: ParseError | null }
  | { kind: "loading"; ref: Reference }
  | { kind: "loaded"; passage: Passage; ref: Reference }
  | { kind: "network-error"; ref: Reference; reason: RepoError };
```

Actions:

```ts
type ReaderAction =
  | { type: "QueryTyped"; query: string }
  | { type: "QuerySubmitted" }
  | { type: "PassageFetched"; passage: Passage }
  | { type: "FetchFailed"; ref: Reference; reason: RepoError }
  | { type: "ChapterAdvanced" }
  | { type: "ChapterRetreated" }
  | { type: "PaletteReopened" };
```

Key transitions:

- `QuerySubmitted` from `awaiting`: parse query → if error → stay `awaiting` with `parseError`; if ok → `loading`
- `PassageFetched` from `loading` → `loaded`
- `FetchFailed` from `loading` → `network-error`
- `ChapterAdvanced` / `ChapterRetreated` from `loaded` → `loading` (with incremented/decremented `ref.chapter`; boundary = reactive: try fetch, if `chapter_not_found` show hint and stay)
- `PaletteReopened` from `loaded` or `network-error` → `awaiting` with last query cleared

Handler table per Rule 13 (`satisfies { [K in ReaderAction["type"]]: ... }`).

### 3. Async fetch pattern

`useEffect` fires when `state.kind === "loading"`. Cancellation via `cancelled` flag (not `AbortController` — `getPassage` doesn't take `AbortSignal`).

```ts
useEffect(() => {
  if (state.kind !== "loading") return;
  let cancelled = false;
  getPassage(repo, state.ref).then((result) => {
    if (cancelled) return;
    if (result.ok) dispatch({ type: "PassageFetched", passage: result.value });
    else dispatch({ type: "FetchFailed", ref: state.ref, reason: result.error as RepoError });
  });
  return () => { cancelled = true; };
}, [state.kind, state.kind === "loading" ? state.ref : null]);
```

`repo` flows from `tuiDriver(repo)` → `<ReaderApp repo={repo}>` → passed to the hook.

### 4. Chapter navigation at boundaries

No `nextChapter` / `prevChapter` helper exists in the domain. Compute in the reducer — just `ref.chapter + 1` / `ref.chapter - 1`. Boundary detection is REACTIVE: attempt the fetch; if `chapter_not_found` comes back, display a one-line hint (`⚠ last chapter`) and stay on the current passage. This avoids needing a static chapter-count map or a separate use case. No domain helper needed for PR 1.

### 5. Loading spinner in TUI

`withLoading` from `src/cli/loading.ts` uses `process.stderr.write` — incompatible with the OpenTUI React render tree. Reuse only `SPINNER_FRAMES` (the const array, already exported). A local `useEffect + setInterval` inside `reader-screen.tsx` (or the loading state branch) ticks a frame index held in `useState` (ephemeral UI state — Rule 8 explicitly allows it).

### 6. `<input>` primitive

`InputProps` in `@opentui/react` exposes `focused?: boolean`, `onInput`, `onChange`, `onSubmit`. This is the palette input surface — `onSubmit` dispatches `QuerySubmitted`, `onChange` dispatches `QueryTyped`. No `useKeyboard` gymnastics needed for the text entry path. `useKeyboard` still handles `]` / `[` chapter nav, `/` palette reopen, and `q` quit in the driver.

### 7. Palette scope for PR 1

PR 1 ships only: input field (query string) + parse-error inline hint + loading spinner + Reading view frame (verses). OUT: References / Books / Commands sections in the palette result list, scroll-by-verse, book pickers. The palette is a simple single-input overlay with no result list.

### 8. Slicing — one PR or chain?

One PR. The `ts-native-architecture` change eliminated the effect-runner PR that was previously required. The reader is:

- 1 reducer + tests (~80 lines)
- 1 screen component (~120 lines)
- 1 optional fetch hook (~30 lines)
- driver update (~20 lines)

Estimated: ~250–300 lines changed. Well under the 400-line review budget. Ship as one PR.

## File Layout

```
src/
  tui/
    reader/
      reader-reducer.ts          ← state machine, pure
      reader-reducer.test.ts     ← unit tests for all transitions
      reader-screen.tsx          ← view: palette overlay + reading frame
      use-passage-fetch.ts       ← useEffect fetch hook (optional extraction)
    tui-driver.tsx               ← updated: accepts repo, mounts ReaderApp
  index.tsx                      ← updated: instantiates repo, passes to tuiDriver
```

## Approaches

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **A — One PR (recommended)** | Fast reviewable cut; all seams verified together; under 400-line budget | Larger diff than single-concern PRs | Low-Medium |
| B — Chain: reducer PR then view PR | Smaller isolated diffs | Unnecessary overhead; reducer without view has no observable behaviour | Low per PR but wasted overhead |
| C — Inline fetch in screen (no hook file) | Fewer files | Harder to test; couples fetch side-effect to render tree | Low |

Recommendation: Approach A (one PR) + fetch in a dedicated `use-passage-fetch.ts` for testability (Approach C risk mitigated).

## Risks

- `<input>` `onSubmit` behavior with OpenTUI needs verification at implementation time — the type signature suggests it fires on Enter but real behavior (does it include the value?) must be confirmed against the installed version.
- `parseReference` currently only accepts `<book> <chapter>:<verse>` format (strict colon-verse required). The success criterion includes `john 3` (chapter-only). Parser will reject it. The proposal must decide: extend domain parser to accept whole-chapter refs (preferred), or add a TUI-only parse path.
- Reactive boundary detection (try fetch → `chapter_not_found`) means an extra network round-trip when navigating past the last chapter. For PR 1 this is acceptable; a static chapter-count map is a future optimization.
- The current `welcome-screen.tsx` has a banner comment block that violates Rule 14. Not in scope for this change but worth noting as future housekeeping.

## Open Questions for Proposal

1. **`parseReference` chapter-only support** — `john 3` (no `:verse`) is in the success criterion but the current parser rejects it. The proposal must decide: extend domain parser to accept whole-chapter refs (preferred — consistent with `user-flow.md` routing table), or add a TUI-only parse path. This determines whether `reference.ts` is touched by this PR. **Default recommendation: extend `parseReference`** to accept `<book> <chapter>` and return a whole-chapter `Reference`.

2. **`tuiDriver` signature change** — currently `tuiDriver(): Promise<void>` with no args. Adding `repo: BibleRepository` requires updating the call site in `src/index.tsx` where the repo is instantiated. The explore confirms `index.tsx` has no repo construction today — that wiring must land in this PR. **Default recommendation: instantiate `createHelloAoBibleRepository()` in `src/index.tsx`** mirroring `src/cli/run.ts`, no caching for now.

## Ready for Proposal

Yes. Both open questions have defensible defaults that align with the intake intent and existing conventions.
