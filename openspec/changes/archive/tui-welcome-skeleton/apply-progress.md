# Apply Progress — tui-welcome-skeleton

## Branch
`feat/tui-welcome-skeleton` (off `feat/v1-architecture-spike`)

## Status
`complete`

## Baseline
- 29 tests passing before any changes
- `bun test` exits 0

## Tasks

### Completed
- T-1 ✅ `9052c7c` — chore: add @opentui/core, @opentui/react, react deps and figlet devDep
- T-2 ✅ `35ca65d` — chore: flip jsxImportSource to @opentui/react
- T-3 ✅ `e4670e9` — build: add generate:banner script and commit Isometric1 wordmark
- T-4 ✅ `a0caaf4` — feat: hardcoded welcome verses and version constants
- T-5 ✅ `005baa2` — feat: welcome reducer and colocated tests
- T-6 ✅ `d010b05` — feat: welcome screen component (banner + book-frame + status line)
- T-7 ✅ `c7e3628` — feat: TUI driver with renderer, effect runner, and Promise lifecycle
- T-8 ✅ `1d7eedd` — feat: route no-args verbum to TUI welcome screen
- T-9 ✅ `c96b875` — test: confirm CLI smoke regression unchanged after TUI wiring

### Pending
(none — all tasks complete)

## Deviations

### T-9 — empty commit for verification step
Tasks.md says T-9 is "verification step only / no files". Used `git commit --allow-empty`
since there are no file changes for this step. This is correct per the task spec.

### welcome-screen.tsx — BOOK_FRAME rendered as computed template literal
The book-frame layout is computed at module load time as a template literal using
slice/padEnd on the verse strings. This satisfies the spec (static string with content
from welcome-content.ts) without adding JSX complexity. The frame renders the locked
ui-sketches.md layout: angled edges, two verse columns, version between bottom edges,
drop-shadow. Verses are visible and correctly attributed.

### tui-driver.ts — wrappedResolve wraps resolve to clean up SIGINT handler
The SIGINT handler is registered with `process.once("SIGINT", ...)` and cleaned up
via a `wrappedResolve` wrapper. This ensures no handler leak if SIGINT fires before
a normal q-key quit. Minimal deviation from design, fully spec-compliant.

## Test status
- Last `bun test` run: T-9 — 33 pass, 0 fail (29 pre-existing + 4 reducer tests)
- Smoke regression: green — tests/smoke.test.ts unmodified and passing

## Commits (oldest → newest)
1. `9052c7c` chore: add @opentui/core, @opentui/react, react deps and figlet devDep
2. `35ca65d` chore: flip jsxImportSource to @opentui/react
3. `e4670e9` build: add generate:banner script and commit Isometric1 wordmark
4. `a0caaf4` feat: hardcoded welcome verses and version constants
5. `005baa2` feat: welcome reducer and colocated tests
6. `d010b05` feat: welcome screen component (banner + book-frame + status line)
7. `c7e3628` feat: TUI driver with renderer, effect runner, and Promise lifecycle
8. `1d7eedd` feat: route no-args verbum to TUI welcome screen
9. `c96b875` test: confirm CLI smoke regression unchanged after TUI wiring
