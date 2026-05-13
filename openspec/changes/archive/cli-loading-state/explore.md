# Exploration — cli-loading-state

## TL;DR
- **What**: A shared `src/cli/loading.ts` helper that renders an animated spinner to **stderr** while a blocking async call runs, then clears the line before the caller writes output to stdout.
- **Where**: New file `src/cli/loading.ts`; consumed by `src/cli/run.ts` (line 39 — `getPassage` await) and `src/cli/vod.ts` (line 40 — `getPassage` await). No other files need changing.
- **API**: Async-wrapper form — `await withLoading(process.stderr, () => getPassage(repo, ref))` — is the cleanest fit. Reasoning in Design Space below.
- **Hand-rolled vs library**: Hand-rolled. verbum has zero utility deps (`zod`, `@opentui/*`, `react` are all product deps). A 30-line spinner is cheaper than `ora`'s 7-dep chain and a `package.json` entry that needs auditing forever.
- **Riskiest unknown**: Spinner interval leaking across test runs when stdout/stderr are monkey-patched. `clearInterval` in the finally block is mandatory; tests must be able to inject a fake clock or a no-op writer.

## Current State

### Files read

| File | What it does today | Gap |
|------|--------------------|-----|
| `src/cli/run.ts:39` | `await getPassage(repo, ref)` — blocks 1-3s, no feedback | blank terminal |
| `src/cli/vod.ts:40` | same `await getPassage(repo, ref)` — blocks 1-3s, no feedback | blank terminal |
| `src/cli/render.ts` | pure formatters: `renderPassage`, `renderParseError`, `renderRepoError`. Uses `isColorEnabled(stream)` gating. No IO side effects. | no gap |
| `src/cli/ansi.ts` | `isColorEnabled(stream)` reads `process.stdout.isTTY` / env-vars; `accent`, `dim`, `error`, `muted` pure wrappers. Already has the full TTY/env detection pattern. | no gap — reuse directly |
| `src/cli/ansi.test.ts` | Tests `isColorEnabled` via `{ isTTY: true/false }` cast + env-var mutation+restore with `beforeEach/afterEach`. | Pattern to clone for loading tests |
| `tests/vod-smoke.test.ts` | Monkey-patches `process.stdout.write` and `process.stderr.write` with try/finally restore. | Pattern to clone for loading tests |
| `package.json` | deps: `@opentui/core`, `@opentui/react`, `react`, `zod`. devDeps: `@types/figlet`, `@types/react`, `figlet`. **Zero utility deps.** | Cost of adding `ora` is non-zero |

### Network blocking point

Both commands call a single function: `getPassage(repo, ref)` from `src/application/get-passage.ts`, which delegates to `BibleRepository.getChapter` — the actual `fetch()` in `src/api/hello-ao-bible-repository.ts:32`. This is the **sole blocking point** in both commands. The spinner wraps exactly this `await`.

## Design Space

### 1. Where the helper lives

`src/cli/loading.ts` is correct. Rationale:

- It is a **presentation** concern, not domain or application. It writes to stderr, reads TTY state, manages timers — all IO-side-effects that belong in the CLI adapter layer.
- The existing CLI layer already has `ansi.ts` for ANSI escape helpers. `loading.ts` is a peer, not a sub-module.
- There is no existing `src/cli/presentation/` subdirectory and no pattern of subdirectories within `src/cli/`. Adding one for a single file would be premature structure.
- `src/presentation/cli/` would suggest a separate presentation layer outside the current hexagonal layout; the project does not have this concept.

**Decision**: `src/cli/loading.ts`.

### 2. Consumption API

Three options:

| Option | Signature | House rule verdict |
|--------|-----------|-------------------|
| Imperative start/stop | `const stop = startLoading(stderr); ... stop()` | Requires caller to manually call `stop()` in every return path — error-prone with multiple early returns in `run.ts` and `vod.ts`. |
| Async wrapper | `await withLoading(stderr, () => asyncFn())` | Single try/finally inside the helper guarantees cleanup. No callback persisted → no port concern (R3 says ports have no callbacks; this is NOT a port, it's a presentation utility). |
| Declarative/lifecycle | React-style hook | Inappropriate for CLI layer. R9 applies to TUI layer only; CLI is imperative. No framework here. |

**Decision: async wrapper** — `withLoading<T>(stream: NodeJS.WriteStream, fn: () => Promise<T>): Promise<T>`.

R3 note: R3 prohibits callbacks on **ports** (hexagonal interfaces between layers). `withLoading` is a CLI presentation utility — it never crosses the hexagonal boundary, it is not a port, and R3 explicitly covers `BibleRepository`-style interfaces. The callback here is a thunk for async execution, not an event handler on an interface. This is safe.

R9 note: R9 targets `useEffect` in the TUI React layer. CLI code is pure imperative TS with no React lifecycle. Not applicable.

### 3. Hand-rolled vs library

**Verdict: hand-rolled.**

Current dependency count: 4 prod deps (`@opentui/core`, `@opentui/react`, `react`, `zod`). verbum has a strict no-utility-dep posture (confirmed by absence of lodash, chalk, ora, etc.).

`ora` costs: 7 transitive deps, ESM-only (requires `"type": "module"` alignment check with Bun compile), ~15KB unpacked, version drift risk, audit surface.

Hand-rolled spinner cost: ~30 lines. Frame array (`["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]`), `setInterval` at 80ms, `\r` + frame + text on each tick, `\r` + spaces + `\r` on cleanup. Uses `isColorEnabled(stream)` already in `ansi.ts` to gate ANSI use. No new dependencies.

**The break-even for a library is when the hand-rolled version would exceed ~100 lines or require significant ongoing maintenance.** A spinner does not meet that bar.

### 4. TTY detection contract

`isColorEnabled` in `src/cli/ansi.ts` already implements the canonical detection:
1. `NO_COLOR` (non-empty) → disable
2. `FORCE_COLOR` (`"0"` or `"false"`) → disable; anything else non-empty → enable
3. Fallback: `stream.isTTY === true`

The loading helper needs a **separate but analogous** check: `isSpinnerEnabled(stream: NodeJS.WriteStream): boolean`. It should follow identical priority order. Reusing `isColorEnabled` directly would conflate "can render color" with "should animate" — these are independent. However, the implementation is identical in v1 (both defer to `isTTY`).

**When `isTTY` is false** (the helper is a no-op — no writes to stderr):
- `verbum john 3:16 > output.txt` — stdout redirected, stderr may still be TTY but stdout is not; spinner target is stderr so this case is actually fine. **Spinner on stderr is still valid here.**
- `verbum john 3:16 | wc` — stdout piped; stderr still a TTY. Spinner is valid.
- `verbum john 3:16 2>/dev/null` — stderr explicitly discarded; `process.stderr.isTTY` will be false. No spinner, no waste.
- CI environments — `CI=true` disables TTY allocation; `process.stderr.isTTY` is `undefined`/`false`. Correct: no spinner.
- Non-interactive shell scripts — TTY not allocated; `isTTY` is false. No spinner.

**Conclusion**: checking `process.stderr.isTTY` is the correct and sufficient gate. The spinner target is stderr, so stdout redirection does not interfere.

### 5. Render target

**stderr is correct.** Rationale:

- `run.ts` writes final verse text to **stdout** (`process.stdout.write(renderPassage(...) + "\n")`).
- `run.ts` writes errors to **stderr** (`process.stderr.write(renderParseError(...) + "\n")`).
- The spinner must not appear in stdout — it would corrupt `verbum john 3:16 | jq` or `> file.txt` pipelines.
- Writing spinner frames to stderr keeps stdout clean for downstream consumers.

Are there cases where stderr is also piped? Yes (`2>file` or `|&`). When stderr is redirected, `process.stderr.isTTY` is false → spinner is already suppressed. No special handling needed.

### 6. Cleanup contract

**Mechanism**: `\r` (carriage return) + spaces (to width of last frame string) + `\r`. This overwrites the spinner line without an ANSI clear-line escape, maximizing terminal compatibility.

ANSI clear-line (`\x1b[2K`) is more elegant but requires ANSI support. Using `\r` + spaces is universally safe and avoids a conditional.

**Line wrap risk**: if the spinner text + frame exceeds terminal width, the line wraps and `\r` only returns to the start of the current line, leaving an orphaned first line. Mitigation: keep spinner text short (e.g. `"  loading…"` — 10 chars) plus the frame (1 char) = 11 chars. Well within any realistic terminal width (minimum 40 cols). No truncation logic needed.

**Cleanup sequence** (must happen before any stdout/stderr writes from the caller):
```
clearInterval(handle)
stderr.write("\r" + " ".repeat(frameLen) + "\r")
```
The `withLoading` wrapper runs cleanup in `finally`, so it executes before the resolved/rejected value is returned to the caller.

### 7. Test approach

**Pattern already established** in `tests/vod-smoke.test.ts` and `src/cli/ansi.test.ts`:

For unit tests of `loading.ts`:
- Pass a fake stream `{ isTTY: false, write: () => true }` → assert helper is a no-op (no writes, just returns the fn result).
- Pass a fake stream `{ isTTY: true, write: captureFn }` → assert that write was called at least once (spinner rendered), and that cleanup write (`\r...`) was the last call.
- Use `beforeEach/afterEach` for `NO_COLOR`/`FORCE_COLOR` env-var mutation/restore (identical pattern to `ansi.test.ts`).

**Timer leak concern**: `setInterval` in the helper will tick during tests. Bun's test runner does not automatically fake timers. Options:
- Option A: pass an `interval` parameter (default 80ms) and set it to a large value in tests (e.g., 1_000_000ms) so ticks never fire during the test.
- Option B: use `Bun.spyOn` / manual mock for `setInterval` if Bun supports it.
- Option C: the wrapper resolves so fast in tests (no real network) that interval never ticks; cleanup still fires in `finally`. This is the simplest approach and matches how `vod-smoke.test.ts` works — the fn is sync/immediate in tests.

**Recommended**: Option C for smoke tests (fn resolves immediately, interval never fires). Option A for dedicated unit tests of spinner behavior (inject large interval to control tick timing).

For integration: existing smoke test pattern (`process.stderr.write` monkey-patch in try/finally) extends cleanly.

**Bun compatibility note**: Bun's test runner runs tests concurrently within a file. Monkey-patching `process.stderr.write` globally is not safe across concurrent tests. The existing smoke tests serialize via `describe` blocks (Bun runs `it` blocks within a `describe` sequentially). Continue this pattern.

### 8. Riskiest unknown

**Interval leak in tests.** If `withLoading` starts a `setInterval` and the test completes before cleanup fires, the interval continues ticking into the next test. In practice, `withLoading` always calls `clearInterval` in `finally`, so as long as `await withLoading(...)` is awaited (not fire-and-forget), cleanup is guaranteed before the test assertion. The risk is a test that does NOT await the call — this cannot happen given how the helper is used in `run.ts` and `vod.ts`.

Secondary risk: **terminal width assumption for cleanup**. Using `" ".repeat(N)` requires knowing `N`. We know the spinner text at construction time, so N = `frame.length + text.length`. This is computed inside the helper and is safe.

### 9. Existing patterns to reuse

- `isColorEnabled(stream)` from `src/cli/ansi.ts` — reuse the same logic (or extract a shared `isTTYEnabled(stream)` if we want semantic separation). The implementation is identical.
- Monkey-patch pattern for `process.stderr.write` from `tests/vod-smoke.test.ts` — reuse directly for loading tests.
- `ACCENT_OPEN` / `DIM_OPEN` from `src/cli/ansi.ts` if the spinner frame should be accent-colored (the DIM constant exists already for muted text).
- No existing spinner, loader, or progress helper exists in the codebase.

## Recommendation (single path forward)

Create `src/cli/loading.ts` exporting a single function `withLoading<T>(stream: NodeJS.WriteStream, fn: () => Promise<T>): Promise<T>`. Inside: check `stream.isTTY` (same logic as `isColorEnabled`), return `fn()` directly if false (no-op), otherwise start a `setInterval` at 80ms cycling through 10 Braille spinner frames written to `stream` via `\r`, then in `finally` clear the interval and overwrite the line with spaces. Modify `src/cli/run.ts:39` and `src/cli/vod.ts:40` to wrap the `getPassage` call with `withLoading(process.stderr, () => getPassage(repo, ref))`. The helper respects R1 (never throws — `fn`'s Result passes through unchanged), R5 (no new error types), R12 (returns `Promise<Result<T, E>>`), and R3 (not a port — it is a CLI presentation utility below the hexagonal boundary). Test surface: unit tests mirroring `ansi.test.ts` pattern + existing smoke tests extend cleanly via the monkey-patch pattern.

## Riskiest Unknown

Interval timer interaction with Bun's test runner. The `setInterval` must be cleared in `finally` before the resolved value propagates. Tests that pass an immediately-resolving function (the smoke test pattern) are safe because the interval never ticks before `finally` runs. Tests that deliberately test spinner output need to either use a large interval value or spy on `setInterval`/`clearInterval`. If the apply phase uses Option C (rely on fast test functions), no fake timer infrastructure is needed — this is the path of least resistance.

## Open Questions for Proposal Phase

1. **Spinner text copy**: what does the spinner say? `"  loading…"`, `"  fetching verse…"`, silent (frame only)? The proposal should lock down the exact string.
2. **Accent color on spinner**: should the spinner frame use the project accent color (`#5BA0F2`) via `ansi.ts`'s `ACCENT_OPEN`, or remain plain white? The accent is already used for emphasis; using it for the spinner frame is consistent but optional.
3. **`isSpinnerEnabled` vs reusing `isColorEnabled`**: proposal should decide whether to introduce a named `isSpinnerEnabled` function (clearer semantics) or inline the `stream.isTTY` check (simpler). The implementations are identical in v1.
4. **Test strategy for spinner output**: Option A (inject large interval) or Option C (rely on fast fn). Proposal should pick one and document it as the project convention for future animated helpers.
