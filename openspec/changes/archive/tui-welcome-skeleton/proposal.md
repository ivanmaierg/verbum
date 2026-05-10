# Proposal — tui-welcome-skeleton

## TL;DR

Wire the OpenTUI runtime into verbum behind a 3-line argv branch so that `verbum` (no args) renders the locked book-frame welcome screen (Isometric1 wordmark + open-book ASCII frame with Genesis 1:1 / John 3:16 + a `?`/`q` status line) and `q` exits cleanly. The existing CLI path (`verbum john 3:16`) stays bit-for-bit unchanged. The slice deliberately bypasses the application/domain layers — the welcome screen is a pure outermost-ring view with zero inward arrows, and every architectural choice is constrained so the future Bubble Tea port (ADR 0009) is mechanical transcription.

---

## Intent

The smallest reviewable cut that proves OpenTUI lives next to the existing CLI driver under a single binary, under house rules 7-10, with zero regression on the v1-architecture-spike scenarios. After this slice, "TUI mode" is real (you can run it, see something, quit it) — every subsequent TUI feature (palette, reading view, book list) plugs into the runtime that landed here.

This is a wiring spike for presentation, deliberately mirroring v1-architecture-spike's role for domain/application/api/cli. Nothing fancy. No views beyond welcome. No routing. No domain reads from the welcome screen.

---

## First Reviewable Cut

**New files**:

- `src/cli/banner.ts` — generated, committed: pre-rendered Isometric1 `verbum` wordmark as a `string` constant (no figlet at runtime).
- `src/cli/welcome-content.ts` — hardcoded book-frame strings: Genesis 1:1 (BSB), John 3:16 (BSB), and the version literal. Pure TS, zero deps.
- `src/tui/welcome/welcome-reducer.ts` — `WelcomeState`, `WelcomeAction`, `WelcomeEffect`, and `welcomeReducer(state, action) => [WelcomeState, WelcomeEffect | null]` (rules 8, 9, 10).
- `src/tui/welcome/welcome-screen.tsx` — pure presentational React component using `@opentui/react` primitives. Composes banner + book-frame + status hint line. No business logic. No `useEffect` for state.
- `src/tui/welcome/welcome-reducer.test.ts` — colocated unit tests for the reducer. No OpenTUI imports.
- `src/tui/tui-driver.ts` — initializes the renderer, mounts `<WelcomeScreen>`, owns the effect runner, dispatches `KeyPressed` on input, runs `Effect.Quit` by calling `renderer.destroy()` and resolving its returned promise so the entry point can exit 0.
- `scripts/generate-banner.ts` — one-shot dev utility that runs `figlet -f Isometric1 verbum` and writes the result to `src/cli/banner.ts` (devDependency only; runtime never sees figlet).

**Modified files**:

- `src/index.tsx` — add the 3-line argv branch (Approach A from explore): `argv.length === 0 → await tuiDriver(); process.exit(0)` else fall through to existing `run(argv)` path.
- `tsconfig.json` — change `jsxImportSource` from `"react"` to `"@opentui/react"`.
- `package.json` — add runtime deps `@opentui/core`, `@opentui/react`, `react`; add devDep `figlet` (with `@types/figlet` if needed); add `"generate:banner": "bun run scripts/generate-banner.ts"` script.

**Unchanged**: every file in `src/domain/`, `src/application/`, `src/api/`, `src/cli/run.ts`, `src/cli/render.ts`, and `tests/smoke.test.ts`.

---

## Success Criterion

**Behavioural**:

1. `verbum` with no args opens the book-frame welcome screen showing the Isometric1 wordmark, the open-book frame (Genesis 1:1 left page, John 3:16 right page, `v0.1.0` between the bottom edges, drop shadow), and a status hint line `? help • q quit` below the frame. Pressing `q` exits with code 0 and restores the terminal cleanly.
2. `verbum john 3:16` still prints the BSB verse to stdout and exits 0 — byte-for-byte identical to the v1-architecture-spike output.
3. `verbum xyzzy 99:99` still writes the parse error to stderr and exits 2 — the existing error scenarios (SCN-3, SCN-4) regress to nothing.
4. The compiled binary (`bun build --compile`) runs both modes equivalently — no dev-only paths.
5. `bun test` continues to pass; `tests/smoke.test.ts` is unmodified and green.

**Structural**:

1. The welcome screen has zero imports from `src/domain/`, `src/application/`, or `src/api/`. It is a pure outermost-ring view (hexagonal: views with no inward arrows are valid).
2. `welcome-reducer.ts` follows ADR 0009 dialect verbatim: discriminated-union state, past-tense actions (`KeyPressed`), discriminated-union effect descriptors, no class, no decorators, no conditional types — Rules 5, 8, 9, 10, 11.
3. `welcomeReducer` is a pure function returning `[state, effect | null]`. Tests run without mounting OpenTUI.
4. The tui-driver is the only file that holds OpenTUI's `renderer` handle. The reducer never touches IO; the React component never owns business state via `useState`.
5. The Bubble Tea portability mapping (below) is 1:1 for every primitive used in this slice.

---

## Riskiest Unknown

**Bun + OpenTUI process lifecycle interaction**: does `renderer.destroy()` cleanly tear down stdin raw mode and the OpenTUI render loop such that `tuiDriver()` returns naturally and the awaiting `process.exit(0)` runs with a restored terminal? The explore lands on "lean: yes, confidence medium." This is the only thing in the slice that can't be fully resolved by reading docs — it requires running OpenTUI against Bun's runtime.

**Plan to retire it in spec/design**: the design phase will (a) name the exact teardown sequence (`renderer.destroy()` → resolve a `Promise<void>` exposed by tui-driver → return to entry point → `process.exit(0)`), and (b) add a single manual smoke step to the tasks phase: "run `bun run src/index.tsx`, press `q`, confirm shell prompt returns and terminal is not garbled." If that fails, fallback is `process.exit(0)` directly inside the effect runner after `renderer.destroy()` — a known-good escape hatch that bypasses any Bun-side cleanup quirk.

---

## Architectural Decisions

### D1 — Verse source for the book-frame welcome screen

**Decision**: **Option A — hardcoded string constants in `src/cli/welcome-content.ts`.**

The file exports `GENESIS_1_1_TEXT`, `JOHN_3_16_TEXT`, and `WELCOME_VERSION` as plain string constants (BSB text). The welcome React component reads them via static import. No use case calls. No network. No cache. Welcome remains a pure outermost-ring view with NO inward arrows.

**Alternatives considered**:

- *Option B — pre-generate at build time via a fetch-once script*: rejected. The verses Genesis 1:1 and John 3:16 in BSB will not change; spending build-time complexity on a once-fetch for two static strings is over-engineering. Adds a CI dependency (network during build) and a script that has to be re-run if the BSB API changes URLs.
- *Option C — live read via `GetPassageUseCase`*: rejected. This couples the welcome screen to network/cache layers that don't yet exist (cache port from ADR 0006 is deferred). First-run-no-network would fail on the welcome screen — a brutal first impression. Also blows the slice scope (would force pulling cache and offline-fallback work forward). Hexagonally the explore is right that views with zero inward arrows are valid; we should USE that property, not waste it.

**Why A wins**:

1. Hexagonal-clean: zero domain dependency at the outermost ring.
2. No first-run-no-network failure mode. The welcome screen is decoration; it must never fail.
3. Go-portability: the eventual Bubble Tea version embeds the same constants — `const genesis11 = "..."` in Go is identical mechanics.
4. The verses are theologically fixed by the project's identity. "Verbum" = "the Word" (John 1:1). Genesis 1:1 + John 3:16 anchor the open-book frame as bookends of the canon. They will never need to change without a brand redesign.
5. Zero scope creep. Welcome ships in this slice without needing cache or network work.

**Note on the user's brief**: the invocation mentioned "John 1:1 scripture verse on the RIGHT page" but `docs/ui-sketches.md` already locks the welcome layout as **Genesis 1:1 (left) + John 3:16 (right)**. We ship what ui-sketches.md draws — that is the locked visual identity. The `?`/`q` hint goes on a status line **below** the book frame, not inside it, because ui-sketches.md is explicit: "ASCII art is for entry points and quiet accents only — NEVER around scripture (verses must breathe)." Keeping hints out of the book pages preserves that rule.

### D2 — Banner generation strategy

**Decision**: **`bun run generate:banner` script** using `figlet` as a devDependency, output committed to `src/cli/banner.ts` as a `string` constant.

**Alternatives considered**:

- *Hand-embed once*: rejected for fragility — anyone editing the file manually risks misaligning the multi-line ASCII (the leading-space discipline of figlet output is easy to break). Also blocks future tweaks (font swap, "verbum-cli" wordmark) on memory of how to regen.

**Why this wins**:

1. Reproducibility: any contributor can regen with `bun run generate:banner`.
2. Runtime never depends on figlet. It is a devDependency only — the compiled binary stays small.
3. ui-sketches.md already specifies this exact pattern: "A small build step writes it to `src/cli/banner.ts`."
4. Aligns with the project preference (ADR-context, observation #91): "User wants generated artifacts (figlet) checked in / cached, not regenerated at runtime."
5. Go-portability: in Go we'd commit the same string constant (or `go:embed` a `.txt` file). Same idea.

### D3 — OpenTUI install set

**Decision**: install three runtime dependencies — `@opentui/core`, `@opentui/react`, and `react` — plus `@types/react` as a devDependency (TS types).

`react` is a peer dependency of `@opentui/react` and must be explicit in `package.json`. `@opentui/core` provides the renderer; `@opentui/react` provides the React reconciler bindings. The exact pinned versions are deferred to the design/tasks phase (it asks "what is the latest stable @opentui/react?" and pins what `bun add` resolves).

The tsconfig change is:

```jsonc
"jsxImportSource": "@opentui/react"   // was: "react"
```

This is safe for the existing CLI tree because no existing `src/cli/*` or `src/api/*` file uses JSX (verified during explore). Only the new `src/tui/` files use JSX.

### D4 — Process exit semantics

**Decision**: **`tuiDriver(): Promise<void>`** that resolves when the welcome reducer dispatches `Effect.Quit`. The effect runner inside tui-driver calls `renderer.destroy()` and then resolves the outer promise. `src/index.tsx` then calls `process.exit(0)` explicitly.

Sequence:

1. User presses `q` in the welcome screen.
2. OpenTUI key handler dispatches `{ type: "KeyPressed", key: "q" }` to the reducer.
3. `welcomeReducer` returns `[state, { kind: "quit" }]`.
4. The effect runner sees `Effect.Quit`, calls `renderer.destroy()`, and resolves the `tuiDriver()` promise.
5. `src/index.tsx` awakes from `await tuiDriver()` and calls `process.exit(0)`.

The explicit `process.exit(0)` at the entry point is belt-and-braces against any lingering Bun/OpenTUI handles keeping the event loop alive. It also matches the existing CLI path (`process.exit(exitCode)` already lives in `src/index.tsx`), so the pattern is symmetric.

### D5 — Testing scope

**Decision**: **reducer-only unit tests** via `bun test`. No e2e spawn test for the TUI.

`welcome-reducer.test.ts` covers:

- `KeyPressed("q")` transitions to no state change but emits `Effect.Quit`.
- Other keys are no-ops (no state change, no effect).
- Initial state shape.

The smoke test (`tests/smoke.test.ts`) MUST continue to pass unchanged — it covers the CLI path which is unaffected by this slice. We deliberately do NOT add a smoke test that spawns the TUI; mocking stdin/stdout for an OpenTUI render loop is more work than it's worth for a welcome screen with no business logic. Manual verification of the TUI render is a one-line tasks-phase step.

---

## Bubble Tea portability check

verbum's TS dialect must mechanically port to Go + Bubble Tea (ADR 0009; opencode is the structural reference). Mapping for this slice:

| TypeScript / OpenTUI | Bubble Tea (Go) | Notes |
|---|---|---|
| `type WelcomeState = { kind: "active" }` | `type model struct { kind string }` | Trivial — single state for now. |
| `type WelcomeAction = { type: "KeyPressed"; key: string }` | `type tea.KeyMsg` | Bubble Tea has built-in `tea.KeyMsg`; our action shape maps 1:1. Past-tense naming (Rule 10) ports verbatim. |
| `welcomeReducer(state, action) => [state, effect \| null]` | `Update(msg tea.Msg) (tea.Model, tea.Cmd)` | Same shape. Rule 8/9 enforces this. |
| `<WelcomeScreen>` JSX (banner + book-frame + status line) | `View() string` returning a multi-line string composed with `lipgloss` | OpenTUI's React tree is replaced by Bubble Tea's string-returning View. Components become helper string-builders. |
| `<ascii-font>` (NOT used in this slice) | n/a | We pre-render the Isometric1 wordmark to a string at build time, so neither runtime needs a figlet renderer — both embed the same constant. |
| `Effect.Quit` descriptor | `tea.Quit` cmd | Bubble Tea ships `tea.Quit` as a built-in command. Our descriptor maps to it directly. |
| Effect runner inside `tui-driver.ts` | Bubble Tea program loop (built-in) | Bubble Tea handles the effect loop natively; in TS we hand-roll a tiny runner. The shape of "reducer returns effect, runtime executes it" is preserved. |
| `argv` branch in `src/index.tsx` | `argv` branch in `func main()` | Identical structure. |
| `renderer.destroy()` | `tea.Program.Quit()` / program termination | Both restore the terminal and resolve the outer wait. |

**Caveats / iffy primitives**: none. Every OpenTUI primitive used in this slice has a Bubble Tea equivalent or a workaround already accounted for (figlet wordmark embedded as a string, status line as a `lipgloss.JoinHorizontal` of strings).

---

## Out of scope (explicit, do not implement)

- Mouse handling (`useMouse`, `onMouseDown`) — deferred to first interactive view.
- Command palette (Ctrl+K) — separate slice.
- View routing between TUI screens — no second screen exists yet.
- Domain reads from the welcome screen — see D1.
- Cache port and `FilesystemCache` adapter — separate v1 slice.
- Translation picker, reading view, book list — separate v1 slices.
- `--version` flag handling (it would render the compact banner-only sketch from ui-sketches.md) — separate slice.
- `--help` flag handling — separate slice.
- Theme system / color tokens (`primary`, `accent`, `muted`) — `OpenTUI` renders monochrome for this slice; theming arrives later.
- `PreferencesStore` / last-position memory — separate v1 slice.
- `OutputFormatter` / `--format` flag — separate v1 slice.
- Live BSB lookup of verses on welcome screen — see D1, rejected as Option C.
- Window-resize re-render logic beyond what OpenTUI provides out of the box — defer until a real interactive view needs it.

---

## Estimated delta

**File count**: 7 new + 3 modified = **10 files**.

**Line budget**:

- `banner.ts` (generated): ~12 lines (the Isometric1 `verbum` wordmark, embedded as a multi-line template literal).
- `welcome-content.ts`: ~10 lines (3 string constants + JSDoc).
- `welcome-reducer.ts`: ~30 lines (state, action, effect types + reducer).
- `welcome-reducer.test.ts`: ~40 lines (3-4 small `bun:test` cases).
- `welcome-screen.tsx`: ~50 lines (composition of banner, book frame, status line).
- `tui-driver.ts`: ~50 lines (renderer init, root mount, key dispatch, effect runner, teardown).
- `scripts/generate-banner.ts`: ~20 lines.
- `src/index.tsx`: +5 lines (argv branch).
- `tsconfig.json`: 1-line change.
- `package.json`: +5 dependency entries + 1 script entry.

**Total**: ~225 lines of new code (the largest single chunk being the generated banner string and the tui-driver). Comfortably under the **400-line PR budget** — size category **S/M (small-medium)**.

**Review workload**: single PR. No chained PRs needed. No `size:exception` required.

---

## Why this slice now

1. The v1-architecture-spike proved domain → application → api → cli. The next architectural unknown is *presentation*. Until OpenTUI is wired and we know the welcome screen actually renders, every TUI roadmap row (palette, reading view, book list, picker) is blocked behind an implicit "does our chosen UI library work?" assumption.
2. The slice is genuinely small (under 400 lines) and reversible. If OpenTUI turns out to be the wrong choice, we throw away `src/tui/` and the 3-line argv branch — the rest of the codebase is untouched.
3. Locking the Bubble Tea portability mapping early (before any state machine is more complex than welcome's two-line reducer) keeps ADR 0009 honest. Every future TUI slice extends the pattern; if we get it wrong now, the Go port stops being mechanical.
