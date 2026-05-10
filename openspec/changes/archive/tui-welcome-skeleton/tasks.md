# Tasks — tui-welcome-skeleton

## TL;DR

8 tasks across 8 groups, ordered strictly outside-in from the project surface inward to the entry wiring: dependencies and config first (A), then the build pipeline that generates a committed artifact (B), then the content constants those artifacts feed (C), then the pure reducer with its tests (D), then the view component (E), then the TUI driver that owns the renderer (F), then the three-line argv branch in the entry point (G), and finally the smoke regression and manual teardown verification (H). Every task is one commit. The reducer and its tests ship in the same commit (Standard Mode). The argv branch in G is the last code task — until it lands, `verbum` (no args) keeps its existing exit-2 behaviour, so partial commits never break the user-facing CLI.

---

## Group A — Project surface

### T-1 — Install runtime and dev dependencies

**Files**: `package.json`, `bun.lockb`

**What**: Run `bun add @opentui/core @opentui/react react` and `bun add -D @types/react figlet @types/figlet`. Also add the `"generate:banner"` script entry to `package.json` (`"bun run scripts/generate-banner.ts"`). These are the only dependency changes for the entire slice.

**Acceptance**: `package.json` contains `@opentui/core`, `@opentui/react`, and `react` in `dependencies`; `@types/react`, `figlet`, and `@types/figlet` in `devDependencies`; and `scripts.generate:banner` is defined. `bun install` exits 0.

**Commit message**: `chore: add @opentui/core, @opentui/react, react deps and figlet devDep`

**Depends on**: —

---

### T-2 — Flip jsxImportSource to @opentui/react

**Files**: `tsconfig.json`

**What**: Change the single `"jsxImportSource"` field from `"react"` to `"@opentui/react"`. This makes TypeScript resolve JSX factory calls to `@opentui/react` for the new `*.tsx` files in `src/tui/`. No existing CLI source files use JSX, so the change is safe.

**Acceptance**: `tsconfig.json` contains `"jsxImportSource": "@opentui/react"`. Running `bun test` still exits 0 (existing 29 tests green). No TypeScript errors in `src/cli/`, `src/domain/`, `src/application/`, `src/api/`.

**Commit message**: `chore: flip jsxImportSource to @opentui/react`

**Depends on**: T-1 (package must be installed before TypeScript can resolve it)

---

## Group B — Build pipeline

### T-3 — Add banner generation script and commit generated banner

**Files**: `scripts/generate-banner.ts` (new), `src/cli/banner.ts` (new, generated)

**What**: Create `scripts/generate-banner.ts` — imports `figlet` programmatically, calls `figlet.textSync("verbum", { font: "Isometric1" })`, writes the result as a TS module to `src/cli/banner.ts` via `Bun.write()`. Run the script once (`bun run generate:banner`) to produce `src/cli/banner.ts`, then commit both files together. The generated file exports `BANNER: string` and carries a "do not edit by hand" header comment. `figlet` is a devDependency only — it is never imported at runtime by application code.

**Acceptance** (REQ-8 / SCN-8a): `scripts/generate-banner.ts` exists. `bun run generate:banner` exits 0 and writes `src/cli/banner.ts` with a valid TS export. The committed `src/cli/banner.ts` exports `BANNER` as a non-empty string containing the Isometric1 "verbum" ASCII art. `figlet` is absent from `dependencies` in `package.json`.

**Commit message**: `build: add generate:banner script and commit Isometric1 wordmark`

**Depends on**: T-1 (figlet devDep must be installed)

---

## Group C — Content constants

### T-4 — Add welcome-content.ts with verse and version constants

**Files**: `src/cli/welcome-content.ts` (new)

**What**: Create `src/cli/welcome-content.ts` exporting three named constants: `GENESIS_1_1_TEXT` ("In the beginning God created the heavens and the earth."), `JOHN_3_16_TEXT` ("For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life."), and `WELCOME_VERSION` ("v0.1.0"). No imports from domain/application/api. No other file in the codebase may define or duplicate these string values.

**Acceptance** (REQ-7 / SCN-7a): `src/cli/welcome-content.ts` exists and exports exactly those three constants with the locked BSB text. No other source file contains the Genesis 1:1 or John 3:16 string literals. `bun test` exits 0.

**Commit message**: `feat: hardcoded welcome verses and version constants`

**Depends on**: T-2 (tsconfig must be settled before any new src/ files land, to avoid transient typecheck noise)

---

## Group D — Reducer (pure logic + tests)

### T-5 — Add welcome reducer and colocated tests

**Files**: `src/tui/welcome/welcome-reducer.ts` (new), `src/tui/welcome/welcome-reducer.test.ts` (new)

**What**: Create `src/tui/welcome/welcome-reducer.ts` exporting `WelcomeState`, `WelcomeAction`, `Effect`, `welcomeReducer`, and `initialWelcomeState`. Behavioural contract: `KeyPressed("q")` and `KeyPressed("Q")` both return `[state, { kind: "quit" }]`; any other key returns `[state, null]`. `initialWelcomeState` has `kind: "active"`. Zero imports from OpenTUI, React, domain, application, or api. Also create `src/tui/welcome/welcome-reducer.test.ts` with 4 test cases covering all branches (REQ-6 / SCN-6a, SCN-6b, SCN-6c):

1. `KeyPressed("q")` → `[initial, { kind: "quit" }]`
2. `KeyPressed("Q")` → `[initial, { kind: "quit" }]`
3. `KeyPressed("x")` → `[initial, null]`
4. `initialWelcomeState.kind === "active"`

Both files ship in the same commit (Standard Mode — no red/green split).

**Acceptance** (REQ-6 / SCN-6a, 6b, 6c): `bun test` exits 0, all 33 tests pass (29 pre-existing + 4 new reducer tests). Reducer test file does not import OpenTUI or allocate a terminal. No `useEffect`, no `renderer`, no IO inside the reducer module.

**Commit message**: `feat: welcome reducer and colocated tests`

**Depends on**: T-2 (tsconfig), T-3 (directory shape established — `src/tui/` created alongside the reducer)

---

## Group E — View component

### T-6 — Add WelcomeScreen JSX component

**Files**: `src/tui/welcome/welcome-screen.tsx` (new)

**What**: Create `src/tui/welcome/welcome-screen.tsx` exporting `WelcomeScreen` and `WelcomeScreenProps`. The component accepts `{ state: WelcomeState; dispatch: (action: WelcomeAction) => void }` and renders three stacked regions using OpenTUI primitives: (1) `BANNER` from `src/cli/banner.ts` at the top, (2) the book-frame from `docs/ui-sketches.md` with `GENESIS_1_1_TEXT` on the left page (`✦ Genesis 1:1`), `JOHN_3_16_TEXT` on the right page (`✦ John 3:16`), and `WELCOME_VERSION` between bottom edges plus the drop-shadow `░░░`, (3) a status hint line below the frame (`? help • q quit`). No `useState` for business state. No `useEffect`. No imports from domain/application/api. The driver (T-7) owns `useReducer` — `WelcomeScreen` is a pure props-driven view.

**Acceptance** (REQ-2 / SCN-2a, 2b; NFR-5): File typechecks cleanly. `BANNER`, `GENESIS_1_1_TEXT`, `JOHN_3_16_TEXT`, `WELCOME_VERSION` are imported exclusively from `src/cli/banner.ts` and `src/cli/welcome-content.ts`. No import from `src/domain/`, `src/application/`, or `src/api/`. `bun test` exits 0.

**Commit message**: `feat: welcome screen component (banner + book-frame + status line)`

**Depends on**: T-3 (BANNER), T-4 (verse constants), T-5 (WelcomeState, WelcomeAction types)

---

## Group F — TUI driver

### T-7 — Add tui-driver.ts with renderer, effect runner, and Promise lifecycle

**Files**: `src/tui/tui-driver.ts` (new)

**What**: Create `src/tui/tui-driver.ts` exporting `tuiDriver(): Promise<void>`. Internals: (1) TTY guard — if `process.stdout.isTTY === false`, write `verbum: interactive TUI requires a TTY — run without piping` to stderr and resolve (exit 0 path, per NFR-2); (2) minimum size check — if terminal columns < 60 or rows < 20, write `verbum: terminal too small (minimum 60×20, current WxH)` to stderr and resolve (per NFR-3); (3) initialise OpenTUI renderer, mount an inline `<App>` component that owns `useReducer(welcomeReducer, initialWelcomeState)` with a custom dispatch wrapper that calls `welcomeReducer(currentState, action)` once to extract the effect, then calls `baseDispatch(action)` for React state — ADR-DESIGN-WELCOME-6; (4) private `runEffect(effect, renderer, resolve)` — for `{ kind: "quit" }`: `renderer.destroy()` then `resolve()`; (5) keypress listener delivers `KeyPressed` actions. `tuiDriver` does NOT call `process.exit` — that is the entry point's responsibility (ADR-DESIGN-WELCOME-4).

**Acceptance** (REQ-3 / SCN-3a, 3b; NFR-1, 2, 3): File typechecks. OpenTUI renderer initialised inside the function (not at module load). `tuiDriver` returns a `Promise<void>`. SIGINT registered to use the same quit path (SCN-3b). `bun test` exits 0 (driver is not instantiated by any test).

**Commit message**: `feat: TUI driver with renderer, effect runner, and Promise lifecycle`

**Depends on**: T-5 (welcomeReducer, initialWelcomeState), T-6 (WelcomeScreen)

---

## Group G — Entry wiring

### T-8 — Wire no-args argv branch to tuiDriver in src/index.tsx

**Files**: `src/index.tsx` (modified)

**What**: Replace the existing "no args → stderr + exit 2" branch in `src/index.tsx` with the three-line argv branch from the design:

```tsx
const argv = Bun.argv.slice(2);
if (argv.length === 0) {
  await tuiDriver();
  process.exit(0);
}
const exitCode = await run(argv);
process.exit(exitCode);
```

The one-or-more-args path (`run(argv)`) is byte-for-byte unchanged. This is the ONLY modification to any existing `src/` file.

**Acceptance** (REQ-1 / SCN-1a, 1b; REQ-5 / SCN-5a, 5b, 5c): `bun test` exits 0 (all 33 tests pass, smoke.test.ts unmodified). `bun run src/index.tsx john 3:16` → stdout contains verse, exit 0, stderr empty. `bun run src/index.tsx xyzzy 99:99` → stderr non-empty, exit 2. No args invocation routes to `tuiDriver`. File `tests/smoke.test.ts` is NOT modified.

**Commit message**: `feat: route no-args verbum to TUI welcome screen`

**Depends on**: T-7 (tuiDriver must exist before the import lands)

---

## Group H — Smoke + verification

### T-9 — Confirm smoke regression and run manual TUI teardown check

**Files**: none (verification step only)

**What**: Two checks: (1) automated — run `bun test` and confirm all tests pass including `tests/smoke.test.ts` (which must remain unmodified); (2) manual — run `bun run src/index.tsx`, confirm the welcome screen renders with the book-frame layout (banner, both verses, version, hint line), press `q`, confirm the shell prompt returns cleanly with no garbled terminal state. This manual step validates ADR-DESIGN-WELCOME-4 and the full teardown sequence (`Effect.quit → renderer.destroy() → resolve() → process.exit(0)`).

**Acceptance** (REQ-5 / SCN-5c; REQ-3 / SCN-3a): `bun test` exits 0, 33 tests pass, zero failures, `tests/smoke.test.ts` unchanged. Manual smoke: welcome screen visible, `q` exits cleanly, terminal not garbled, nothing written to stderr after teardown.

**Commit message**: `test: confirm CLI smoke regression unchanged after TUI wiring`

**Depends on**: T-8

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Total tasks | 9 (T-1 through T-9) |
| Task groups | 8 (A–H) |
| Estimated changed lines | ~225 new + ~10 modified = ~235 total |
| New files | 7 |
| Modified files | 3 (`src/index.tsx`, `tsconfig.json`, `package.json`) |
| Total files touched | 10 |
| PR strategy | `single-pr` (locked — well under 400-line budget) |
| 400-line budget risk | **Low** |
| Chained PRs recommended | **No** |
| Decision needed before apply | **No** |

---

## Risk register for apply phase

### RISK-1 — Bun + OpenTUI process lifecycle on `q` (HIGH probability of needing iteration)

**What**: The riskiest unknown in the slice. OpenTUI's `renderer.destroy()` may not fully flush stdout before Bun's event loop is given back, leaving the terminal in raw mode or garbled state after `process.exit(0)`.

**How apply phase should handle it**: Implement the nominal teardown sequence first (`renderer.destroy() → resolve() → process.exit(0)`). Run the manual smoke step (T-9) immediately after T-7 lands (even before T-8 — test via a temporary call in the driver). If the terminal is garbled after `q`, apply the documented escape hatch: call `process.exit(0)` directly inside `runEffect`'s quit branch instead of resolving the Promise, bypassing the `await tuiDriver()` chain. Document whichever approach works in a code comment inside `tui-driver.ts`.

---

### RISK-2 — OpenTUI primitive name pinning (MEDIUM probability)

**What**: The exact API surface of the installed `@opentui/react` version is not pinned in the design — specifically the container primitive name (`<box>` vs `<group>` vs `<view>`), the keyboard event API (`useKeyboard` hook vs `renderer.on("keypress", ...)` imperative listener), and whether JSX compilation produces valid OpenTUI elements with `"jsxImportSource": "@opentui/react"`.

**How apply phase should handle it**: At the start of T-6 (welcome screen) and T-7 (driver), inspect `node_modules/@opentui/react/` and `node_modules/@opentui/core/` exports or type declaration files to confirm the exact primitive names and event API before writing code. If the API differs from what the design describes, use what the installed package actually exports — the spec is behavioural, not API-specific. Document the resolved primitive names in a comment in `tui-driver.ts`.

---

### RISK-3 — ADR-DESIGN-WELCOME-6 reducer-called-twice pattern (LOW probability, HIGH surprise factor)

**What**: The dispatch wrapper in `<App>` calls `welcomeReducer(currentState, action)` once to extract the effect, then calls `baseDispatch(action)` to update React state. Because `welcomeReducer` is a pure function with no IO, calling it twice is benign — but `currentState` inside the closure must reference the live state value at dispatch time, not a stale closure capture.

**How apply phase should handle it**: Use a `useRef` to hold the current state value alongside `useReducer`, updating the ref in a synchronous path (not `useEffect`) after every dispatch so the dispatch wrapper always reads fresh state. Alternatively, use the `useReducer` functional update form where available. If OpenTUI's React binding does not support standard React hooks parity, fall back to the module-level ref approach documented in the design notes. Document the chosen approach in a comment in `tui-driver.ts`.
