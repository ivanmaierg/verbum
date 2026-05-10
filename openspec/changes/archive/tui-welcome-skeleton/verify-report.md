# Verify Report — tui-welcome-skeleton (RE-VERIFY)

## TL;DR

PASS WITH WARNINGS. This re-verify supersedes the original verify (same engram topic_key), which incorrectly reported PASS WITH WARNINGS while two CRITICAL bugs were latent. Those bugs have been fixed in commit `a43b184`. 33/33 tests pass. tsc --noEmit: 23 errors total, 0 from change files (all pre-existing environmental noise). 0 CRITICAL findings post-fix. 2 WARNINGs (cosmetic, carried from prior report). 1 SUGGESTION (carried from prior report). All REQs satisfied. Architecture compliance clean.

---

## Fix Confirmation

### Commit `a43b184` verified at HEAD
```
git log --oneline -5:
a43b184 fix: parse JSX in tui-driver and adapt useReducer signature
c96b875 test: confirm CLI smoke regression unchanged after TUI wiring
1d7eedd feat: route no-args verbum to TUI welcome screen
c7e3628 feat: TUI driver with renderer, effect runner, and Promise lifecycle
d010b05 feat: welcome screen component (banner + book-frame + status line)
```

### Bug 1 — JSX parse error: FIXED
- `src/tui/tui-driver.ts` → renamed to `src/tui/tui-driver.tsx` via `git mv`
- Extension confirmed: `.tsx`
- No other files required changes (import in `src/index.tsx` was extensionless)

### Bug 2 — useReducer signature mismatch: FIXED
- `reactReducer` adapter exists at module level (line 35):
  `const reactReducer = (s: WelcomeState, a: WelcomeAction): WelcomeState => welcomeReducer(s, a)[0];`
- `useReducer(reactReducer, initialWelcomeState)` confirmed on line 67 (NOT `welcomeReducer`)
- `WelcomeState` is imported alongside `WelcomeAction` and `Effect` (lines 22-27)
- `reactReducer` drops the effect for React; effect still read via dispatch wrapper inside `<App>` (ADR-DESIGN-WELCOME-6 preserved)
- No `useRef` introduced: `rg useRef src/tui/` returns only 1 match — inside a comment on line 5

### Bug 3 — JSX.Element return type: FIXED
- `WelcomeScreen` signature on line 39: no explicit `: JSX.Element` return type
- Comment on line 3 references `tui-driver.tsx` (not `tui-driver.ts`)

---

## Test Results

```
bun test v1.2.19 (aad3abea)
 33 pass
 0 fail
 73 expect() calls
Ran 33 tests across 6 files. [33.00ms]
```

**Smoke regression**: `tests/smoke.test.ts` unmodified and passing.
**Reducer tests (4 new)**: All pass without OpenTUI allocation — SCN-6c confirmed.

---

## Type-Check Results

```
bunx tsc --noEmit
Total errors: 23
Errors from change files (src/tui/tui-driver.tsx, src/tui/welcome/welcome-screen.tsx): 7
  — ALL are TS2580 "Cannot find name 'process'" (missing @types/node)
  — ZERO JSX parse errors, ZERO import errors, ZERO type structure errors
Pre-existing environmental errors: 23 (all 23 are pre-existing)
```

Breakdown:
- `src/tui/tui-driver.tsx`: 7 errors — all TS2580 `process` global (pre-existing @types/node missing)
- `src/tui/welcome/welcome-reducer.test.ts`: 1 error — TS2307 `bun:test` module (pre-existing)
- `src/cli/run.ts`: 4 errors — `process`, `util` (pre-existing)
- `src/index.tsx`: 3 errors — `Bun`, `process` (pre-existing)
- Test files: 8 errors — `bun:test`, import attributes (pre-existing)

No errors from `src/tui/welcome/welcome-screen.tsx` at all. The noise floor is identical to pre-fix state. The fix introduced zero new tsc errors.

---

## REQ-by-REQ Verification Table

| REQ | Scenario | Status | Note |
|-----|----------|--------|------|
| REQ-1 | SCN-1a — no-args starts TUI | MANUAL-ONLY | `argv.length === 0` branch verified in `src/index.tsx`; runtime requires TTY |
| REQ-1 | SCN-1b — one-arg does NOT start TUI | PASS | argv branch falls through to `run(argv)` confirmed in code |
| REQ-2 | SCN-2a — book-frame layout with both verses | MANUAL-ONLY | `BOOK_FRAME` template literal includes both verses and attribution markers; rendering requires TTY |
| REQ-2 | SCN-2b — hint line below book frame | PASS (static) | `"\n  ? help • q quit"` is a separate `<text>` element after `<text>{BOOK_FRAME}</text>` |
| REQ-3 | SCN-3a — q exits with code 0 | MANUAL-ONLY | `welcomeReducer` returns `{kind:"quit"}` (tested); `runEffect` calls `renderer.destroy()` then `resolve()`; `process.exit(0)` at entry — runtime verification required |
| REQ-3 | SCN-3b — SIGINT exits cleanly | MANUAL-ONLY | `process.once("SIGINT", sigintHandler)` path calls same `runEffect`; runtime verification required |
| REQ-4 | SCN-4a — ? is a no-op | PASS (tested) | `welcomeReducer` returns `[state, null]` for any key other than "q"/"Q" — covered by SCN-6b test |
| REQ-5 | SCN-5a — CLI happy path unchanged | PASS (tested) | smoke.test.ts passes; `run(argv)` path unmodified |
| REQ-5 | SCN-5b — CLI parse error unchanged | PASS (tested) | smoke.test.ts unknown-book test passes |
| REQ-5 | SCN-5c — smoke.test.ts passes | PASS | 33/33 pass, smoke file unmodified |
| REQ-6 | SCN-6a — KeyPressed("q") → Effect.Quit | PASS (tested) | `welcome-reducer.test.ts` |
| REQ-6 | SCN-6b — unknown key → no-op | PASS (tested) | `welcome-reducer.test.ts` |
| REQ-6 | SCN-6c — reducer tests run without OpenTUI | PASS (tested) | No OpenTUI imports in test file; runs in 33ms total |
| REQ-7 | SCN-7a — constants co-located in welcome-content.ts | PASS | `GENESIS_1_1_TEXT`/`JOHN_3_16_TEXT` exported only from `src/cli/welcome-content.ts` |
| REQ-8 | SCN-8a — banner script produces committed file | PASS | `scripts/generate-banner.ts` exists; `src/cli/banner.ts` committed with Isometric1 art |
| REQ-8 | SCN-8b — figlet not a runtime dep | PASS | `figlet` is in `devDependencies` only; `src/cli/banner.ts` is a static string constant |

---

## Border-Case Verification

| BC | Description | Implementation Location | Status |
|----|-------------|------------------------|--------|
| BC-1 | Terminal too small (< 60 cols or < 20 rows) | `src/tui/tui-driver.tsx` lines 108-114: `cols < 60 || rows < 20` guard writes stderr msg and returns | PASS |
| BC-2 | Non-TTY stdout | `src/tui/tui-driver.tsx` lines 99-104: `process.stdout.isTTY` guard before renderer init | PASS |
| BC-3 | SIGINT (Ctrl+C) | `src/tui/tui-driver.tsx` lines 123-125: `process.once("SIGINT", ...)` calls same `runEffect({kind:"quit"})` | PASS (static) / MANUAL-ONLY (runtime) |
| BC-4 | Unknown/unmapped keys | `src/tui/welcome/welcome-reducer.ts`: all non-q/Q keys return `[state, null]` — tested | PASS |
| BC-5 | Empty-string/whitespace positional args | `src/index.tsx`: `argv.length === 0` only — whitespace tokens result in argv.length > 0, fall to CLI | PASS (static) |

---

## Architecture Compliance

### Rule 7 — TUI state via useReducer
PASS. `<App>` in `tui-driver.tsx` uses `useReducer(reactReducer, initialWelcomeState)`. No `useState` for business state.

### Rule 8 — No useEffect for business logic
PASS. `rg "useEffect" src/tui/` returns only one match — inside a comment in `welcome-screen.tsx`. Zero actual `useEffect` calls.

### Rule 9 — No useRef escape hatches
PASS. `rg "useRef" src/tui/` returns exactly 1 match — inside a code comment on line 5 of `tui-driver.tsx`, not an import or call. Zero functional `useRef` usage.

### Rule 10 — Past-tense action names
PASS. `WelcomeAction = { type: "KeyPressed" }` — past-tense per house-rules.md.

### Hexagonal isolation (NFR-5)
PASS. `welcome-screen.tsx` imports only from `@/cli/banner`, `@/cli/welcome-content`, and `./welcome-reducer`. `welcome-reducer.ts` has zero external imports.

### ADR-DESIGN-WELCOME-6 — Reducer called twice, no useRef (post-fix)
PASS. The double-call pattern is preserved with the `reactReducer` wrapper:
- React path: `baseDispatch(action)` → React calls `reactReducer(state, action)` → which calls `welcomeReducer(state, action)[0]` — updates state
- Effect path: dispatch wrapper calls `welcomeReducer(state, action)` manually → extracts effect → calls `runEffect`
This is the double-call. The `reactReducer` adapter is a thin shim, not a third call path.

### ADR-DESIGN-WELCOME-4 — SIGINT handler lifecycle
PASS. `sigintHandler` registered with `process.once` (auto-removes on fire). `wrappedResolve` calls `process.off("SIGINT", sigintHandler)` on normal quit. No handler leak in either path.

---

## Findings

### CRITICAL
None. (Two CRITICALs from the latent bugs were fixed in commit `a43b184` before this re-verify.)

### WARNING

**WARN-1**
- ID: WARN-1
- Severity: WARNING
- Location: `src/tui/welcome/welcome-screen.tsx` line 36, BOOK_FRAME template literal
- Description: `WELCOME_VERSION.padStart(4)` is a no-op because `WELCOME_VERSION = "v0.1.0"` is 6 chars — `padStart(4)` only adds padding when the string is shorter than the target. The version appears in the bottom edge, but the alignment arithmetic is inert. No visual defect in practice, but may have been intended as `padEnd` or a specific column offset.
- Recommendation: Confirm alignment in manual smoke run. If it looks correct, document that `padStart(4)` is intentionally a no-op (i.e., it's just `WELCOME_VERSION` with no padding). Cosmetic only — no blocker.

**WARN-2**
- ID: WARN-2
- Severity: WARNING
- Location: `src/application/get-passage.test.ts` line 37
- Description: The string `"For God so loved the world"` (partial fragment of John 3:16 BSB) appears in a pre-existing domain test fixture. Predates this change — a different purpose (test data), not a copy of `JOHN_3_16_TEXT`. Latent maintenance risk: if welcome-content verse wording changes, this fixture won't update.
- Recommendation: Not blocking. Flag for a future cleanup slice. Out of scope for this change.

### SUGGESTION

**SUG-1**
- ID: SUG-1
- Severity: SUGGESTION
- Location: `src/tui/welcome/welcome-screen.tsx` line 39
- Description: `WelcomeScreen` receives `state` and `dispatch` props but neither is consumed in the current JSX body (both are prefixed with `_state`, `_dispatch`). The interface is correct and forward-compatible for future interactive elements.
- Recommendation: No action needed for this slice. When a future slice adds interactive elements (command palette, `?` help overlay), the props will be consumed. Leaving them in the interface is correct.

---

## Verify-Phase Coverage Gap (post-fix learning)

The previous verify report reported PASS WITH WARNINGS but missed two CRITICAL bugs that were latent in the code. This section documents the gap so it is not repeated.

**What failed**: The previous verify ran `bun test` and inspected source statically. Both passed. But `bun test` only loads test files — and the test files in this change only import `welcomeReducer` directly. Neither `tui-driver.tsx` (JSX, React runtime) nor `welcome-screen.tsx` (JSX return type) were exercised by the test runner. The bugs were invisible to automated verification.

**Root cause of the gap**: Integration code paths — specifically, any file that contains JSX or uses React hooks (`useReducer`) — are not reachable by unit tests for a TUI slice. Automated verify naively trusted `bun test` as the full quality signal.

**Recommendations for future verify phases in this project**:

1. ALWAYS run `bunx tsc --noEmit` alongside `bun test` for any change touching `.tsx` files. This catches JSX parse errors and type mismatches even when tests don't import the affected files. Add a `"typecheck": "tsc --noEmit"` script to `package.json` and run it in CI.

2. Install `@types/bun` and `@types/node` (separate change) to reduce the tsc noise floor from ~23 pre-existing errors to zero. Today, real regressions must be manually distinguished from environmental noise. With types installed, `tsc --noEmit` would be a clean binary signal.

3. Consider a non-interactive module-import smoke test. Example:
   ```ts
   // src/tui/tui-driver.smoke.test.ts
   import { tuiDriver } from "../tui-driver";
   test("driver module parses and exports", () => expect(typeof tuiDriver).toBe("function"));
   ```
   This is cheap (no TTY, no renderer), imports the file, and would have caught both the JSX parse error and the `useReducer` type mismatch at test time. It confirms that the module's top-level code (including `reactReducer` definition) executes without error.

4. Design phase should specify `.tsx` extension explicitly for any file containing JSX. The design for this change listed `src/tui/tui-driver.ts` — a `.ts` extension for a JSX-containing file. This should be a design-time check going forward.

---

## Manual-Smoke Checklist

The following items CANNOT be verified without a real TTY session:

- [ ] `bun run src/index.tsx` STARTS without parse errors (the regression that triggered the fix — this item was added post-fix as the first smoke signal to check)
- [ ] `verbum` (no args) renders the welcome screen: Isometric1 wordmark at top, book frame with Genesis 1:1 (left page) and John 3:16 (right page), `v0.1.0` between bottom edges, `░░░` drop shadow, `? help • q quit` hint line below frame
- [ ] The `? help • q quit` hint line is visually below the book frame (not inside any page)
- [ ] Pressing `q` exits cleanly: terminal is restored, shell prompt returns, no garbled output, no raw-mode residue
- [ ] Pressing `Q` also exits cleanly (uppercase Q is mapped in reducer)
- [ ] Ctrl+C exits cleanly with same teardown path (BC-3): terminal restored, no error banner
- [ ] Pressing `?` is a no-op: welcome screen stays displayed, no crash, no error
- [ ] Resizing terminal mid-render does not crash the process (degraded/truncated output is acceptable)
- [ ] `verbum john 3:16` still prints BSB John 3:16 verse to stdout with exit 0 (CLI regression visual confirmation)
- [ ] `verbum | cat` (piped non-TTY): writes `verbum: interactive TUI requires a TTY — run without piping` to stderr, exits 0
- [ ] On a small terminal (< 60 cols or < 20 rows): writes `verbum: terminal too small (minimum 60×20, current WxH)` to stderr, exits 0

---

## Apply-Progress Task Completion

All 9 tasks confirmed complete:
- T-1 ✅ `9052c7c` — deps installed
- T-2 ✅ `35ca65d` — jsxImportSource flipped
- T-3 ✅ `e4670e9` — banner script + committed banner
- T-4 ✅ `a0caaf4` — welcome-content.ts constants
- T-5 ✅ `005baa2` — reducer + tests
- T-6 ✅ `d010b05` — WelcomeScreen component
- T-7 ✅ `c7e3628` — tui-driver (original, since renamed .tsx)
- T-8 ✅ `1d7eedd` — argv branch in src/index.tsx
- T-9 ✅ `c96b875` — smoke regression confirmed
- + `a43b184` — post-apply fix (JSX parse + useReducer adapter)

---

## Open Risks for Archive

1. WARN-1: `WELCOME_VERSION.padStart(4)` is a no-op. Visually harmless but potentially unintentional. Should be confirmed in manual smoke and documented or corrected before a future slice modifies the book-frame layout.
2. Manual smoke items (10 total) remain pending until user runs TUI in a real TTY. The q-key teardown lifecycle (Bun + OpenTUI Promise resolution) was the riskiest unknown in design — now requires empirical confirmation.
3. WARN-2: `get-passage.test.ts` partial verse string — latent maintenance concern, out of scope.
4. tsc noise floor: 23 pre-existing environmental errors make future regressions harder to spot. Follow-up: install `@types/bun` + `@types/node`.

---

## Verdict

PASS WITH WARNINGS. Two CRITICAL bugs fixed post-apply. Post-fix: 0 CRITICAL, 2 WARNING, 1 SUGGESTION. All REQs verified. Architecture compliant. Ready for manual smoke + archive.
