# Proposal: tui-reader-screen

## TL;DR

- `verbum` with no arguments boots a Reader screen (palette → fetch → verses) instead of the welcome screen.
- `parseReference` is extended to accept `<book> <chapter>` (chapter-only) and returns `verses: { start: 1, end: Number.MAX_SAFE_INTEGER }`.
- State is a discriminated union (`awaiting | loading | loaded | network-error`) driven by `useReducer` + an object-dispatch handler table (Rule 13).
- Async fetch runs in `useEffect` with a `cancelled` flag; loading spinner reuses `SPINNER_FRAMES` via `useState + setInterval`.
- One PR, ~250–300 lines, well under the 400-line review budget.

---

## Why

The existing TUI boots a welcome screen and exits — the hex architecture's TUI seam is entirely unverified end-to-end. `getPassage`, `BibleRepository`, and the `Result<T,E>` pipeline are exercised by CLI smoke tests but never from the React render tree. This change makes verbum a real reader and verifies the full hex seam from the TUI adapter inward.

ADR 0010 (TypeScript-native architecture) is now in place. The effect-runner indirection that previously blocked this slice has been retired. The path is clear.

---

## What Changes

New files:

- `src/tui/reader/reader-reducer.ts` — pure state machine; discriminated-union state + object-dispatch handler table
- `src/tui/reader/reader-reducer.test.ts` — RED-first unit tests for every state transition
- `src/tui/reader/reader-screen.tsx` — view: palette overlay + Reading view frame + loading spinner + error rendering
- `src/tui/reader/use-passage-fetch.ts` — `useEffect` fetch hook extracted for testability

Modified files:

- `src/tui/tui-driver.tsx` — signature becomes `tuiDriver(repo: BibleRepository)`; mounts `ReaderApp` instead of `App`; keeps `useKeyboard` for `]` / `[` nav, `/` palette reopen, `q` quit
- `src/index.tsx` — instantiates `createHelloAoBibleRepository()` (mirroring `src/cli/run.ts`) and passes repo to `tuiDriver`
- `src/domain/reference.ts` — `parseReference` extended to accept `<book> <chapter>` (no verse token); returns `verses: { start: 1, end: Number.MAX_SAFE_INTEGER }`
- `src/domain/reference.test.ts` — RED-first tests for chapter-only parsing

---

## What Does NOT Change

- All other domain helpers (`makeBookId`, `Result<T,E>`, `BOOK_ALIASES`)
- Application use cases (`get-passage.ts`) and the `BibleRepository` port — consumed as-is
- API adapter (`hello-ao-bible-repository.ts`) — no caching layer added
- CLI layer (`run.ts`, `vod.ts`, `loading.ts`) — `withLoading` untouched; only `SPINNER_FRAMES` is imported
- Hexagonal layers and ADR 0010 dialect — all retained
- `welcome-screen.tsx` and `welcome-reducer.ts` — files remain; no-args path simply no longer mounts them

---

## State Machine

```ts
type ReaderState =
  | { kind: "awaiting"; query: string; parseError: ParseError | null }
  | { kind: "loading"; ref: Reference }
  | { kind: "loaded"; passage: Passage; ref: Reference }
  | { kind: "network-error"; ref: Reference; reason: RepoError };

type ReaderAction =
  | { type: "QueryTyped"; query: string }
  | { type: "QuerySubmitted" }
  | { type: "PassageFetched"; passage: Passage }
  | { type: "FetchFailed"; ref: Reference; reason: RepoError }
  | { type: "ChapterAdvanced" }
  | { type: "ChapterRetreated" }
  | { type: "PaletteReopened" };
```

Handler table (Rule 13 object-dispatch pattern):

```ts
const handlers = {
  QueryTyped: (s, a) =>
    s.kind === "awaiting" ? { ...s, query: a.query, parseError: null } : s,

  QuerySubmitted: (s) => {
    if (s.kind !== "awaiting") return s;
    const result = parseReference(s.query);
    return result.ok
      ? { kind: "loading", ref: result.value }
      : { ...s, parseError: result.error };
  },

  PassageFetched: (s, a) =>
    s.kind === "loading"
      ? { kind: "loaded", passage: a.passage, ref: s.ref }
      : s,

  FetchFailed: (s, a) =>
    s.kind === "loading"
      ? { kind: "network-error", ref: a.ref, reason: a.reason }
      : s,

  ChapterAdvanced: (s) =>
    s.kind === "loaded"
      ? { kind: "loading", ref: { ...s.ref, chapter: s.ref.chapter + 1 } }
      : s,

  ChapterRetreated: (s) =>
    s.kind === "loaded"
      ? { kind: "loading", ref: { ...s.ref, chapter: s.ref.chapter - 1 } }
      : s,

  PaletteReopened: (s) =>
    s.kind === "loaded" || s.kind === "network-error"
      ? { kind: "awaiting", query: "", parseError: null }
      : s,
} satisfies { [K in ReaderAction["type"]]: (s: ReaderState, a: Extract<ReaderAction, { type: K }>) => ReaderState };
```

---

## Async Fetch Pattern

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

`repo` flows: `tuiDriver(repo)` → `<ReaderApp repo={repo}>` → `usePassageFetch(repo, state, dispatch)`.

Loading spinner (ephemeral UI state, Rule 8 allows it):

```ts
const [frame, setFrame] = useState(0);
useEffect(() => {
  if (state.kind !== "loading") return;
  const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
  return () => clearInterval(id);
}, [state.kind]);
```

---

## First Reviewable Cut

Single PR. Estimated diff:

| File | Lines |
|---|---|
| `reader-reducer.ts` | ~50 |
| `reader-reducer.test.ts` | ~90 |
| `reader-screen.tsx` | ~90 |
| `use-passage-fetch.ts` | ~25 |
| `tui-driver.tsx` (modified) | ~15 |
| `index.tsx` (modified) | ~10 |
| `reference.ts` (modified) | ~20 |
| `reference.test.ts` (modified) | ~30 |
| **Total** | **~330** |

Within the 400-line review budget.

---

## Success Criterion

`verbum` → palette focused → type `john 3` Enter → spinner ticks, then verses render → `]` → John 4 → `[` → John 3 → `/` → palette → type `jhn 3x` Enter → inline parse error → `q` exits clean.

---

## Risks

1. **`<input>` onSubmit shape** — `@opentui/react` types suggest `onSubmit` fires on Enter, but whether the handler receives the current value or reads it from `onChange` state must be verified at implementation time against the installed package version.
2. **Reactive boundary latency** — navigating past the last chapter triggers a full fetch round-trip before showing the `⚠ last chapter` hint. Acceptable for PR 1; a static chapter-count map is a v0.2 optimization.
3. **`parseReference` scope creep** — extending the domain parser touches a function with existing callers. The extension is additive (new branch when no `:` is found), not breaking, but tests must cover regression on all existing formats.

---

## Out of Scope

- Palette result list sections (References / Books / Commands)
- Scroll-by-verse, book pickers, translation picker
- Welcome screen modifications
- Static chapter-count map
- Caching layer on the repository

---

## Next Steps After This Lands

v0.2 candidates (not committed):

- Full palette with References / Books / Commands result sections
- Scroll-by-verse navigation
- Translation picker overlay
- Static chapter-count map for instant boundary feedback
