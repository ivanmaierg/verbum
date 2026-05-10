# Spec — tui-welcome-skeleton

## TL;DR

This spec defines the required behaviour for wiring OpenTUI into verbum so that `verbum` with no arguments opens an interactive welcome screen showing the locked book-frame layout from `docs/ui-sketches.md`, and `q` exits cleanly with code 0. The existing CLI path (`verbum <reference>`) is fully protected and must remain byte-for-byte unchanged. Every behavioural requirement is constrained by the ADR 0009 portability dialect and hexagonal architecture rules.

---

## Scope

This spec covers the welcome screen TUI slice: the argv branch that selects TUI mode, the welcome screen visual layout and interaction, the reducer and effect shape for the welcome screen, the exit lifecycle, and the banner generation pre-step. It does NOT cover view routing between TUI screens, command palette, mouse handling, reading view, book list, translation picker, `--version` flag, `--help` flag, theme system, cache ports, preferences, or any domain read from the welcome screen.

---

## Functional Requirements

### REQ-1 — Zero-arg invocation opens TUI welcome screen

When `verbum` is invoked with no positional arguments, the process MUST enter TUI mode and render the welcome screen. It MUST NOT write a usage error to stderr (this was the previous no-args behaviour, which is superseded by this slice). It MUST NOT call `parseReference` or any domain or application layer function.

**SCN-1a — No-args invocation starts TUI**

```
GIVEN: verbum is installed and the terminal is a valid TTY
WHEN: verbum is executed with no positional arguments
THEN: the TUI welcome screen is rendered to the terminal
AND: the process does not exit immediately
AND: stderr is empty
AND: stdout receives no CLI verse output
```

**SCN-1b — Regression: one-arg invocation does NOT start TUI**

```
GIVEN: verbum is installed
WHEN: verbum is executed with one or more positional arguments (e.g., "john 3:16")
THEN: the existing CLI path executes unchanged
AND: the TUI welcome screen is NOT shown
```

---

### REQ-2 — Welcome screen renders the locked book-frame layout

The welcome screen MUST render the visual composition defined in `docs/ui-sketches.md` §"Welcome screen": the Isometric1 figlet wordmark above an open-book ASCII frame containing two pages of scripture. The left page shows Genesis 1:1 (BSB text with attribution `✦ Genesis 1:1`). The right page shows John 3:16 (BSB text with attribution `✦ John 3:16`). The version string (`v0.1.0`) appears between the bottom edges of the frame. The drop shadow (`░░░`) anchors the frame. A status hint line appears BELOW the outer frame (not inside any page), showing at minimum `? help • q quit`.

The wordmark is rendered as a pre-generated string constant (not rendered by OpenTUI at runtime). Verse text and version are hardcoded string constants — no domain calls, no network.

**SCN-2a — Book-frame layout includes both scripture verses**

```
GIVEN: verbum is running in TUI mode on a terminal >= 80 cols wide
WHEN: the welcome screen is displayed
THEN: the rendered output contains the Genesis 1:1 BSB text on the left page
AND: the rendered output contains the John 3:16 BSB text on the right page
AND: the attribution markers "Genesis 1:1" and "John 3:16" are visible
AND: the version string "v0.1.0" is visible near the bottom of the frame
AND: the hint line containing "q" is visible below the book frame
```

**SCN-2b — Status hint line is outside the book frame**

```
GIVEN: the welcome screen is rendered
WHEN: the layout is inspected
THEN: the "? help • q quit" hint line appears below (not inside) the outer book frame
AND: the hint line is separated from the book frame by at least one character
```

---

### REQ-3 — Pressing `q` exits with code 0

Pressing the `q` key on the welcome screen MUST trigger the `{ kind: "quit" }` effect via the reducer, which MUST result in the terminal being restored and the process exiting with code 0.

**SCN-3a — q key exits cleanly**

```
GIVEN: verbum is running in TUI welcome mode
WHEN: the user presses the "q" key
THEN: the process exits with code 0
AND: the terminal is restored to its pre-TUI state (no garbled prompt, no raw mode residue)
AND: nothing is written to stderr
AND: nothing is written to stdout after the TUI tears down
```

**SCN-3b — SIGINT (Ctrl+C) exits cleanly**

```
GIVEN: verbum is running in TUI welcome mode
WHEN: the process receives SIGINT (Ctrl+C)
THEN: the process exits with code 0 (same teardown path as q)
AND: the terminal is restored to its pre-TUI state
```

Note: SIGINT uses the same teardown sequence as `q` — it is NOT treated as an error or exit code 1. The intent is that the terminal is never left in a garbled state regardless of how the user ends the session.

---

### REQ-4 — Pressing `?` is a defined no-op for this slice

Pressing `?` on the welcome screen MUST NOT crash, panic, or emit an unhandled error. For this slice, `?` is explicitly a no-op: the reducer sees a `KeyPressed { key: "?" }` action, returns the current state unchanged, and returns `null` for the effect. A future slice may attach a help screen to this key.

**SCN-4a — ? key is a no-op**

```
GIVEN: verbum is running in TUI welcome mode
WHEN: the user presses the "?" key
THEN: the welcome screen remains displayed unchanged
AND: the process does not crash
AND: no error is written to stderr
AND: the process does not exit
```

---

### REQ-5 — Existing CLI path is unchanged

The invocation `verbum <book> <chapter>:<verse>` (and all error variants) MUST produce byte-for-byte identical output on stdout and stderr, and identical exit codes, as the v1-architecture-spike implementation. The TUI branch in `src/index.tsx` MUST be executed ONLY when the positional argument count is zero. One or more positional arguments MUST fall through to the existing `run(argv)` path.

**SCN-5a — CLI happy path unchanged**

```
GIVEN: verbum is installed
WHEN: verbum john 3:16 is executed
THEN: stdout contains the BSB text of John 3:16
AND: exit code is 0
AND: stderr is empty
AND: output is byte-for-byte identical to the pre-TUI-slice output
```

**SCN-5b — CLI parse error unchanged**

```
GIVEN: verbum is installed
WHEN: verbum xyzzy 99:99 is executed
THEN: stderr contains an error message naming the unknown book token
AND: exit code is 2
AND: stdout is empty
AND: behaviour is byte-for-byte identical to the pre-TUI-slice output
```

**SCN-5c — smoke.test.ts continues to pass**

```
GIVEN: the tui-welcome-skeleton change is applied
WHEN: bun test is executed
THEN: tests/smoke.test.ts passes without modification
AND: all pre-existing test cases continue to pass
```

---

### REQ-6 — Reducer follows ADR 0009 portability dialect

The welcome screen reducer MUST conform to the Go-portability dialect defined in house-rules.md Rules 8, 9, 10, and 11. Specifically:

- The reducer MUST be a pure function with signature `welcomeReducer(state: WelcomeState, action: WelcomeAction): [WelcomeState, WelcomeEffect | null]`.
- `WelcomeAction` variants MUST use past-tense fact names (Rule 10). `KeyPressed` is the only variant required for this slice.
- `WelcomeEffect` MUST be a discriminated union with a `kind` field (Rule 5). `{ kind: "quit" }` is the only variant required for this slice.
- The reducer MUST NOT import from `src/domain/`, `src/application/`, or `src/api/`.
- The reducer MUST NOT perform IO, call `renderer`, or read global state.
- The reducer MUST be testable without mounting OpenTUI or any terminal.

**SCN-6a — KeyPressed("q") emits Effect.Quit**

```
GIVEN: welcomeReducer is called with any valid WelcomeState
AND: action is { type: "KeyPressed", key: "q" }
THEN: the returned effect is { kind: "quit" }
AND: the returned state is unchanged from the input state
```

**SCN-6b — Unknown key is a no-op**

```
GIVEN: welcomeReducer is called with any valid WelcomeState
AND: action is { type: "KeyPressed", key: <any key other than "q"> }
THEN: the returned effect is null
AND: the returned state is unchanged from the input state
```

**SCN-6c — Reducer tests run without OpenTUI**

```
GIVEN: welcome-reducer.test.ts is present in src/tui/welcome/
WHEN: bun test is executed
THEN: the reducer tests pass without any OpenTUI renderer being initialised
AND: no terminal is allocated
```

---

### REQ-7 — Verse constants live in a single file

All hardcoded scripture text and version string used by the welcome screen MUST be defined as named exports in `src/cli/welcome-content.ts`. No other file in the codebase may define or duplicate these string values. The welcome screen component MUST import them from this single file. This constraint exists so the future verse-pool change has exactly one place to refactor.

**SCN-7a — Constants are co-located**

```
GIVEN: the tui-welcome-skeleton change is applied
WHEN: src/cli/welcome-content.ts is inspected
THEN: it exports at minimum:
      - a constant for the Genesis 1:1 BSB text
      - a constant for the John 3:16 BSB text
      - a constant for the version string
AND: no other source file defines its own copy of the Genesis 1:1 or John 3:16 strings
```

---

### REQ-8 — Banner is a committed string constant generated by a script

The Isometric1 wordmark MUST be stored in `src/cli/banner.ts` as a committed string constant. It MUST be produced by running `bun run generate:banner` (which invokes `figlet -f Isometric1 verbum`) as a dev step, NOT at runtime. The `figlet` package MUST be a devDependency only — it MUST NOT be present in the production bundle or compiled binary. The banner constant MUST be importable by the welcome screen component as a plain string.

**SCN-8a — Banner script produces a committed file**

```
GIVEN: bun run generate:banner is executed in the project root
THEN: src/cli/banner.ts is written (or overwritten) with a valid TS module
AND: the module exports a string constant containing the Isometric1 "verbum" ASCII art
AND: figlet is not invoked at welcome screen render time
```

**SCN-8b — figlet is not a runtime dependency**

```
GIVEN: the project is built with bun build --compile
THEN: the resulting binary does not include figlet or its transitive dependencies
AND: the banner renders correctly from the committed string constant
```

---

## Non-functional Requirements

### NFR-1 — Startup latency

The welcome screen MUST be visible to the user within 500 ms of process start on a modern developer machine. Because the welcome screen has no domain calls, no network access, and no IO beyond terminal rendering, this constraint is expected to be trivially satisfied — it exists to catch regressions where, for example, figlet or a heavy import is accidentally evaluated at startup.

### NFR-2 — Terminal error handling

If the process's stdout is not a TTY (detected via `process.stdout.isTTY === false` or equivalent before entering TUI mode), the process MUST NOT attempt to open the OpenTUI renderer. Instead it MUST write a one-line message to stderr (`verbum: interactive TUI requires a TTY — run without piping`) and exit with code 0. This is a clean exit, not an error, because the user's shell is behaving normally (piping, redirecting) and the process should not surprise automated callers with a non-zero exit.

**Rationale**: exit 0 (not 2) because the user did nothing wrong — they piped a TUI command, which is unusual but not an error on their part. The message goes to stderr so piped stdout stays clean.

### NFR-3 — Minimum terminal size

The book-frame layout from `docs/ui-sketches.md` requires approximately 70 columns and 20 rows to render legibly. The welcome screen MUST declare a minimum terminal size of **60 columns × 20 rows** (matching the global layout rule in `ui-sketches.md`). If the terminal is smaller than this minimum at startup, the process MUST write a one-line error to stderr (`verbum: terminal too small (minimum 60×20, current WxH)`) and exit with code 0. If the terminal is resized below the minimum WHILE the welcome screen is displayed, the welcome screen MAY render degraded (truncated output is acceptable) — a full graceful reflow is not required for this slice.

### NFR-4 — Go-portability constraint

All TUI state, action, and effect types introduced in this slice MUST conform to ADR 0009 (language-portable architecture). The mapping from this slice's TS types to Bubble Tea equivalents is documented in the proposal's portability table. No OpenTUI primitive that lacks a Bubble Tea equivalent may be used as a structural dependency. The welcome screen is deliberately simple to establish the Bubble Tea portability baseline before more complex views are added.

### NFR-5 — Zero inward arrows from the welcome screen

The welcome screen component (`src/tui/welcome/welcome-screen.tsx`) and the welcome reducer (`src/tui/welcome/welcome-reducer.ts`) MUST have zero imports from `src/domain/`, `src/application/`, or `src/api/`. These files sit at the outermost ring of the hexagonal architecture. Static import of string constants from `src/cli/welcome-content.ts` and `src/cli/banner.ts` is permitted because those files contain no domain logic.

---

## Boundaries (out of scope — MUST NOT touch)

The following items are explicitly excluded from this slice. Implementing any of them as part of this slice is a scope violation and will block review:

- Mouse handling (`useMouse`, `onMouseDown`, or any click interaction)
- Command palette (Ctrl+K or any multi-step navigation overlay)
- View routing between TUI screens (no second screen exists in this slice)
- Any domain read from the welcome screen (no `getPassage`, no `BibleRepository` call)
- Cache port and `FilesystemCache` adapter
- Translation picker, reading view, book list
- `--version` flag handling (compact wordmark-only output)
- `--help` flag handling
- Theme system or color token configuration beyond what OpenTUI provides by default
- `PreferencesStore` or last-position memory
- `OutputFormatter` or `--format` flag
- Live BSB lookup of verses on the welcome screen
- Window-resize reflow logic beyond what OpenTUI provides out of the box
- Any modification to `src/domain/`, `src/application/`, `src/api/`, `src/cli/run.ts`, `src/cli/render.ts`
- Any modification to `tests/smoke.test.ts`

---

## Border cases

### BC-1 — Terminal smaller than book-frame minimum (< 60 cols or < 20 rows)

**Resolution**: Exit cleanly with a one-line stderr message. See NFR-3 for the exact behaviour. The welcome screen does not attempt to render a degraded layout at startup — it is all-or-nothing. Post-render shrink (resize event while running) may produce truncated output; full reflow is deferred.

**Justification**: A 70-column book frame crammed into a 40-column terminal is illegible and defeats the purpose of the welcome screen. An honest "your terminal is too small" message is more useful than garbled ASCII. Exit 0 because the process behaved correctly given its constraints.

### BC-2 — Non-TTY stdout (piped or redirected, e.g., `verbum | cat`)

**Resolution**: Detect non-TTY BEFORE initialising the OpenTUI renderer. Write `verbum: interactive TUI requires a TTY — run without piping` to stderr. Exit with code 0. See NFR-2.

**Justification**: Exit 0 because the user's invocation is not wrong — they are piping a TUI application, which is unusual but a valid shell operation. A non-zero exit would confuse shell scripts. The message guides the user. The existing CLI path (`verbum john 3:16 | cat`) is unaffected because it goes through the argv branch that produces plain text output.

### BC-3 — SIGINT (Ctrl+C) during welcome screen

**Resolution**: The process exits with code 0 using the same teardown path as pressing `q`. The terminal is restored. See SCN-3b.

**Justification**: Ctrl+C on an interactive TUI is a normal user gesture (not an error). Exiting with code 1 (shell convention for interrupted processes) would surprise users who Ctrl+C out of interactive programs routinely. Verbum's welcome screen is a lightweight launcher — treating its Ctrl+C as an error is unnecessarily hostile.

### BC-4 — Unknown or unmapped keys (e.g., `j`, `k`, arrow keys, `a`–`z` other than `q`)

**Resolution**: The reducer treats any `KeyPressed` action with a key other than `"q"` as a no-op: returns `[state, null]`. The welcome screen remains displayed. No error. No crash. See SCN-6b and REQ-4.

**Justification**: The welcome screen is static — it has no scrolling, no selection, and no navigation. Ignoring unmapped keys is the correct behaviour and makes the reducer trivially exhaustive for this slice.

### BC-5 — Process launched with positional args that happen to be empty strings or whitespace

**Resolution**: This falls through to the existing CLI path (`run(argv)`) because `argv.length > 0`. The CLI's `parseReference` receives the whitespace token and returns `{ kind: "empty_input" }`, writing a usage error to stderr and exiting 2. This is unchanged behaviour from v1-architecture-spike.

---

## Backwards compatibility / regression guard

The single regression contract for this slice is `tests/smoke.test.ts`. This file MUST remain unmodified and MUST pass without any changes to the fixture, the assertions, or the test harness.

The smoke test verifies:
- `verbum john 3:16` → stdout contains BSB verse text, exit 0, stderr empty (SCN-5a)
- One unknown-book input → stderr non-empty, exit 2, stdout empty (SCN-5b)

These scenarios exercise the CLI path exclusively. The TUI branch in `src/index.tsx` is taken only when `argv.length === 0`, which is never the case in the smoke test invocations.

Additionally, the compiled binary (`bun build --compile`) MUST continue to pass both smoke test scenarios. The jsxImportSource change in `tsconfig.json` (`"react"` → `"@opentui/react"`) MUST NOT affect the compiled binary output or behaviour for the CLI path, because no existing CLI file uses JSX.

**Byte-for-byte contract**: stdout output and exit codes for all pre-existing CLI invocations are frozen. Any diff in CLI stdout or exit codes introduced by this slice is a blocking regression.
