# Exploration: ts-native-architecture

## Executive Summary

Drop ADR 0009's Go-port mandate. Retire Rules 8/9/10 (the Bubble Tea parity rules). Keep Rules 1/5/11/12 on TypeScript merit alone. Loosen Rules 6/7. Keep Rules 2/3/4/11 (decorators ban). Recommended state direction: plain `useReducer` freed from Bubble Tea constraints — with `useEffect` permitted for business-logic async fetch and `AbortController` for cancellation. Zero new dependencies. 99 tests stay green.

---

## Current State

Verbum is a single-binary CLI/TUI Bible reader built with Bun + TypeScript + OpenTUI/React. Hexagonal architecture (ADR 0002) is the load-bearing structure: domain → application → infrastructure (`src/api/`) → presentation (`src/tui/`, `src/cli/`).

State-management reality today:

- `src/tui/welcome/welcome-reducer.ts` — pure `(state, action) => [state, Effect | null]` tuple reducer. Only one action (`KeyPressed`), one effect (`quit`). Zero async.
- `src/tui/tui-driver.tsx` — owns `useReducer`, wraps dispatch with a double-call pattern to extract Effect, runs it synchronously. Zero `useEffect` calls.
- CLI side (`run.ts`, `vod.ts`) — plain async functions. No state management.
- `src/application/get-passage.ts` — `Promise<Result<Passage, AppError>>` use case, wired by the CLI, not yet by TUI.

ADR 0009 rules exist exclusively to make a future Bubble Tea port "mechanical translation, not redesign." The user has dropped that commitment.

---

## Deliverable 1: ADR 0009 Rule-by-Rule Classification

### Rule 1 — Domain functions return Result\<T,E\>, never throw

**KEEP.** Survives on TS merit alone: explicit error flow, no hidden control flow, makes errors part of the contract. Nothing to do with Go.

### Rule 2 — No `class` outside React components

**KEEP.** Factory functions are better TypeScript anyway. `class` with `this`-binding creates coupling problems unrelated to Go.

### Rule 3 — Ports are simple interfaces with primitive/struct args, no callbacks

**KEEP.** Clean hexagonal port definition. No callbacks in a port is good design regardless of target language.

### Rule 4 — Zod stays in `src/api/`; domain imports plain TS types

**KEEP.** This is ADR 0005 territory already. Keeps domain pure and testable — has nothing to do with Go portability.

### Rule 5 — Errors are discriminated unions with a `kind` field

**KEEP.** Best-in-class TS error modeling. Exhaustive switch, no inheritance, zero Go relevance needed.

### Rule 6 — Branded IDs via a single factory

**KEEP.** Already using `BookId = string & { readonly __brand: "BookId" }` pattern. Good TS discipline regardless.

### Rule 7 — No conditional/mapped/template-literal types in domain or application

**LOOSEN.** The rationale was "humans and Go can't follow them." Go rationale is gone. Loosen to: avoid them where they obscure intent, allow them where they genuinely simplify the type model and don't leak across boundaries. Judgment call, not a blanket ban.

### Rule 8 — TUI business state in `useReducer`; `useState` for ephemeral UI only

**KEEP (loosened).** `useReducer` for business state is still excellent TS practice — predictable, testable, explicit. RETIRE the constraint that the reducer must return `[State, Effect | null]` tuple instead of plain `State`. Plain `useReducer` `(state, action) => State` is fine. The tuple signature was Bubble Tea parity.

### Rule 9 — No `useEffect` for business logic; use Effect descriptors + effect-runner

**RETIRE.** This was the most controversial rule and existed purely for Bubble Tea parity (`Effect → tea.Cmd`). Without that constraint, `useEffect` for async fetch is idiomatic React and appropriate. The effect-runner pattern is not wrong, but it's not a mandate anymore. Solo dev can choose based on ergonomics.

### Rule 10 — TUI action names are past-tense facts

**RETIRE.** PascalCase past-tense (`ChapterLoaded`, `KeyPressed`) was explicitly for Bubble Tea `tea.Msg` verbatim porting. Without that, use whatever naming convention reads clearly in TypeScript (present-tense imperative or past-tense — it doesn't matter).

### Rule 11 — No decorators

**KEEP.** Decorators are still experimental/unstable. Composition via HOF is better TS practice regardless.

### Rule 12 — Async data functions return `Promise<Result<T,E>>`

**KEEP.** This is Rule 1 applied to async. Explicit error propagation, no hidden throws across async boundaries. Zero Go relevance needed.

---

## Deliverable 2: State Management Option Space

### Option A: Plain useReducer (freed from Bubble Tea constraints)

- **Type model**: `(state, action) => State` (plain, not tuple). Actions can be named freely. State is a discriminated union.
- **Async + cancellation**: `useEffect` dispatches fetch → stale check via `AbortController` or `requestId` closure.
- **DI**: `BibleRepository` passed as prop or closure into the component tree.
- **Testability**: Reducer is a pure function — unit-testable without mount. `useEffect` side-effects require integration test or separate effect function.
- **React/OpenTUI integration**: Native. Zero overhead. No provider needed.
- **Learning curve**: Zero. Already in use. Pattern is well-understood.
- **Bundle cost**: Zero — native React hook.
- **Hexagonal fit**: Excellent. Use case (`getPassage`) called from `useEffect`, passes `BibleRepository` port.
- **Risks**: Stale closures if effect cleanup is sloppy. Cancellation requires discipline.
- **Effort**: Low. Already exists — remove the tuple constraint and allow `useEffect`.

### Option B: Zustand

- **Type model**: Store slice with typed state + action methods. No formal action objects.
- **Async + cancellation**: Action methods are async; cancellation requires manual `AbortController` or `get()` checks.
- **DI**: Store can hold a `repo` reference or receive it at creation time.
- **Testability**: Store is pure JS — testable without React. No reducer to unit-test; test via action invocations.
- **React/OpenTUI integration**: Hook-based (`useStore`). Provider-free. Re-renders only subscribed slices.
- **Learning curve**: Very low. ~1KB gzipped.
- **Bundle cost**: ~1KB gzipped.
- **Hexagonal fit**: Good but slightly unconventional — the "action method" pattern blurs the boundary between application and presentation. The use case logic could bleed into the store action.
- **Risks**: Architecture erosion — temptation to put use-case logic inside store actions rather than delegating to `getPassage()`. Must establish a discipline of "store actions call application use cases, not the port directly."
- **Effort**: Low-Medium. Small migration.

### Option C: XState v5

- **Type model**: Explicit state machine with states/transitions/actors. First-class `loading`/`loaded`/`error` states.
- **Async + cancellation**: `fromPromise` actor + native `invoke` cancellation when machine leaves the invoking state. AbortController pattern available. Best-in-class cancellation story.
- **DI**: Actor `input` parameter receives `repo` at creation. Clean.
- **Testability**: Machine logic testable without mount via `createActor`. Pure state transition tests.
- **React/OpenTUI integration**: `@xstate/react` → `useMachine()` hook. Provider optional.
- **Learning curve**: High. New mental model (states/events/guards/actors). Overkill for current complexity.
- **Bundle cost**: `xstate` ~17KB gzipped + `@xstate/react` additional.
- **Hexagonal fit**: Excellent conceptually but heavy machinery for a single-screen TUI reader.
- **Risks**: Over-engineering. verbum has 1 screen today, 2-3 screens expected. State machine is most valuable when transitions are complex and non-obvious.
- **Effort**: High. Full rewrite of state model.

### Option D: Effect-TS

- **Type model**: Fiber-based effect system. Replaces `Promise<Result<T,E>>` with `Effect<A, E, R>`. Full type-level dependency injection via context/layers.
- **Async + cancellation**: First-class. Fiber interruption, structured concurrency, `Effect.race`, `Effect.interrupt`.
- **DI**: Context / Layer system. Clean but verbose.
- **Testability**: Exceptional — everything is an effect that can be tested in isolation.
- **React/OpenTUI integration**: Adapter needed. Not native React. Extra boilerplate.
- **Bundle cost**: ~20KB gzipped (Effect v4 minimal) — significant for a CLI binary.
- **Learning curve**: Very high. Replaces most of the stack's error model. Solo dev cost is substantial.
- **Hexagonal fit**: Outstanding in theory, but Effect's layer system IS hexagonal by design — this would be replacing hexagonal architecture concepts with Effect's versions of them.
- **Risks**: Learning curve dominates everything else. Would require migrating `Result<T,E>` across the codebase to `Effect<T,E>`. Major rewrite.
- **Effort**: Very high.

### Option E: Jotai

- **Type model**: Atomic state. Each atom is a piece of state. Async atoms use Suspense or loadable.
- **Async + cancellation**: `atomWithQuery` (from jotai-tanstack-query) or manual `atomWithRefresh`. Cancellation not first-class.
- **DI**: Atoms are global by default. Scoped atoms require Provider wrapping.
- **Testability**: Atoms testable independently. No formal reducer.
- **React/OpenTUI integration**: Hook-based. Provider optional for scoped atoms.
- **Learning curve**: Low-medium. ~6.6KB gzipped.
- **Hexagonal fit**: Awkward. Atomic decomposition doesn't map naturally to use-case-per-operation architecture. Risk of atoms holding application logic.
- **Risks**: The atom model encourages "fetch when subscribed" which bypasses the use-case layer.
- **Effort**: Medium (migration + mental model shift).

### Option F: Redux Toolkit + RTK Query

- **Type model**: Slice reducers + createAsyncThunk or RTK Query endpoints. Past-tense actions.
- **Async + cancellation**: `createAsyncThunk` has `thunkAPI.signal` (AbortController) built in.
- **DI**: Store is global; repo wired via `extraArgument` middleware.
- **Testability**: Reducers are pure functions. Thunks testable.
- **React/OpenTUI integration**: `react-redux` Provider + hooks. Significant boilerplate.
- **Bundle cost**: RTK ~20-30KB gzipped.
- **Hexagonal fit**: Thunks tend to call the API directly, bypassing the use-case layer.
- **Risks**: Severe overkill for a solo-dev single-user CLI/TUI. Adds Provider, store config, slice patterns to a 99-test codebase that has none of that.
- **Effort**: High.

### Option G: Valtio

- **Type model**: Proxy-based mutable state. `useSnapshot()` for reactive reads.
- **Async + cancellation**: Async functions mutate proxy directly. Cancellation manual.
- **Testability**: Proxy mutation is harder to test as pure functions.
- **Hexagonal fit**: Poor. Mutable proxy model clashes with hexagonal's explicit data flow.
- **Effort**: Medium.

---

## Deliverable 3: Recommendation

**Plain useReducer, freed from Bubble Tea constraints (Option A).**

Rationale specific to verbum's profile:

1. **Zero migration cost** — the reducer already exists. Removing the tuple constraint is a 2-line change to `tui-driver.tsx`. 99 tests stay green.
2. **`useEffect` is appropriate** for a single-screen TUI reader with one async operation (passage fetch). The complexity that justifies XState or Effect-TS does not exist yet.
3. **`AbortController`** handles stale request cancellation natively in Bun/browser environments without introducing new dependencies.
4. **Hexagonal discipline is preserved** — `useEffect` calls `getPassage(repo, ref)` (the application use case), not the repository directly.
5. **No new dependencies** in a CLI binary where bundle size matters.
6. **Consistent with the developer's learning goal** — understand the hexagonal/TUI model deeply before abstracting it with a state library.

The freed constraints: reducer returns plain `State` (not tuple). Actions can be named with present-tense imperative if that reads better. `useEffect` is the async bridge in `tui-driver.tsx`.

### Code sketch — async fetch with cancellation (reader pattern)

```typescript
// src/tui/reader/reader-screen.tsx — fetch with cancellation, no Effect descriptor pattern
function ReaderApp({ repo }: { repo: BibleRepository }) {
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);

  useEffect(() => {
    if (state.kind !== "loading") return;

    let cancelled = false;

    getPassage(repo, state.ref).then((result) => {
      if (cancelled) return; // stale check
      if (result.ok) dispatch({ type: "PassageFetched", passage: result.value });
      else dispatch({ type: "FetchFailed", error: result.error });
    });

    return () => {
      cancelled = true;
    };
  }, [state.kind === "loading" ? state.ref : null]);

  // ...
}
```

The reducer becomes:

```typescript
// plain (state, action) => State — no tuple, no Effect descriptor
function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case "PassageRequested":
      return { kind: "loading", ref: action.ref };
    case "PassageFetched":
      return { kind: "loaded", passage: action.passage };
    case "FetchFailed":
      return { kind: "error", error: action.error };
    default:
      return state;
  }
}
```

Reducer is still a pure function — still unit-testable without mount. The async side lives in `useEffect` in the driver.

---

## Deliverable 4: Migration Cost

### Files that change

- `docs/decisions/0009-language-portable-architecture.md` — supersede with new ADR (0010). Status: superseded.
- `docs/house-rules.md` — retire Rules 9/10, loosen Rule 8 (remove tuple mandate), loosen Rule 7.
- `src/tui/tui-driver.tsx` — simplify: remove `reactReducer` shim, use standard `useReducer` with plain reducer. The double-call pattern goes away.
- `src/tui/welcome/welcome-reducer.ts` — signature changes from `[State, Effect | null]` to `State`. The effect for `quit` moves to the driver's `useEffect` or a keybinding handler.
- `src/tui/welcome/welcome-reducer.test.ts` — update to match new reducer signature.

### Files that stay identical

- `src/domain/result.ts` — unchanged (Rule 1/5/12 kept)
- `src/domain/errors.ts` — unchanged
- `src/domain/book-id.ts` — unchanged (Rule 6 kept)
- `src/domain/reference.ts`, `src/domain/passage.ts`, `src/domain/translations.ts` — unchanged
- `src/application/get-passage.ts` — unchanged
- `src/application/ports/bible-repository.ts` — unchanged (Rule 3 kept)
- `src/api/` — unchanged
- `src/cli/` — unchanged
- `src/presentation/` — unchanged

### Migration effort: Low

- ~5 files touched, 2 are docs
- The reducer simplification is mechanical (remove tuple, move `quit` effect handling inline)
- Existing 99 tests: reducer tests need signature update; all application/domain/cli tests untouched
- Net: no new dependencies, no structural changes to hexagonal layers

---

## Deliverable 5: Implications for tui-async-effects

**Option (c) — Retired and reshaped.** The paused `tui-async-effects` change should NOT be resumed as-is.

Why:

- The existing exploration (Approach B, `makeEffectRunner(deps)`) was specifically designed around the Effect-descriptor pattern (Rule 9). That pattern is being retired.
- The new approach absorbs the problem differently: `useEffect` in the driver IS the effect runner — no separate factory needed.
- Approach B's stale-drop logic (`latestRequestId` closure inside `makeEffectRunner`) is replaced by `cancelled` flag inside `useEffect` cleanup (or `AbortController` for HTTP-layer cancellation).
- The `fetch-passage` Effect variant and `cancel-fetch` Effect variant in the Effect union become unnecessary — cancellation is handled by `useEffect` cleanup.

What replaces it: a single new change (`tui-reader-screen` or similar) that:

- PR 1: Simplifies the welcome reducer (remove tuple, inline `quit` handling)
- PR 2: Adds the reader screen with `useReducer + useEffect` async fetch pattern

The tui-async-effects exploration remains informational for understanding WHY the Effect-descriptor approach was considered, but its concrete implementation artifacts (Approach B code, the Effect union extension, `makeEffectRunner`) are superseded.

---

## Approaches Comparison Table

| Approach | Async/cancel | Bundle cost | Migration effort | Hexagonal fit | Solo-dev ergonomics |
|---|---|---|---|---|---|
| **Plain useReducer (freed)** | useEffect + AbortController | 0 KB | Low | Excellent | High |
| Zustand | Manual abort | +1 KB | Low-Med | Good (with discipline) | High |
| XState v5 | Native actor cancel | +17 KB | High | Excellent | Low (steep curve) |
| Effect-TS | Fiber interruption | +20 KB | Very High | Excellent (replaces DI) | Very Low |
| Jotai | Manual | +7 KB | Medium | Awkward | Medium |
| Redux Toolkit | thunkAPI.signal | +25 KB | High | Poor (thunks bypass use cases) | Low |

---

## Risks

1. **`useEffect` re-introduction risk**: Without a clear convention, async `useEffect` calls might bypass the application layer and call the repository port directly. Convention needed: `useEffect` may only call application use cases, never ports or adapters directly.

2. **welcome-reducer migration breaks existing tests**: The tuple signature `[State, Effect | null]` is explicitly tested. Migration requires updating `welcome-reducer.test.ts` — not a risk, just work.

3. **ADR 0009 supersession must be deliberate**: Simply editing `house-rules.md` without a formal new ADR loses the reasoning trail. A proper ADR 0010 with "supersedes 0009, rationale: Go-port commitment dropped" is needed.

4. **tui-async-effects paused exploration could confuse future planning**: The openspec artifact should be archived or marked superseded so it doesn't create contradictory planning context.

---

## Open Questions for Proposal Phase

1. **How does `quit` get handled after reducer simplification?** Options: (a) inline in `useKeyboard` handler without going through reducer at all, (b) reducer returns a flag in state (`state.kind = "quitting"`), effect checked by driver. Proposal must decide.

2. **Convention document for `useEffect` → use-case-only rule**: Should this be a new house rule (Rule 13?) or a clarification of Rule 9's retirement text?

3. **ADR numbering**: Is the new superseding ADR 0010? Check if 0010 is taken.

4. **Welcome reducer test strategy after tuple removal**: Tests currently assert `[nextState, effect]` tuple shape. New tests assert plain `nextState`. Is this a pure rewrite or a compatibility shim period?

5. **Should tui-async-effects be formally archived** in engram/openspec, or just left as informational context?

---

## Ready for Proposal

Yes. The recommendation is clear, the migration cost is low, and the open questions are well-scoped for proposal resolution.
