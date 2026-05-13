# Spec — cli-loading-state

## Capability

CLI presentation — loading indicators. This change introduces the `loading` sub-module to the CLI adapter layer (`src/cli/`), a peer of `ansi.ts`. No existing capability spec exists for `cli`; this is the first delta. It extends the observable behavior of **run** (`src/cli/run.ts`) and **vod** (`src/cli/vod.ts`) — both previously specced as part of `verbum-vod`.

---

## Requirements

### REQ-1: withLoading signature

**Statement**: `src/cli/loading.ts` SHALL export a generic function with the exact signature:

```ts
export function withLoading<T>(
  stream: NodeJS.WriteStream,
  fn: () => Promise<T>,
  options?: { interval?: number }
): Promise<T>
```

**Rationale**: Locks the public API so call sites in `run.ts` and `vod.ts` have a single unambiguous contract to target.

**Acceptance**:
- Given `src/cli/loading.ts` is imported
- When a caller invokes `withLoading(process.stderr, () => somePromise)`
- Then the TypeScript compiler accepts the call without type errors and `T` is inferred from `somePromise`'s resolved type

---

### REQ-2: isSpinnerEnabled signature and export

**Statement**: `src/cli/loading.ts` SHALL export a function `isSpinnerEnabled(stream: NodeJS.WriteStream): boolean` that is the sole gate for spinner activation.

**Rationale**: Named export with a distinct responsibility from `isColorEnabled` — keeps the two concerns independently evolvable.

**Acceptance**:
- Given `src/cli/loading.ts` is imported
- When `isSpinnerEnabled` is called with a stream object
- Then it returns a `boolean` without throwing

---

### REQ-3: isSpinnerEnabled precedence chain

**Statement**: `isSpinnerEnabled` SHALL evaluate the following conditions in order and return at the first match:

| Priority | Condition | Return |
|----------|-----------|--------|
| 1 | `process.env.NO_COLOR` is a non-empty string | `false` |
| 2 | `process.env.FORCE_COLOR` is `"0"` or `"false"` | `false` |
| 3 | `process.env.FORCE_COLOR` is any other non-empty string | `true` |
| 4 | `stream.isTTY === true` | `true` |
| 5 | fallback | `false` |

**Rationale**: Mirrors the `isColorEnabled` precedence in `ansi.ts` so that `NO_COLOR=1` suppressess both color and spinner with a single env variable, satisfying the stated success criterion.

**Acceptance**:
- Given `NO_COLOR` is set to any non-empty string
- When `isSpinnerEnabled` is called with a TTY-true stream
- Then it returns `false`

- Given `FORCE_COLOR` is `"0"`
- When `isSpinnerEnabled` is called with a TTY-true stream
- Then it returns `false`

- Given `FORCE_COLOR` is `"1"` and `NO_COLOR` is unset
- When `isSpinnerEnabled` is called with a TTY-false stream
- Then it returns `true`

- Given no `NO_COLOR` or `FORCE_COLOR` env vars are set
- When `isSpinnerEnabled` is called with a stream where `isTTY` is `undefined` or `false`
- Then it returns `false`

---

### REQ-4: Spinner frames and interval

**Statement**: When active, `withLoading` SHALL cycle through exactly these 10 Braille frames in order — `["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]` — writing one frame per tick at a default interval of 80 ms. The frame display text SHALL be the frame character alone (no label, no color escapes).

**Rationale**: Locks the visual output so tests can assert exact write content. Frame-only eliminates line-wrap risk and avoids vocabulary that could become stale.

**Acceptance**:
- Given a TTY-true fake stream with a write-capture function
- When `withLoading` is called with `options: { interval: 1 }` and a `fn` that resolves after at least one tick
- Then the capture function is called with a write containing exactly one of the 10 Braille characters preceded by `\r`
- And the sequence of frames across ticks cycles through the array in index order, wrapping at index 10

---

### REQ-5: No-op when isSpinnerEnabled returns false

**Statement**: When `isSpinnerEnabled(stream)` returns `false`, `withLoading` SHALL call `fn()`, await its result, and return it — without writing any bytes to `stream`.

**Rationale**: Guarantees that piped, redirected, and CI invocations are byte-identical to the pre-change behavior.

**Acceptance**:
- Given a fake stream with `isTTY: false` and a write spy
- When `withLoading(fakeStream, () => Promise.resolve(42))` is called and awaited
- Then the write spy is never called
- And the return value is `42`

---

### REQ-6: Spinner write target is stderr only

**Statement**: `withLoading` SHALL only write spinner frames and cleanup bytes to the `stream` argument it receives. It SHALL NOT write to `process.stdout` or any other global stream.

**Rationale**: Stdout must remain pristine so that `verbum john 3:16 | jq` and `> out.txt` pipelines are unaffected.

**Acceptance**:
- Given `process.stdout.write` is monkey-patched to capture calls
- When `withLoading(process.stderr, fn)` is called and awaited
- Then `process.stdout.write` is never called during or after the spinner

---

### REQ-7: Cleanup before fn result propagates

**Statement**: When `isSpinnerEnabled(stream)` returns `true`, `withLoading` SHALL, in a `finally` block: (1) call `clearInterval` on the spinner handle, then (2) write `"\r" + " ".repeat(frameWidth) + "\r"` to `stream` — where `frameWidth` is the character length of one frame (1 for a single Braille glyph). Both steps SHALL complete before the resolved value or rejection from `fn` propagates to the caller.

**Rationale**: Ensures the spinner line is erased before any stdout output from the caller lands on the terminal, and prevents interval leaks into subsequent test cases.

**Acceptance**:
- Given a TTY-true fake stream with a write spy, and `options: { interval: 1 }`
- When `withLoading` is called with a `fn` that resolves after a short delay
- Then after `await withLoading(...)` returns, the last write recorded by the spy is `"\r \r"` (carriage return + one space + carriage return)

- Given a TTY-true fake stream and `options: { interval: 1 }`
- When `withLoading` is called with a `fn` that rejects
- Then the cleanup write (`"\r \r"`) is still written to the stream before the rejection propagates

---

### REQ-8: Result transparency (R12 compliance)

**Statement**: `withLoading<T>` SHALL return exactly what `fn()` resolves to — including `Result<T, E>` shapes — without wrapping, unwrapping, or transforming the value. If `fn()` rejects, `withLoading` SHALL re-throw the same rejection unchanged.

**Rationale**: R12 requires async data functions to return `Promise<Result<T, E>>`. The call sites pass `() => getPassage(...)`, which already returns `Promise<Result<Passage, GetPassageError>>`. The wrapper must not alter that shape.

**Acceptance**:
- Given `fn` is `() => Promise.resolve({ ok: true, value: "verse" })`
- When `await withLoading(stream, fn)` resolves
- Then the returned value is `{ ok: true, value: "verse" }` with no additional wrapping

- Given `fn` is `() => Promise.reject(new Error("network"))`
- When `withLoading(stream, fn)` is awaited inside a try/catch
- Then the caught error is the same `Error("network")` instance

---

### REQ-9: run.ts integration

**Statement**: `src/cli/run.ts` SHALL wrap its `getPassage(repo, ref)` call with `withLoading(process.stderr, () => getPassage(repo, ref))`. The import of `withLoading` SHALL come from `../cli/loading` (or the equivalent relative path). No other lines in `run.ts` SHALL change.

**Rationale**: Delivers the spinner for the primary `verbum <book> <ref>` command path.

**Acceptance**:
- Given a fake `process.stderr` with `isTTY: true` is injected (or the process is run in a TTY context)
- When `verbum john 3:16` runs
- Then at least one spinner frame is written to stderr before stdout receives the verse

- Given `process.stderr.isTTY` is `false`
- When `verbum john 3:16` runs
- Then stderr receives zero bytes from the spinner (verse still appears on stdout)

---

### REQ-10: vod.ts integration

**Statement**: `src/cli/vod.ts` SHALL wrap its `getPassage(repo, ref)` call with `withLoading(process.stderr, () => getPassage(repo, ref))`. The import and wrapping pattern SHALL be identical to the one used in `run.ts` (REQ-9).

**Rationale**: Delivers the spinner for the `verbum vod` command path on the same terms as the primary command.

**Acceptance**:
- Given `process.stderr.isTTY` is `false`
- When `verbum vod` runs
- Then stderr receives zero bytes from the spinner (verse still appears on stdout)

---

### REQ-11: No new dependencies

**Statement**: `package.json` SHALL NOT gain any new entries in `dependencies` or `devDependencies` as a result of this change.

**Rationale**: verbum has a strict no-utility-dep posture; a hand-rolled 40-line helper does not meet the threshold for a library dependency.

**Acceptance**:
- Given the change is applied
- When `git diff HEAD -- package.json` is inspected
- Then no lines are added to `dependencies` or `devDependencies`

---

### REQ-12: Unit test coverage surface

**Statement**: `src/cli/loading.test.ts` SHALL include tests covering at minimum:

| # | Scenario |
|---|----------|
| T1 | `isTTY=false` stream → no writes, fn result returned |
| T2 | `isTTY=true` stream, `interval:1` → at least one frame write occurs |
| T3 | `isTTY=true` stream, `interval:1` → last write is the cleanup sequence `"\r \r"` |
| T4 | `fn` rejects → cleanup write still occurs; rejection propagates |
| T5 | `NO_COLOR` set → no writes to stream |
| T6 | `FORCE_COLOR="0"` set → no writes to stream |
| T7 | `FORCE_COLOR="1"` and `isTTY=false` → writes occur (FORCE_COLOR wins) |

Each test MUST use a fake stream object (`{ isTTY: boolean, write: spy }`) — no monkey-patching of globals. Env-var mutation MUST be restored in `afterEach`.

**Rationale**: Establishes project convention for unit-testing animated CLI helpers without fake timers or global pollution.

**Acceptance**:
- Given `bun test src/cli/loading.test.ts` runs
- Then all tests pass and Bun reports zero open handle warnings

---

### REQ-13: Smoke test — no stderr bytes in non-TTY context

**Statement**: The smoke test suite (either `tests/vod-smoke.test.ts` extended or a new `tests/loading-smoke.test.ts`) SHALL include an assertion that when `process.stderr.isTTY` is `false`, zero bytes from spinner logic are written to stderr during a `withLoading`-wrapped call.

**Rationale**: Provides end-to-end proof that piped and redirected invocations remain byte-identical to the pre-change baseline.

**Acceptance**:
- Given `process.stderr.write` is monkey-patched in a `try/finally` block
- And the fake stderr has `isTTY: false`
- When `withLoading` is called with a fast-resolving `fn` (no real network)
- Then the spy records zero calls attributed to the spinner

---

## Out of Scope

| Item | Reason |
|------|--------|
| TUI loading state | Different mechanism via OpenTUI/React; separate future change |
| Determinate progress bars | Indeterminate spinner only in v1 |
| Custom themes or user-configurable frames | No config layer exists; frame array is internal |
| `--no-spinner` CLI flag | `NO_COLOR` + `isTTY` already cover all opt-out cases |
| Refactoring `isColorEnabled` to share code with `isSpinnerEnabled` | Intentional duplication; revisit if a third gate appears |
| Spinner for non-`getPassage` operations | Other awaits are sub-100ms; no user-visible gap |
| Replacing hand-rolled with `ora` or similar | Below the library threshold (~40 lines, zero maintenance burden) |
| Bun fake-timer infrastructure | Injectable `interval` parameter is the v1 strategy |
| ANSI clear-line escape (`\x1b[2K`) | `\r` + spaces is universally safe and sufficient |
| Accent color on spinner frame | Accent is reserved for structural signals in `renderPassage` |

---

## Spec-Level Risks

| Risk | Status |
|------|--------|
| `setInterval` interval fires before `fn` resolves in unit tests | Mitigated: tests inject `options: { interval: 1 }` for tick-sensitive cases; smoke tests use fast-resolving `fn` so interval never fires before `finally` |
| Bun concurrent test runner and global monkey-patching | Mitigated: follow existing pattern of serializing via `describe` blocks; unit tests use fake streams (no globals) |
| `frameWidth` assumption (1 char per Braille glyph) | Braille Unicode block glyphs are single code points and single columns in all modern terminals; no special handling needed |
| `NO_COLOR`/`FORCE_COLOR` env pollution between tests | Mitigated by `afterEach` restore pattern established in `ansi.test.ts` |
