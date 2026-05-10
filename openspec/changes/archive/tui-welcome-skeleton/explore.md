# Exploration: tui-welcome-skeleton

## TL;DR — Riskiest Unknown

The riskiest unknown is whether OpenTUI's `<ascii-font>` built-in font set includes Isometric1 — it almost certainly does NOT (the four known built-ins are "tiny", "block", "slick", "shade"). This means the Isometric1 wordmark must be generated externally (via `bunx figlet -f Isometric1`) and embedded as a pre-rendered string constant at build time, NOT rendered by `<ascii-font>` at runtime. If the proposal assumes `<ascii-font font="isometric1">` will work, it will fail at install time.

## Project State Recap

**What shipped (v1-architecture-spike)**:
- Four hexagonal layers wired: domain → application → api → cli
- `verbum john 3:16` parses, fetches BSB from helloao.org, slices verse, prints to stdout
- 29 unit tests pass via `bun test`; compiled binary CI step passes
- All 12 house rules verified

**What's in place**:
- `src/index.tsx` — entry point, currently hard-codes "no args → stderr + exit 2"
- `src/cli/run.ts` — CLI driver (argv → use case → exit code)
- `src/cli/render.ts` — pure string formatters (no IO)
- `tsconfig.json` has `jsxImportSource: "react"` — needs to change to `@opentui/react`
- `package.json` has only `zod` as runtime dep — `@opentui/core` + `@opentui/react` + `react` + `figlet` (devDep) are NOT installed
- `node_modules/` has only `zod`
- `docs/ui-sketches.md` defines the welcome screen visual including Isometric1 wordmark + book-frame ASCII art
- House rules 7–10 govern TUI state architecture (useReducer, no useEffect for business logic, past-tense action names, Effect descriptors)
- ADR 0009 constrains TUI code to the Go-portability dialect

**What is NOT in place**:
- No `src/tui/` directory or any OpenTUI components
- No TUI driver or TUI entry path
- No routing logic distinguishing "no args → TUI" from "args → CLI"
- `@opentui/core`, `@opentui/react`, `react` not installed
- No `src/cli/banner.ts` (pre-rendered Isometric1 string constant)
- No figlet build step

## Scope of this Change

**IN SCOPE**:
- Install `@opentui/core` + `@opentui/react` + `react`
- Fix `tsconfig.json` jsxImportSource from `"react"` to `"@opentui/react"`
- Generate the Isometric1 wordmark string and embed as `src/cli/banner.ts`
- Add `figlet` as devDependency for the banner generation step
- Create `src/tui/welcome/welcome-screen.tsx` — the welcome component (Isometric1 banner + version + keybind hints)
- Create `src/tui/tui-driver.ts` — the TUI driver: initializes renderer, mounts WelcomeScreen, handles `q` → `renderer.destroy()` → `process.exit(0)`
- Modify `src/index.tsx` — branch on `argv.length === 0` → `tuiDriver()`, else → existing CLI path
- Reducer unit tests for the welcome component (no OpenTUI needed)

**OUT OF SCOPE (explicit)**:
- No domain reads or API calls from the welcome screen
- No routing between TUI views
- No command palette (Ctrl+K)
- No mouse handling
- No translation picker, no reading view, no book list
- No `--version` flag handling
- No `PreferencesStore` or `Cache` ports
- No `OutputFormatter` port
- The existing CLI path (`verbum john 3:16`) MUST continue to work UNCHANGED

## Open Questions

1. **Does jsxImportSource change break existing CLI files?** Lean: NO — existing CLI files contain no JSX. Only new `src/tui/` files use JSX. CONFIDENCE: high.

2. **Can Bun's process lifecycle coexist with OpenTUI's render loop?** Lean: YES. OpenTUI keeps stdin in raw mode (event loop alive). `renderer.destroy()` restores terminal and the process can exit naturally or with `process.exit(0)`. CONFIDENCE: medium (needs empirical verification).

3. **Where does the routing decision live?** Lean: Approach A — branch directly in `src/index.tsx`. Explicitly anticipated by the existing `index.tsx` comment ("adding TUI mode later is a single if-statement here"). CONFIDENCE: high.

4. **Does the welcome screen bypass the application layer entirely?** Lean: YES, and it does NOT violate hexagonal. Presentation components with zero inward arrows simply sit at the outermost ring. CONFIDENCE: high.

5. **Is Isometric1 available as OpenTUI built-in `<ascii-font>` font?** Lean: NO. Known built-ins are "tiny", "block", "slick", "shade". The Isometric1 wordmark must be generated via `bunx figlet -f Isometric1 verbum` at build time and stored as a pre-rendered string constant in `src/cli/banner.ts`. ui-sketches.md also explicitly says: "The figlet wordmark is generated at build time ... A small build step writes it to `src/cli/banner.ts`." CONFIDENCE: high.

6. **How does the welcome screen satisfy ADR 0009 (Go-portability)?** Lean: FULLY, using the house rules pattern:
   - State: `type WelcomeState = { kind: "active" }` (trivial)
   - Actions: `type WelcomeAction = { type: "KeyPressed"; key: string }` (Rule 10)
   - Reducer: `(state, action) => [WelcomeState, WelcomeEffect | null]` (Rules 8, 9)
   - Effect: `{ kind: "quit" }` → effect runner calls `renderer.destroy()`
   CONFIDENCE: high.

7. **Does mouse handling need wiring in this slice?** Lean: NO. Welcome screen is static with single `q`-to-quit interaction. CONFIDENCE: high.

8. **How do you test an OpenTUI component?** Lean: Unit-test the reducer (pure function, no OpenTUI needed). No e2e spawn test for this spike. CONFIDENCE: medium.

## Approaches Compared — Routing Decision

### Approach A: Branch in src/index.tsx based on argv length (RECOMMENDED)
```ts
const argv = Bun.argv.slice(2);
if (argv.length === 0) {
  await tuiDriver();
} else {
  const exitCode = await run(argv);
  process.exit(exitCode);
}
```
- Pros: Cheapest (3-line change). Explicitly anticipated. CLI path unchanged code.
- Cons: As more modes add (--help, --version, verbum mcp), this branch grows.
- Hexagonal fit: Good — index.tsx is the wiring layer.
- Go-portability: Excellent — maps to Go main() directly.
- Scope fit: Perfect. Effort: Low.

### Approach B: Dispatcher port in application layer
- Pros: More hexagonal-pure on paper.
- Cons: Pushes argv awareness into application layer — actually VIOLATES dependency rule. Over-engineering.
- Effort: High. Wrong direction.

### Approach C: Two separate binary entries
- Pros: Cleanest separation.
- Cons: Changes user contract (two commands). Contradicts design doc's dual-mode intent.
- Effort: Low but wrong direction.

| Approach | Hexagonal | Go-portability | Scope fit | Effort |
|---|---|---|---|---|
| A — argv branch in index.tsx | Good | Excellent | Perfect | Low |
| B — Dispatcher port | Worse | Neutral | Too large | High |
| C — Two binaries | Neutral | Neutral | Wrong | Low |

**Recommendation: Approach A.**

## Files Likely to Change

**New files**:
- `src/tui/welcome/welcome-screen.tsx` — WelcomeScreen React component
- `src/tui/welcome/welcome-reducer.ts` — reducer + State + Action + Effect types (Rules 8/9/10)
- `src/tui/tui-driver.ts` — renderer init, createRoot, effect runner, q-to-quit
- `src/cli/banner.ts` — pre-rendered Isometric1 string constant (generated, committed)
- `src/tui/welcome/welcome-screen.test.ts` — reducer unit tests (no OpenTUI needed)

**Modified files**:
- `src/index.tsx` — add argv branch (3 lines)
- `tsconfig.json` — change jsxImportSource from "react" to "@opentui/react"
- `package.json` — add @opentui/core, @opentui/react, react as deps; figlet as devDep; add banner generation script

**Unchanged**: all of src/domain/, src/application/, src/api/, src/cli/run.ts, src/cli/render.ts, tests/smoke.test.ts

Estimated size: ~8 files touched. Well under 400-line PR budget.

## Key Decisions for the Proposal Phase

1. Lock banner strategy: hand-embed pre-rendered string vs. generate:banner script
2. Confirm OpenTUI install: @opentui/core + @opentui/react + react (react as peer dep?)
3. Clarify scope of welcome content: just figlet + version + hint, or full book-frame with two scripture verses?
4. Confirm process exit semantics: does tuiDriver() return or does renderer.destroy() exit naturally?
5. Testing scope: reducer unit tests only (no e2e spawn) for this spike.
