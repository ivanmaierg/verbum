# Spec: ts-native-architecture

- Status: draft
- Date: 2026-05-11
- Change: ts-native-architecture
- Supersedes policy: ADR 0009 (language-portable-architecture)

---

## 1. Capability

This change delivers two capabilities:

1. **Architecture policy — TypeScript-native dialect (supersedes Go-port dialect from ADR 0009)**
   Verbum adopts a TypeScript-native architectural policy. The Go-port portability mandate (ADR 0009, Rules 7–10) is formally retired. ADR 0010 replaces ADR 0009 as the governing architectural decision. `docs/house-rules.md` is updated rule-by-rule with the new dispositions. `docs/architecture.md` is swept for portability references and updated.

2. **Welcome reducer — plain state machine (no Effect tuple)**
   `welcome-reducer.ts` changes from `(state, action) => [WelcomeState, Effect | null]` to `(state, action) => WelcomeState`. The `Effect` type and `quit` effect descriptor are removed. Quit handling moves inline to a `useKeyboard` handler in `tui-driver.tsx`. The `reactReducer` shim and double-call pattern are removed. Tests are rewritten to assert the plain `WelcomeState` return shape.

---

## 2. Requirements

### REQ-1 — ADR 0010 created

`docs/decisions/0010-typescript-native-architecture.md` MUST exist with:
- `Status: accepted`
- `Date: 2026-05-11` (or the merge date)
- An explicit statement that it supersedes ADR 0009
- A rule disposition table covering all 12 rules from ADR 0009, with verdicts: KEEP / KEEP (loosened) / RETIRE
- The rationale for each RETIRE/LOOSEN verdict (Go-port commitment dropped)
- A "Consequences" section listing: Rule 9 retirement convention, Rule 8 tuple removal, Rule 7 loosening
- A "See also" link back to ADR 0009

### REQ-2 — ADR 0009 status flipped

`docs/decisions/0009-language-portable-architecture.md` MUST have:
- The front-matter status line updated from `Status: accepted` to `Status: superseded by 0010`
- A short superseding-note section near the top pointing to ADR 0010 (e.g. "Superseded by [ADR 0010](0010-typescript-native-architecture.md) — the Go-port commitment was dropped.")
- The original body preserved intact (immutable historical record — nothing removed or changed below the note)

### REQ-3 — Decision index updated

`docs/decisions/README.md` MUST:
- Contain a row for ADR 0010 with `Status: accepted`
- Show ADR 0009's status as `superseded by 0010`

### REQ-4 — house-rules.md preamble updated

`docs/house-rules.md` preamble MUST NOT contain the phrase "portability-first dialect of TypeScript" or any reference to a Go-port or Bubble Tea mandate. It MUST reference ADR 0010 as the governing ADR instead of ADR 0009.

### REQ-5 — house-rules.md Rule 7 loosened

The body of Rule 7 in `docs/house-rules.md` MUST:
- Remove the Go-port justification sentence ("These encode logic in the type system that humans (and Go) can't follow.")
- State that conditional/mapped/template-literal types are allowed where they genuinely simplify the type model and don't leak across boundaries — judgment call, not a blanket ban
- Remove the "Go port:" footnote

### REQ-6 — house-rules.md Rule 8 loosened

The body of Rule 8 in `docs/house-rules.md` MUST:
- Retain the `useReducer` for business state mandate
- Remove the `[State, Effect | null]` tuple example and requirement
- Show a plain `(state, action) => State` reducer example
- Remove the "Go port:" footnote and Bubble Tea parity note

### REQ-7 — house-rules.md Rule 9 retired

The body of Rule 9 in `docs/house-rules.md` MUST contain exactly the following text (no other content):

> Retired. `useEffect` is now permitted for async business logic. CONVENTION: `useEffect` must call application use cases, never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern.

### REQ-8 — house-rules.md Rule 10 retired

The body of Rule 10 in `docs/house-rules.md` MUST:
- State that Rule 10 is retired
- Remove the Bubble Tea parity requirement for past-tense action names
- Note that action naming in TypeScript should read clearly (no mandatory convention enforced)

### REQ-9 — house-rules.md kept rules unchanged in substance

Rules 1, 2, 3, 4, 5, 6, 11, 12 in `docs/house-rules.md` MUST retain their original behavioral requirement (the enforceable constraint), though Go-port footnotes ("Go port:") MAY be removed. The rule KEEP justification for each MUST reference TypeScript merit, not Go portability.

### REQ-10 — architecture.md swept

`docs/architecture.md` MUST NOT contain:
- References to a future Go port as a design motivation
- References to Bubble Tea
- The phrase "portability" used to justify any architectural rule

The tech-stack table and layer description content MAY remain unchanged if no portability references are present.

### REQ-11 — welcome-reducer plain-state signature

`src/tui/welcome/welcome-reducer.ts` MUST:
- Export `welcomeReducer` with signature `(state: WelcomeState, action: WelcomeAction) => WelcomeState`
- NOT export an `Effect` type
- NOT return a tuple `[WelcomeState, Effect | null]`
- Retain `WelcomeState`, `WelcomeAction`, and `initialWelcomeState` exports

### REQ-12 — welcome-reducer tests updated to plain-state shape

`src/tui/welcome/welcome-reducer.test.ts` MUST:
- Assert the plain `WelcomeState` return value (not a tuple)
- NOT contain any destructuring of the form `const [nextState, effect] = welcomeReducer(...)`
- Cover: `KeyPressed("q")` returns `initialWelcomeState`, `KeyPressed("Q")` returns `initialWelcomeState`, any other key returns `initialWelcomeState`
- All test cases MUST pass under `bun test`

### REQ-13 — tui-driver.tsx simplified

`src/tui/tui-driver.tsx` MUST:
- Remove the `reactReducer` shim (`const reactReducer = (s, a) => welcomeReducer(s, a)[0]`)
- Use `useReducer(welcomeReducer, initialWelcomeState)` directly (standard, no wrapper)
- Remove the custom `dispatch` wrapper and the double-call pattern
- Remove the `runEffect` function and `Effect` import
- Contain a `useKeyboard` handler that directly calls `renderer.destroy()` followed by `resolve()` when `keyEvent.name === "q"` or `keyEvent.name === "Q"`
- Retain the SIGINT handler with equivalent inline teardown (renderer.destroy() + resolve())
- NOT import `Effect` from `welcome-reducer.ts`

### REQ-14 — tui-async-effects archived

`openspec/changes/archive/tui-async-effects/` directory MUST exist and contain:
- All files previously in `openspec/changes/tui-async-effects/` (at minimum `explore.md`)
- A `SUPERSEDED.md` file with: the reason for archival (Effect-descriptor pattern retired by ts-native-architecture), a pointer to this change, and a note that async effects are now handled via `useReducer + useEffect + AbortController`

`openspec/changes/tui-async-effects/` MUST be removed (contents moved, not copied).

### REQ-15 — test suite stays green

`bun test` MUST report all tests passing. The passing count MUST be ≥ 99. The welcome-reducer test count MAY decrease by up to 2 (tuple-specific assertions removed) and MAY increase by up to 1 (plain-state assertions added). No other test files MUST change.

### REQ-16 — no new runtime dependencies

`package.json` MUST NOT gain any new entries under `dependencies` or `devDependencies` compared to the state before this change.

### REQ-17 — TUI runtime behavior preserved

After this change:
- `bun start` MUST display the welcome screen identically to before
- Pressing `q` MUST quit the TUI (renderer destroyed, process exits cleanly)
- Pressing `Q` MUST quit the TUI identically to lowercase `q`
- `Ctrl+C` (SIGINT) MUST quit the TUI via the same renderer.destroy() + resolve() path

---

## 3. Acceptance Scenarios

### SCN-1a — ADR 0010 exists and supersedes 0009

**Given** the repository after this change is merged  
**When** `cat docs/decisions/0010-typescript-native-architecture.md` is run  
**Then** the output contains `Status: accepted`, the word "supersedes", and "0009"

### SCN-1b — ADR 0010 rule disposition table is complete

**Given** `docs/decisions/0010-typescript-native-architecture.md`  
**When** the file is inspected  
**Then** all 12 rule numbers (1–12) appear, each with one of: KEEP / KEEP (loosened) / RETIRE  
**And** Rules 9 and 10 show RETIRE  
**And** Rule 8 shows KEEP (loosened) or equivalent

### SCN-2a — ADR 0009 status is superseded

**Given** `docs/decisions/0009-language-portable-architecture.md`  
**When** `grep "Status" docs/decisions/0009-language-portable-architecture.md` is run  
**Then** the output contains `superseded by 0010`

### SCN-2b — ADR 0009 body is preserved

**Given** `docs/decisions/0009-language-portable-architecture.md`  
**When** the file is read  
**Then** the original "Context", "Decision", "Portability assessment", "Alternatives considered", and "Consequences" sections are all present and unchanged

### SCN-3a — Decision index contains ADR 0010

**Given** `docs/decisions/README.md`  
**When** `grep "0010" docs/decisions/README.md` is run  
**Then** the output contains a row with `0010` and `accepted`

### SCN-3b — Decision index marks ADR 0009 as superseded

**Given** `docs/decisions/README.md`  
**When** `grep "0009" docs/decisions/README.md` is run  
**Then** the output contains `superseded` (not `accepted`)

### SCN-4 — house-rules.md preamble no longer references Go port

**Given** `docs/house-rules.md`  
**When** `grep -i "go port\|bubble tea\|portability-first" docs/house-rules.md` is run  
**Then** the output is empty (zero matches in the preamble and rule bodies)

### SCN-5 — Rule 7 loosened in house-rules.md

**Given** `docs/house-rules.md`  
**When** the Rule 7 section is read  
**Then** the word "LOOSEN" or "loosened" or "judgment" appears, and the phrase "Go can't follow" is absent

### SCN-6 — Rule 8 shows plain-state example

**Given** `docs/house-rules.md`  
**When** the Rule 8 section is read  
**Then** a code example of the form `(state, action): State` or `=> State` is present  
**And** no tuple example `[State, Effect | null]` appears

### SCN-7 — Rule 9 retirement text is verbatim

**Given** `docs/house-rules.md`  
**When** the Rule 9 section body is read  
**Then** it contains exactly: "Retired. `useEffect` is now permitted for async business logic. CONVENTION: `useEffect` must call application use cases, never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern."  
**And** no other behavioral requirement text appears in Rule 9

### SCN-8 — Rule 10 is marked retired

**Given** `docs/house-rules.md`  
**When** the Rule 10 section body is read  
**Then** it contains the word "Retired" and no Bubble Tea parity instruction

### SCN-9 — Rules 1-6, 11, 12 enforce the same constraint

**Given** `docs/house-rules.md`  
**When** each of Rules 1, 2, 3, 4, 5, 6, 11, 12 is read  
**Then** the primary enforceable constraint in each rule is present and unchanged  
**And** no rule body references "Go port" as its justification

### SCN-10 — architecture.md has no portability mandate references

**Given** `docs/architecture.md`  
**When** `grep -i "go port\|bubble tea\|portability" docs/architecture.md` is run  
**Then** the output is empty

### SCN-11a — welcome-reducer signature is plain state

**Given** `src/tui/welcome/welcome-reducer.ts`  
**When** the file is read  
**Then** the `welcomeReducer` function signature matches `(state: WelcomeState, action: WelcomeAction): WelcomeState`  
**And** no `Effect` type is exported  
**And** no tuple return `[WelcomeState, ...]` appears

### SCN-11b — welcome-reducer compiles without error

**Given** the modified source files  
**When** `bun run tsc --noEmit` is run  
**Then** the exit code is 0 (no type errors)

### SCN-12a — welcome-reducer tests assert plain state for q

**Given** `src/tui/welcome/welcome-reducer.test.ts`  
**When** the file is read  
**Then** the test for `KeyPressed("q")` uses `const nextState = welcomeReducer(...)` (not tuple destructuring)  
**And** asserts `nextState` equals or is `initialWelcomeState`

### SCN-12b — welcome-reducer tests pass

**Given** the modified source files  
**When** `bun test src/tui/welcome/welcome-reducer.test.ts` is run  
**Then** all test cases in that file pass with exit code 0

### SCN-13a — tui-driver has no reactReducer shim

**Given** `src/tui/tui-driver.tsx`  
**When** `grep "reactReducer" src/tui/tui-driver.tsx` is run  
**Then** the output is empty

### SCN-13b — tui-driver uses standard useReducer

**Given** `src/tui/tui-driver.tsx`  
**When** the file is read  
**Then** `useReducer(welcomeReducer, initialWelcomeState)` appears without a wrapper reducer  
**And** no double-call pattern (`welcomeReducer(state, action)[0]`) appears

### SCN-13c — tui-driver quit path is inline useKeyboard

**Given** `src/tui/tui-driver.tsx`  
**When** the `useKeyboard` handler block is read  
**Then** it contains `renderer.destroy()` and `resolve()` called directly on `q`/`Q` key  
**And** no `runEffect` function call appears

### SCN-13d — tui-driver does not import Effect

**Given** `src/tui/tui-driver.tsx`  
**When** `grep "Effect" src/tui/tui-driver.tsx` is run  
**Then** the output is empty (no import of `Effect` from welcome-reducer)

### SCN-14a — tui-async-effects archive exists

**Given** the repository after this change  
**When** `ls openspec/changes/archive/tui-async-effects/` is run  
**Then** `SUPERSEDED.md` and `explore.md` (or equivalent original files) appear

### SCN-14b — SUPERSEDED.md contains required content

**Given** `openspec/changes/archive/tui-async-effects/SUPERSEDED.md`  
**When** the file is read  
**Then** it mentions `ts-native-architecture` as the governing change  
**And** references `useReducer + useEffect + AbortController` as the replacement pattern

### SCN-14c — original tui-async-effects directory removed

**Given** the repository after this change  
**When** `ls openspec/changes/tui-async-effects/` is run  
**Then** the command fails with "No such file or directory" (directory no longer exists at original path)

### SCN-15 — full test suite passes

**Given** the complete modified repository  
**When** `bun test` is run  
**Then** all tests pass, total count ≥ 99, exit code 0

### SCN-16 — no new dependencies

**Given** `package.json` before and after this change  
**When** the `dependencies` and `devDependencies` keys are compared  
**Then** no new keys appear in either section

### SCN-17a — welcome screen renders

**Given** a TTY terminal ≥ 60×20  
**When** `bun start` is run (without arguments)  
**Then** the welcome screen renders and the process stays alive waiting for input

### SCN-17b — q key quits cleanly

**Given** `bun start` running in a TTY  
**When** the user presses `q`  
**Then** the renderer is destroyed, the terminal is restored, and the process exits with code 0

### SCN-17c — Ctrl+C quits cleanly

**Given** `bun start` running in a TTY  
**When** the user sends SIGINT (Ctrl+C)  
**Then** the renderer is destroyed and the process exits with code 0 (same path as pressing `q`)

---

## 4. Out of Scope

The following are explicitly deferred and MUST NOT be implemented in this change:

- **TUI reader feature** — palette overlay, passage view, chapter navigation. This change establishes the pattern; `tui-reader-screen` will implement it.
- **Any new state-management library** — decision is to stay native (`useReducer + useEffect`). No Zustand, XState, Effect-TS, or Jotai.
- **CLI changes** — `run.ts`, `vod.ts`, CLI layer untouched.
- **API / domain / application layer changes** — all layers stay identical.
- **New test infrastructure** — no new test utilities or helpers. Only `welcome-reducer.test.ts` changes in `src/`.
- **`useEffect`-based async fetch** in the welcome screen — the welcome screen has no async operation. The `useEffect` pattern (with `AbortController`) is codified for future screens, not implemented here.

---

## 5. Non-Functional Requirements

### NFR-1 — No new runtime dependencies

`package.json` MUST NOT gain any new entries under `dependencies` or `devDependencies`. (See REQ-16.)

### NFR-2 — Bundle size unchanged

`bun build --compile` output size MUST be within ±5% of the pre-change binary size. No new code paths are added; only simplification occurs.

### NFR-3 — Test count stability

`bun test` MUST pass ≥ 99 tests. The welcome-reducer suite count MAY change by ±2 due to tuple-assertion removal and plain-state assertion addition. All other test files MUST be unchanged.

### NFR-4 — Rule 9 retirement text is locked

The body of Rule 9 in `docs/house-rules.md` MUST contain this exact sentence sequence (verbatim):

> "Retired. `useEffect` is now permitted for async business logic. CONVENTION: `useEffect` must call application use cases, never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern."

No paraphrase is acceptable. This is the canonical enforcement text for code review.

### NFR-5 — TypeScript strict mode

The codebase compiles under `tsc --noEmit --strict` with zero errors after all changes are applied.

---

## References

- [Proposal artifact](./proposal.md) — the approved proposal for this change
- [Exploration artifact](./explore.md) — full option analysis and cost breakdown
- [ADR 0009](../../docs/decisions/0009-language-portable-architecture.md) — being superseded
- [ADR 0002](../../docs/decisions/0002-hexagonal-architecture.md) — hexagonal foundation retained
- Engram #254 — `sdd/ts-native-architecture/proposal`
