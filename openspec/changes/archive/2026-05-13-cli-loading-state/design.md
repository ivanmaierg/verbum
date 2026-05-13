# Design — cli-loading-state

## Overview

A new CLI presentation utility, `src/cli/loading.ts`, exports `withLoading<T>(stream, fn, options?)` — a higher-order async wrapper that renders a 10-frame Braille spinner to a `NodeJS.WriteStream` (always stderr in practice) on an interval while `fn` runs, then erases the spinner line in a `finally` block before returning whatever `fn` produced. The wrapper is transparent to the caller's `Result<T, E>` (R12) and never throws (R1) — if `fn` rejects, cleanup still runs and the rejection propagates unchanged. `run.ts` and `vod.ts` each gain one wrapped await; no other production code paths change.

## Module Layout

```
src/cli/
  ansi.ts              # existing — isColorEnabled, accent/dim/error/muted helpers
  loading.ts           # NEW — withLoading, isSpinnerEnabled, SPINNER_FRAMES
  loading.test.ts      # NEW — unit tests
  render.ts            # existing — renderPassage / renderParseError / renderRepoError
  run.ts               # MODIFY — wrap the getPassage await
  vod.ts               # MODIFY — wrap the getPassage await
tests/
  vod-smoke.test.ts    # existing — extended with one assertion (preferred over new file)
```

`src/cli/loading.ts` exports:

- `withLoading<T>(stream, fn, options?): Promise<T>` — the wrapper
- `isSpinnerEnabled(stream): boolean` — the TTY/env gate
- `SPINNER_FRAMES` — readonly 10-tuple of Braille glyphs (`as const`)

Nothing else is exported. The interval default (`80`) is an internal default inside `withLoading`, not a named export — callers should not need to know it.

## Types and Signatures

Verbatim TypeScript for `src/cli/loading.ts`:

```ts
// src/cli/loading.ts — animated stderr spinner for blocking CLI awaits.
// Gated on per-stream TTY + NO_COLOR/FORCE_COLOR (mirrors isColorEnabled).
// R1/R12 spirit: transparent to the Result<T, E> that fn returns; never throws.
// R3 N/A: presentation utility, not a port. R2/R11: plain function, no class,
// no decorators. fn is a thunk, not an event handler.

export const SPINNER_FRAMES = [
  "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏",
] as const;

export type SpinnerFrame = (typeof SPINNER_FRAMES)[number];

export type WithLoadingOptions = {
  readonly interval?: number; // ms between frame writes; default 80
};

export function isSpinnerEnabled(stream: NodeJS.WriteStream): boolean { /* ... */ }

export function withLoading<T>(
  stream: NodeJS.WriteStream,
  fn: () => Promise<T>,
  options?: WithLoadingOptions,
): Promise<T> { /* ... */ }
```

Notes on the type choices:

- `SpinnerFrame` is exported only because it falls out of `as const` for free — it is not consumed anywhere outside the module. Leaving it exported costs nothing and lets future tests assert frame identity. This is NOT a template-literal type (R7 N/A here anyway — presentation layer).
- `WithLoadingOptions` is `readonly` with a single optional field. No conditional/mapped types (R7).
- `Promise<T>` is the return — `withLoading` is transparent to `T`. When `T` is `Result<Passage, GetPassageError>` (the actual production usage), the helper passes it through byte-identically (R12).
- The interval handle type is `ReturnType<typeof setInterval>` — internal, not exported. Node typings call this `NodeJS.Timeout`; using `ReturnType<typeof setInterval>` avoids importing the `NodeJS` global into the helper just for one local variable type.

## Control Flow

### `isSpinnerEnabled(stream)`

Implementation mirrors `isColorEnabled` line-for-line (the proposal's decision to duplicate rather than refactor is binding — `simplify` says three similar lines is fine, and a third gate may diverge later):

1. Read `process.env.NO_COLOR`. If it is a string of length > 0 → return `false`.
2. Read `process.env.FORCE_COLOR`. If non-empty:
   - lowercase it
   - if `"0"` or `"false"` → return `false`
   - else → return `true` (overrides `isTTY`)
3. Fallback: return `stream.isTTY === true`.

This guarantees the Success Criterion cases:

| Env / stream | Result |
|--------------|--------|
| `isTTY=true`, no env | `true` |
| `isTTY=false`, no env | `false` |
| `isTTY=true`, `NO_COLOR=1` | `false` |
| `isTTY=true`, `FORCE_COLOR=0` | `false` |
| `isTTY=false`, `FORCE_COLOR=1` | `true` (override) |
| `isTTY=true`, `NO_COLOR=1` + `FORCE_COLOR=1` | `false` (NO_COLOR wins, no-color.org) |

### `withLoading` — TTY-false path (no-op)

1. Check `isSpinnerEnabled(stream)`. Returns `false`.
2. Return `fn()` directly. No `setInterval`, no `stream.write`, no `try/finally` overhead.
3. Caller receives the resolved `T` (or the rejection) untouched.

Observable behavior: stream gets zero writes from the helper. Byte-identical to calling `fn()` directly. This is the path taken by `CI=true`, `2>/dev/null`, `NO_COLOR=1`, and any non-interactive harness.

### `withLoading` — TTY-true path (animated)

1. Check `isSpinnerEnabled(stream)`. Returns `true`.
2. Compute `frame = SPINNER_FRAMES[0]` and `width = 1` (every Braille frame is one column wide — invariant baked into the frame array).
3. Initialize index `i = 0`.
4. Start `setInterval` at `options?.interval ?? 80` ms. Each tick:
   - `stream.write("\r" + SPINNER_FRAMES[i % SPINNER_FRAMES.length])`
   - `i++`
   - No newline. The `\r` returns cursor to column 0; next frame overwrites the glyph in place.
5. Write the initial frame **immediately** (before awaiting `fn`) so the user sees the spinner appear without waiting up to one interval. Without this, fast-resolving `fn` would never render and the spinner would feel intermittent.
6. `try { return await fn(); } finally { cleanup() }` where `cleanup()`:
   - `clearInterval(handle)`
   - `stream.write("\r" + " ".repeat(width) + "\r")` — erase the glyph, return cursor to column 0
7. Caller receives the resolved `T` after cleanup completes.

Byte sequence on a successful single-tick path:

```
write: "\r⠋"        // initial render (step 5)
[interval may fire 0..N times]
write: "\r⠙"        // tick 1
write: "\r⠹"        // tick 2
[fn resolves]
write: "\r \r"      // cleanup (step 6)
```

After cleanup the cursor is at column 0 of the spinner line with that column blanked — the caller's next stdout write (the verse text + `\n`) lands cleanly on the row the spinner occupied. Because the verse text goes to **stdout** and the spinner is on **stderr**, in interactive terminals both streams render to the same TTY device and the cleanup `\r` + space + `\r` correctly erases the visible glyph.

### `withLoading` — rejection path

`finally` runs whether the `try` block resolves or rejects. The cleanup write happens before the rejection escapes the wrapper. Sequence when `fn` rejects:

1. Same setup as the TTY-true path above (or skipped entirely on TTY-false).
2. `await fn()` throws (rejects).
3. `finally` block executes: `clearInterval(handle)`, then `stream.write("\r \r")`.
4. The rejection propagates out of `withLoading` to the caller.

Important: `withLoading` does NOT catch the rejection or convert it to a `Result`. R1 talks about **domain** functions; this is presentation. The convention in the codebase is that `getPassage` already returns `Promise<Result<T, E>>` — a rejection from `withLoading`'s `fn` would only happen for a programmer error (e.g. a thrown TypeError inside the thunk), which should surface as an unhandled rejection at the process boundary, not be silently absorbed. R1's spirit (no exception masking) is honored.

### Concurrency — single spinner at a time

`withLoading` is not re-entrant. Two concurrent `withLoading` calls writing to the same stream would interleave `\r`-anchored writes and produce garbage. The codebase has exactly two call sites (`run.ts:39`, `vod.ts:40`), each of which is the sole `await` in its `run`/`runVod` function. There is no path through `run.ts` or `vod.ts` that nests `withLoading`. This is a binding constraint on the helper, not a guarded invariant — the helper does NOT track an "in flight" flag. Documentation in `loading.ts` calls this out; the test for nested behavior is intentionally absent (no need to lock down something we've contracted out of).

Future use sites (e.g. a TUI loading state, or a CLI subcommand that issues two parallel fetches) must NOT call `withLoading` concurrently against the same stream. If a future feature needs parallel work indicators, that is a separate design — not v1.

## House Rules Compliance

| Rule | Verdict | Justification |
|------|---------|---------------|
| R1 — domain never throws | N/A (presentation) | `withLoading` itself never throws; `fn`'s rejection propagates unchanged via `finally` — no exception masking. Spirit preserved. |
| R2 — no `class` outside `src/tui/` | Respected | `withLoading` and `isSpinnerEnabled` are plain functions. `SPINNER_FRAMES` is a const tuple. |
| R3 — ports have no callbacks | N/A | `withLoading` is a CLI presentation utility, not a port. The `fn` parameter is a thunk for deferred execution, not an event handler on a hexagonal-boundary interface. R3 is binding for `BibleRepository`-style interfaces only. |
| R4 — Zod stays in `src/api/` | N/A | No validation involved. |
| R5 — errors as discriminated unions with `kind` | Respected | No new error types introduced. Caller's `Result<T, E>` (which already has `kind` on its error branch) flows through unchanged. |
| R6 — branded IDs via single factory | N/A | No IDs introduced. |
| R7 — no conditional/mapped/template-literal types in domain/application | N/A (and respected anyway) | `loading.ts` is presentation. The signature uses a single generic `T` and an `as const` literal tuple — no mapped/conditional/template-literal types. |
| R8 — TUI business state in `useReducer` | N/A | CLI has no React state. |
| R9 — no `useEffect` for business logic | N/A | CLI is imperative; `setInterval` is the correct primitive for time-based UI in a non-React surface. |
| R10 — action names past-tense | N/A | No reducer actions. |
| R11 — no decorators | Respected | `withLoading` is a plain higher-order function. R11 prohibits decorators, not HOFs — explicit higher-order functions are the recommended substitute. |
| R12 — async data fns return `Promise<Result<T, E>>` | Respected | `withLoading<T>` is transparent to `T`. When callers pass `() => getPassage(repo, ref)`, `T = Result<Passage, GetPassageError>` and the helper returns that exact shape. The wrapper does NOT re-shape the Result. |

cognitive-doc-design: this design leads with the architecture diagram (Module Layout), then the type signatures, then control flow as numbered steps — show, don't tell.

simplify: `isSpinnerEnabled` deliberately duplicates `isColorEnabled` rather than extracting a shared `isTTYEnabled`. Three similar lines is fine; the responsibilities are conceptually distinct (color vs animation) and a future divergence is a 5-line edit, not an API refactor.

## Test Design

### `src/cli/loading.test.ts` (NEW, ~80 lines)

Follows the structure of `src/cli/ansi.test.ts` exactly: `describe` blocks, `beforeEach`/`afterEach` for env-var save/restore, fake streams cast from POJOs.

Test groups cover:
- `isSpinnerEnabled` truth table (TTY/env-var combinations)
- `withLoading` TTY-false path (no-op)
- `withLoading` TTY-true path (renders + cleans up)
- `withLoading` rejection path
- Frame array shape validation

### Smoke coverage — extend `tests/vod-smoke.test.ts`

Decision: **extend `tests/vod-smoke.test.ts`** rather than create `tests/loading-smoke.test.ts`. One additional `describe` block keeps the smoke surface flat.

## File-by-file Change Plan

| File | Action | Specifics |
|------|--------|-----------|
| `src/cli/loading.ts` | NEW (~50 lines) | Exports `SPINNER_FRAMES` (`as const`), `WithLoadingOptions`, `SpinnerFrame`, `isSpinnerEnabled`, `withLoading`. Internal: cleanup helper inlined into `finally`. |
| `src/cli/loading.test.ts` | NEW (~80 lines) | Truth table + withLoading path tests. Reuses env-var save/restore pattern from `ansi.test.ts`. |
| `src/cli/run.ts` | MODIFY | Add `import { withLoading } from "@/cli/loading";` after the existing `@/cli/render` import. Change line 39 from `const passageResult = await getPassage(repo, refResult.value);` to `const passageResult = await withLoading(process.stderr, () => getPassage(repo, refResult.value));`. |
| `src/cli/vod.ts` | MODIFY | Add `import { withLoading } from "@/cli/loading";` after the existing `@/cli/render` import. Change line 40 from `const passageResult = await getPassage(repo, ref);` to `const passageResult = await withLoading(process.stderr, () => getPassage(repo, ref));`. |
| `tests/vod-smoke.test.ts` | MODIFY | Append one `describe` block (the loading-state smoke assertion above). No change to existing test bodies. |

Net diff: ~150 lines added, 2 lines modified, 2 imports added. One PR.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `setInterval` outlives the test that started it → flaky stderr captures, Bun "timer not cleared" warning | Cleanup in `finally` runs before `await` returns to the caller; tests `await` the wrapper so cleanup is synchronous w.r.t. assertions. Unit tests inject `interval: 1_000_000` to make the interval effectively dormant during the test body. |
| Spinner frame leaks into stdout pipelines (`verbum john 3:16 \| jq`) | Spinner target is **stderr**, set in the call site (`withLoading(process.stderr, ...)`); stdout is never written by the helper. Smoke test asserts stderr is empty when `NO_COLOR=1`. |
| `NO_COLOR=1` ignored by spinner (Success Criterion regression) | `isSpinnerEnabled` is its own function and is the gate — it implements the same `NO_COLOR` priority chain as `isColorEnabled`. Group 1 truth-table tests lock this down. |
| Line-wrap orphan if spinner glyph + future text exceeds terminal width | Spinner is frame-only (no text — proposal decision). 1-column glyph is unambiguously safe at any width ≥ 1. Cleanup writes exactly `width` spaces. |
| Nested / concurrent `withLoading` calls produce interleaved garbage | `withLoading` is documented as single-instance-per-stream. The two production call sites are mutually exclusive (different subcommands) and each is the sole `await` in its function. No nested path exists in v1. |
| `process.stderr.isTTY` differs between dev terminal and CI | The env-var override chain (`FORCE_COLOR=0` / `NO_COLOR=1`) provides explicit opt-out. CI harnesses with `NO_COLOR=1` set globally get no spinner. |
| `\r` cleanup ineffective on terminals that wrap the spinner line | Unreachable: frame width is 1, terminal min width ≥ 40 cols. The wrap path cannot trigger. |
| Spinner appears in `bun test` output when running tests interactively | Unit tests pass fake streams that never write to a real terminal; smoke test sets `NO_COLOR=1`. No production code in `bun test` triggers the spinner against `process.stderr`. |

## Out of Scope

Verbatim from the proposal — restated here so the apply phase has a single closed envelope:

- Loading state for any future TUI screens (different mechanism via OpenTUI/React)
- Progress percentage or determinate progress bars (indeterminate spinner only)
- Custom themes or user-configurable spinner frames
- Multi-line layouts, gradient frames, fancy rendering
- A `--no-spinner` flag (`NO_COLOR` and `isTTY` already provide opt-out)
- Refactoring `isColorEnabled` to share implementation with `isSpinnerEnabled`
- Spinner for any non-`getPassage` operation
- Replacing the hand-rolled spinner with `ora` or another library
- Bun fake-timer infrastructure (injectable `interval` is the v1 strategy)
- Nested / concurrent `withLoading` against the same stream

## Open Design Questions

None. All four exploration questions are decided in the proposal; the design phase only resolves implementation-level concerns (interval handle type, initial-render-before-tick, smoke harness choice) — each is locked down above.
