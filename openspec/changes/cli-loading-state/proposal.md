# Proposal — cli-loading-state

## TL;DR

- Ship `withLoading<T>(stream, fn)` in `src/cli/loading.ts` — a hand-rolled, stderr-only Braille spinner that wraps the single `getPassage` await in `run.ts` and `vod.ts`.
- First reviewable cut: one PR, ~5 files touched, ~30 lines of logic + unit tests + a smoke assertion that piped stderr stays empty.
- Success: `verbum john 3:16` shows an animated spinner on stderr during fetch; `verbum john 3:16 | jq` and `verbum john 3:16 2>/dev/null` produce byte-identical output to today; `bun test` stays green with no timer leaks across files.
- Riskiest unknown: `setInterval` outliving the test that started it. Mitigated by `finally`-clear + an injectable `interval` parameter for the one test that exercises a real tick.

## Intent

Today, after the user types `verbum john 3:16` and presses enter, the terminal sits blank for 1–3 seconds while `getPassage` fetches over the network, then the verse text appears all at once. There is no signal that work is happening — indistinguishable from a hung process on a slow connection. After this change, the same command writes a spinner frame (Braille `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) to **stderr** every 80 ms while the fetch is in flight, then erases the spinner line cleanly so the verse text lands on stdout exactly as it does today — pristine, pipeable, redirect-safe. In non-TTY contexts (CI, `2>/dev/null`, scripts) the helper is a strict no-op: zero stderr writes, zero behavior change.

## First Reviewable Cut

- [ ] Create `src/cli/loading.ts` exporting `withLoading<T>(stream: NodeJS.WriteStream, fn: () => Promise<T>, options?: { interval?: number }): Promise<T>`
- [ ] Create `src/cli/loading.test.ts` with unit tests covering: no-op when `isTTY=false`, write-then-cleanup when `isTTY=true`, cleanup runs when `fn` rejects, `NO_COLOR`/`FORCE_COLOR` env-var override behavior
- [ ] Modify `src/cli/run.ts:39` — wrap `getPassage(repo, ref)` with `withLoading(process.stderr, () => getPassage(repo, ref))`
- [ ] Modify `src/cli/vod.ts:40` — wrap the same call identically
- [ ] Extend `tests/vod-smoke.test.ts` (or add a sibling `tests/loading-smoke.test.ts`) to assert: captured stderr is empty when the smoke test's fake stream reports `isTTY=false`, proving redirected pipelines stay byte-clean

No other files change. No new dependencies. No package.json edits.

## Success Criterion

A reviewer can run each line below and observe the stated outcome:

- `verbum john 3:16` in an interactive terminal → animated spinner on stderr during fetch, single clean line of verse text on stdout after fetch resolves
- `verbum john 3:16 2>/dev/null` → stdout shows the verse, no spinner artifacts anywhere (stderr discarded, but no escape codes leaked to stdout)
- `verbum john 3:16 > out.txt` → `out.txt` contains only the verse text, byte-identical to today's output
- `verbum john 3:16 | wc -c` → exit 0, byte count matches today's output (stdout untouched)
- `CI=true verbum john 3:16` in a non-TTY harness → no spinner frames written to stderr
- `NO_COLOR=1 verbum john 3:16` → no spinner frames (spinner gate honors `NO_COLOR` exactly like `isColorEnabled` does)
- `bun test` passes including new `src/cli/loading.test.ts` and the smoke addition; no "Bun detected a timer that was not cleared" warnings; total test time does not regress
- `verbum vod` exhibits identical spinner behavior (the helper is the only change to that path)

## Riskiest Unknown

`setInterval` outliving the test that started it. If `withLoading` starts a 80 ms interval and the test under `bun test` finishes asserting before `finally` clears it, the interval ticks into the next test in the file, randomly polluting stderr captures and possibly tripping Bun's open-handle warning at process exit.

Mitigation, layered:

1. **Always-on**: `withLoading` calls `clearInterval` in `finally`, which runs before the `await` returns to the caller. As long as the test `await`s the wrapper (which it must, because the helper returns `Promise<T>` and callers consume `T`), cleanup is guaranteed before the next assertion.
2. **Test-side**: the `interval` option (default `80`) lets the one unit test that wants to exercise a real tick pass `interval: 1` (force immediate tick) or `interval: 1_000_000` (guarantee no tick during the test body). This keeps the production default invisible while making timing-sensitive tests deterministic.
3. **Smoke-side**: smoke tests pass a fast-resolving `fn` (no real network) — the interval never fires, `finally` clears it, no observable timer artifact.

If despite all this `bun test` reports leaked handles after apply, the fallback is `Bun.spyOn(globalThis, "setInterval")` — but this is not the v1 plan.

## Decisions Locked

### Spinner text copy

**Decision**: `""` — frame only, no text.

**Rationale**: The spinner's job is to signal "work is happening." A single Braille glyph already does that; adding `"  loading…"` or `"  fetching verse…"` doubles the visual footprint without adding information, and pulls vocabulary into the CLI that we would then have to localize and audit when the API surface changes (e.g. when a future cache hit makes "fetching" a lie). Frame-only also dodges the line-wrap edge case entirely — 1 character is unambiguously safe at any terminal width. The `cognitive-doc-design` rule "lead with the decision, not the context" applies to UI too: silence is the minimum signal.

### Accent color on spinner frame

**Decision**: No. Plain default-foreground frame.

**Rationale**: The `#5BA0F2` accent is reserved as a **structural** signal in `renderPassage` (reference labels, emphasis points). Using it on the spinner — a transient, non-structural element — dilutes that role. Plain monochrome also avoids a second branch in the helper (`isColorEnabled` vs `isSpinnerEnabled`) and keeps the spinner readable on terminals where `#5BA0F2` is close to the background. If a future change introduces a deliberate "in-flight" color token, the spinner can adopt it then; today there is no such token, and inventing one for a transient glyph is premature.

### Spinner gate function (`isSpinnerEnabled` vs inline `stream.isTTY`)

**Decision**: Introduce `isSpinnerEnabled(stream: NodeJS.WriteStream): boolean`, exported from `src/cli/loading.ts` (NOT `ansi.ts`).

**Rationale**: This is a deliberate deviation from the exploration's default recommendation (inline `stream.isTTY`). The reason: `simplify` says reuse before abstraction, but it also says question every new abstraction. Inline `stream.isTTY` skips the `NO_COLOR` / `FORCE_COLOR` priority chain that `isColorEnabled` already honors — and the Success Criterion explicitly tests `NO_COLOR=1 verbum john 3:16`. A bare `stream.isTTY` check would fail that test. The choices are:

| Option | Result |
|--------|--------|
| Inline `stream.isTTY` only | Spinner ignores `NO_COLOR` → fails Success Criterion |
| Call `isColorEnabled` from `loading.ts` | Conflates "should color" with "should animate" — defensible today, awkward when these diverge (e.g. if `NO_COLOR=1` should keep the spinner but disable color) |
| `isSpinnerEnabled` exported from `loading.ts`, implementation identical to `isColorEnabled` | Clear semantic boundary, ~5 lines duplicated but each function has a single responsibility, future divergence is a 5-line edit not an API change |

Three similar lines is fine (`simplify`), but the responsibilities differ. House-rule note: no rule is violated — this is a CLI presentation helper, not a port (R3 N/A), not a domain function (R1/R4/R12 N/A).

### Test strategy

**Decision**: Both — Option A (injectable `interval` parameter) for `src/cli/loading.test.ts`, Option C (rely on fast-resolving `fn`) for the smoke addition in `tests/`.

**Rationale**: Option C alone cannot test the spinner actually rendering a frame (the `fn` resolves before the first tick fires), and Option A alone overspecifies the smoke surface. Pairing them gives:

- Unit (`loading.test.ts`): inject `interval: 1` to force a tick, capture writes to the fake stream, assert the last write is the cleanup sequence (`\r` + spaces + `\r`). Inject `interval: 1_000_000` for tests that only care about gate behavior and want zero ticks. Deterministic, no timer leak.
- Smoke (`tests/`): pass a real-shaped `fn` that resolves synchronously, prove the wrapper is transparent to the caller's contract (Result flows through unchanged, stdout stays clean). The interval starts and is cleared by `finally` before the assertion runs — exactly like the existing `vod-smoke.test.ts` pattern.

This establishes the project convention: animated CLI helpers expose a timing parameter for unit testability, but smoke/integration tests rely on fast functions and `finally`-cleanup, not fake clocks.

## Affected Files

| File | Action | Rough size |
|------|--------|-----------|
| `src/cli/loading.ts` | create | ~40 lines (helper + `isSpinnerEnabled` + frame array) |
| `src/cli/loading.test.ts` | create | ~80 lines (5–7 tests, env-var setup/teardown, fake stream) |
| `src/cli/run.ts` | modify | 1 line wrap at line 39 + 1 import |
| `src/cli/vod.ts` | modify | 1 line wrap at line 40 + 1 import |
| `tests/vod-smoke.test.ts` OR `tests/loading-smoke.test.ts` | modify or create | ~15 lines for the redirected-pipeline assertion |

Total: ~140 lines added, 2 lines modified, 2 imports added. Well within a single PR's review budget.

## House Rules Compliance

- **R1** (no throw in domain) — N/A; `loading.ts` is presentation. `withLoading` does not throw on its own; if `fn` rejects, the rejection propagates unchanged. Cleanup runs in `finally` regardless.
- **R2** (no `class` outside `src/tui/`) — Respected. Helper is a plain function.
- **R3** (ports have no callbacks) — Respected. `withLoading` is NOT a port; it is a CLI presentation utility below the hexagonal boundary. The `fn` parameter is a thunk for async execution, not an event-handler interface. R3 explicitly targets cross-layer interfaces (`BibleRepository` style).
- **R4** (Zod stays in `src/api/`) — N/A; no validation involved.
- **R5** (errors as discriminated unions) — Respected. No new error types introduced; existing `getPassage` Result flows through.
- **R6** (branded IDs via single factory) — N/A.
- **R7** (no conditional/mapped/template-literal types in domain/application) — N/A; `loading.ts` is presentation. Helper signature uses a single generic `T`.
- **R8** (TUI business state in `useReducer`) — N/A; CLI has no React state.
- **R9** (no `useEffect` for business logic) — N/A; CLI is imperative. The spinner uses `setInterval` directly in the helper, which is the correct primitive for CLI animation.
- **R10** (action names past-tense) — N/A; no actions involved.
- **R11** (no decorators) — Respected.
- **R12** (async data fns return `Promise<Result<T, E>>`) — Respected. `withLoading<T>` is a presentation wrapper; the `T` it returns is whatever `fn` returns, which in the consumer call sites is `Result<Passage, GetPassageError>`. The wrapper does not re-shape the Result — it is transparent to it.

Exceptions called out: none.

## Out of Scope

- Loading state for any future TUI screens (this is CLI-only; TUI uses OpenTUI/React and will need a different mechanism)
- Progress percentage or determinate progress bars (indeterminate spinner only)
- Custom themes or user-configurable spinner frames
- Multi-line layouts, gradient frames, or any fancy rendering
- A `--no-spinner` flag (`NO_COLOR` and `isTTY` already provide opt-out)
- Refactoring `isColorEnabled` to share implementation with `isSpinnerEnabled` (duplication is intentional today; revisit if a third gate appears)
- Spinner for any non-`getPassage` operation (other awaits in the codebase are sub-100ms and do not need feedback)
- Replacing the hand-rolled spinner with `ora` or another library
- Bun fake-timer infrastructure (the injectable `interval` parameter is the v1 strategy)

## Open Questions

None. All four exploration questions are decided above.
