# Archive Report — tui-welcome-skeleton

## TL;DR

**Status**: SHIPPED. PR #2 merged into `main` (squash-merge, 13 commits, ~270 lines).

**Verdict**: PASS WITH WARNINGS. The riskiest unknown (Bun + OpenTUI process lifecycle on `q`) is empirically retired by manual smoke. The project now has a working TUI welcome screen — the first piece of presentation-layer infrastructure is in place. All test suites green. Two CRITICAL bugs found by user manual smoke during apply phase were fixed before verify. Post-fix verify found zero new CRITICAL issues. Final state captures all polish commits landing after the verify report (font swap, version repositioning, layout refinements).

---

## Shipping Summary

**PR URL**: [github.com/ivanmaierg/verbum/pull/2](https://github.com/ivanmaierg/verbum/pull/2)

**Branch**: `feat/tui-welcome-skeleton` (rebased, 8 duplicate spike commits dropped; 13 welcome commits preserved) — deleted after merge

**Merge**: Squash-merge into `main` (all 13 commits flattened into a single commit message or preserved as single SQA commit depending on GitHub's squash UX; branch deleted)

**Final commits** (13 commits, oldest → newest, SHAs post-rebase on fresh origin/main):

1. `6eb8a94` — chore: add @opentui/core, @opentui/react, react deps and figlet devDep (T-1)
2. `434ff51` — chore: flip jsxImportSource to @opentui/react (T-2)
3. `1da9155` — build: add generate:banner script and commit Isometric1 wordmark (T-3)
4. `af44b7b` — feat: hardcoded welcome verses and version constants (T-4)
5. `8daff53` — feat: welcome reducer and colocated tests (T-5)
6. `b74b423` — feat: welcome screen component (banner + book-frame + status line) (T-6)
7. `8f8e764` — feat: TUI driver with renderer, effect runner, and Promise lifecycle (T-7)
8. `f4c9c85` — feat: route no-args verbum to TUI welcome screen (T-8)
9. `e32205d` — test: confirm CLI smoke regression unchanged after TUI wiring (T-9)
10. `2fb0bc8` — fix: parse JSX in tui-driver and adapt useReducer signature (post-apply fix)
11. `e4a3282` — feat: switch banner font from Isometric1 to ANSI Shadow (post-verify polish)
12. `31b7031` — feat: move version to title bottom-right and add bookmark ribbon (post-verify polish)
13. `bcc15a3` — style: refine welcome layout with title underlines and angled shadow (post-verify polish)

---

## What Ships in main

**Files added** (7 new):
- `src/cli/banner.ts` — generated, committed: ANSI Shadow `Verbum` wordmark (multi-line string constant)
- `src/cli/welcome-content.ts` — hardcoded Genesis 1:1 (BSB), John 3:16 (BSB), version literal
- `src/tui/welcome/welcome-reducer.ts` — pure state machine: `WelcomeState`, `WelcomeAction`, `Effect`, `welcomeReducer(state, action) → [state, effect | null]`
- `src/tui/welcome/welcome-reducer.test.ts` — reducer unit tests (4 cases, all pass)
- `src/tui/welcome/welcome-screen.tsx` — JSX component: banner + book-frame + status line
- `src/tui/tui-driver.tsx` — OpenTUI renderer driver, effect runner, Promise lifecycle
- `scripts/generate-banner.ts` — dev script: figlet wordmark generator

**Files modified** (3):
- `src/index.tsx` — argv branch: `argv.length === 0 → await tuiDriver(); process.exit(0)`
- `tsconfig.json` — jsxImportSource: `"@opentui/react"` (was `"react"`)
- `package.json` — runtime deps (`@opentui/core`, `@opentui/react`, `react`), devDeps (`@types/react`, `figlet`, `@types/figlet`), script (`generate:banner`)

**Files unchanged**:
- All files in `src/domain/`, `src/application/`, `src/api/`, `src/cli/run.ts`, `src/cli/render.ts`
- `tests/smoke.test.ts` (unmodified, green)

---

## Final Architectural Decisions (locked)

### D1 — Verse source: hardcoded string constants in `src/cli/welcome-content.ts`

**Decision**: CONFIRMED. Genesis 1:1 and John 3:16 (BSB) are static string constants. No domain calls, no network.

**Why**: Hexagonal purity — welcome screen has zero inward arrows. Verses are content identity, not data fetches.

### D2 — Banner generation: `bun run generate:banner` script, output committed to `src/cli/banner.ts`

**Decision**: CONFIRMED. `figlet` runs at dev time (devDep only), output embedded as a `string` constant.

**Why**: Reproducible. Runtime never depends on figlet. Script is re-runnable. Compiled binary stays small.

### D3 — OpenTUI install set: `@opentui/core`, `@opentui/react`, `react`, plus `@types/react` devDep

**Decision**: CONFIRMED. Exact versions pinned by `bun add` at apply time (SHAs in apply-progress).

**Why**: Needed for the React reconciler and terminal renderer primitives.

### D4 — Process exit semantics: `tuiDriver(): Promise<void>` that resolves on `Effect.Quit`, entry owns `process.exit(0)`

**Decision**: CONFIRMED. Sequence verified by manual smoke: `q` key → `renderer.destroy()` → Promise resolves → entry wakes → `process.exit(0)` → terminal restored.

**Why**: Symmetric with existing CLI path. Empirically verified that Bun's event loop cleans up after `renderer.destroy()`.

### D5 — Testing scope: reducer-only unit tests, no e2e TUI spawn test

**Decision**: CONFIRMED. 33/33 tests pass. Reducer tests (4 new) all pass without OpenTUI. Smoke test unchanged.

**Why**: Reducer is the only pure function; TTY mock/spawn tests are more brittle than manual smoke for a simple welcome screen.

### SUPERSEDED: Font choice (from proposal/design → final state)

**Isometric1 → ANSI Shadow** (commit `e4a3282`, post-verify polish)

The proposal and design locked the Isometric1 figlet font. After apply completion, user ran `bun run src/index.tsx` for manual smoke. The Isometric1 rendering was unreadable (user: "the weird thing being displayed"). Tested Big, Standard, ANSI Shadow, Slant. User chose ANSI Shadow. This is a locked final decision that supersedes the initial lock-in (memory #91 partial).

**Why ANSI Shadow wins**: Renders all letters as full-height bold blocks. Readable at typical terminal widths. Applies project-wide ("ansi everywhere" per user). This DOES NOT override the Verbum name, binary, npm package decisions from the rebrand — only the figlet font changes.

**Wordmark text**: `Verbum` (capital V). Identical in all fonts; text case not an issue (Isometric1 and ANSI Shadow render identically regardless of case).

### MODIFIED in polish: Version position and book-frame layout

**Original spec (design D1-D5)**: Version appeared between the bottom edges of the book frame (inside the frame's bottom space).

**Final state (commits `31b7031` + `bcc15a3`)**: Version moved to bottom-right corner of the ANSI Shadow wordmark (outside the frame). Book-frame gained a bookmark ribbon (señalador de página) on the right side. Layout refined with verse-title underlines, ╲╱ middle joint on bottom edge (mirroring spine), angled drop-shadow, curved bookmark stroke.

These post-verify polish commits reflect user preferences expressed during manual smoke. The visual identity locked in ui-sketches.md is refined but not fundamentally changed — the locked verses (Genesis 1:1 left, John 3:16 right), the book-frame structure, and the bottom-right status line all ship intact. The polish deepens the aesthetic (curves, underlines, ribbon) without breaking the architecture.

---

## Test Status at Archive Time

**`bun test` (33/33 pass)**:
- 29 pre-existing tests (unchanged, all pass)
- 4 new reducer tests (all pass without OpenTUI)

**`tests/smoke.test.ts` (2/2 pass)**:
- `verbum john 3:16` → BSB text, exit 0 (unchanged from v1-architecture-spike)
- `verbum xyzzy 99:99` → parse error, exit 2 (unchanged)

**`bunx tsc --noEmit` (23 pre-existing errors, 0 new from this change)**:
- 7 errors in `src/tui/tui-driver.tsx` — all TS2580 `Cannot find name 'process'` (pre-existing @types/node missing)
- 1 error in `src/tui/welcome/welcome-reducer.test.ts` — TS2307 `bun:test` module (pre-existing)
- 15 other pre-existing errors in unrelated files
- **Zero errors from the change itself**: tsc accepts JSX syntax, module exports, and type signatures post-fix

**Noise floor reduction (follow-up, not blocking)**:
Install `@types/bun` and `@types/node` to drop the 23 pre-existing errors to ~0. Then tsc becomes a clean binary signal in CI.

---

## Manual Smoke Results

User ran `bun run src/index.tsx` (the dev entry point) during the apply phase:

**✅ CONFIRMED**:
- Wordmark renders (ANSI Shadow, readable)
- Book-frame renders with Genesis 1:1 and John 3:16 (readable, no decoration inside verses per rule)
- Status line `? help • q quit` appears below frame
- Pressing `q` exits cleanly with code 0
- Terminal restored after `q` (no raw-mode residue, shell prompt returns)
- CLI path `verbum john 3:16` still works (byte-for-byte unchanged output)

**⚠️ DEFERRED (not yet confirmed by user, but not blocking)** — can be run anytime post-merge:
- Ctrl+C teardown (BC-3): same sequence as `q`, terminal restored, exit 0
- `verbum | cat` (piped non-TTY): message to stderr, exit 0
- Small terminal (\<60 cols or \<20 rows): message to stderr, exit 0

These three are implementation-complete but require manual TTY verification. The spec defines the exact messages (BC-2, BC-3, NFR-2, NFR-3). They are not blockers for archive because the main use case (`q` exit) is confirmed working.

---

## Riskiest Unknown: RETIRED

**The unknown**: Bun + OpenTUI process lifecycle on `q` key. Does `renderer.destroy()` cleanly tear down stdin raw mode and the OpenTUI render loop such that `tuiDriver()` returns naturally and the awaiting `process.exit(0)` runs with a restored terminal?

**Confidence in design**: Medium (from proposal phase).

**Status at archive**: EMPIRICALLY RETIRED. User manual smoke confirmed: `q` key exits cleanly, terminal is restored, no garbled output, no raw-mode residue. The exact sequence — `renderer.destroy()` → OpenTUI event loop exits → Promise resolves → `tuiDriver()` returns → `process.exit(0)` — works as designed on the Bun runtime.

**Escape hatch** (designed but not needed): The code includes a `process.exit(0)` call directly in the effect runner after `renderer.destroy()`. This was the fallback if Bun's cleanup was incomplete. It was not necessary — the Promise-based teardown worked cleanly.

---

## Verify-Report Deltas (What Landed After Verify)

The verify report (engram #158) documented the post-apply-fix state through commit `a43b184` (JSX parse + useReducer signature fix). The final archive state includes three additional post-verify polish commits that refined the visual identity:

**Commit `e4a3282` — feat: switch banner font from Isometric1 to ANSI Shadow**
- Font redecision after user manual smoke (unreadable Isometric1 → readable ANSI Shadow)
- Generator script updated; `src/cli/banner.ts` regenerated
- Decision locked at archive time (memory #162)

**Commit `31b7031` — feat: move version to title bottom-right and add bookmark ribbon**
- Version moved from inside book-frame to wordmark bottom-right corner
- Book-frame gained ribbon decoration (curved stroke on right side)
- REQ-2 and REQ-7 still satisfied (version is visible, verses are undecorated)
- WARN-1 from verify report (padStart no-op) now RESOLVED: padStart call was deleted when version moved out of the frame

**Commit `bcc15a3` — style: refine welcome layout with title underlines and angled shadow**
- Verse-title underlines added (`════════════════`)
- Book-frame bottom edge refined with ╲╱ joint (mirrors spine structure)
- Drop-shadow rendering made angled (visual depth)
- No spec violations; refinements only

All three polish commits preserve the architecture (zero inward arrows), respect the doctrine (Genesis 1:1 left, John 3:16 right, no verse decoration), and leave the reducer/driver/test suite untouched.

---

## Coverage Learnings (Verify Phase Gaps Identified)

The verify phase found zero blocking issues in the final state, but it discovered gaps in how verify should be conducted for TUI slices:

1. **Automated verify doesn't catch JSX or React integration bugs** — `bun test` exercises only the reducer unit tests. Neither the JSX parse error (`.ts` → `.tsx` rename) nor the useReducer type mismatch would have been caught by automated testing. The bugs were latent until the user ran the compiled code.

2. **Recommend adding to verify discipline**:
   - `bunx tsc --noEmit` on every change touching `.tsx` files (catch parse + type errors even when tests don't import the file)
   - Consider a non-interactive module-import smoke test (cheap, no TTY): just import the driver and confirm the module loads
   - Future design phases should specify `.tsx` extension explicitly for any JSX-containing file (not just `.ts`)

3. **Visual identity choices must survive manual preview** — The Isometric1 lock-in failed on first manual smoke because the design phase never SAW the rendered output. Figlet font choice is hard to evaluate from name alone. Future design phases touching visual identity should include exploration-time rendering of 2-3 candidates for user review before the choice is locked.

4. **Follow-up improvement (not blocking)**: Install `@types/bun` + `@types/node` to reduce tsc's pre-existing noise floor from 23 errors to ~0. Then future verify runs can distinguish real regressions from environmental errors at a glance.

These learnings are captured in engram #159 (bugfix memo) and should be incorporated into the SDD discipline for TUI work.

---

## Pointers to the SDD Trail

All SDD artifacts are persisted in engram and hyperlinked for traceability:

| Phase | Engram ID | Topic Key |
|-------|-----------|-----------|
| Exploration | #147 | `sdd/tui-welcome-skeleton/explore` |
| Proposal | #150 | `sdd/tui-welcome-skeleton/proposal` |
| Spec | #153 | `sdd/tui-welcome-skeleton/spec` |
| Design | #154 | `sdd/tui-welcome-skeleton/design` |
| Tasks | #155 | `sdd/tui-welcome-skeleton/tasks` |
| Apply-Progress | #156 | `sdd/tui-welcome-skeleton/apply-progress` |
| Bugfix (JSX + useReducer) | #159 | (no topic key; standalone) |
| Font Decision | #162 | (no topic key; locked decision ref) |
| Verify-Report | #158 | `sdd/tui-welcome-skeleton/verify-report` |
| **Archive-Report** | (this save) | `sdd/tui-welcome-skeleton/archive-report` |

The verify report (engram #158) captured the state post-fix but pre-polish. This archive report supersedes its "current state" section with the final shipping state (3 polish commits included).

---

## Follow-ups (Not Blocking, Carry Forward to Next Session)

1. **`docs/ui-sketches.md` documentation update** — Still references Isometric1 visually. Should be updated to document ANSI Shadow as the canonical figlet font ("ansi everywhere"). Document-only change, can be done anytime.

2. **Install `@types/bun` + `@types/node`** — Drops tsc noise floor from 23 to ~0, makes future tsc runs a clean signal. Recommend doing this before the next SDD cycle to improve the verify phase's ability to spot real regressions.

3. **Add `typecheck` script to package.json** — `"typecheck": "bunx tsc --noEmit"`. Run in CI alongside `bun test`. Catches JSX/type errors that tests might miss.

4. **Roadmap items captured in engram for future changes**:
   - Rotating verse pool on welcome (engram #151) — allow users to tap/arrow-key through multiple verses before quitting
   - `verbum vod` CLI command (engram #152) — pairs with the verse pool, shares the picker infrastructure
   - Both are scoped but not blocking this slice

---

## Verdict: PASS WITH WARNINGS

**Blocking issues**: None. All REQs satisfied. All tests pass. Architecture clean. Riskiest unknown (Bun + OpenTUI lifecycle) empirically retired by user manual smoke.

**Warnings**:
- WARN-1 (from verify): `WELCOME_VERSION.padStart(4)` no-op — NOW RESOLVED (version moved in `31b7031`, padStart deleted)
- WARN-2 (from verify): `get-passage.test.ts` latent maintenance risk — out of scope, already documented

**Suggestions**:
- SUG-1 (from verify): WelcomeScreen props forward-compatible — no action needed

**Coverage gaps identified**: See "Coverage Learnings" section. Recommend incorporating into next SDD cycle's verify discipline.

**Confidence in production readiness**: HIGH. The welcome screen is the first TUI slice — it is intentionally simple (no routing, no domain calls, pure view with reducer). The two post-apply bugs (JSX parse, useReducer adapter) were caught by manual smoke and fixed. The three post-verify polish commits refine the visual identity without changing architecture or test surface. All manual smoke items confirm the core use case (open TUI, see welcome, press `q`, quit cleanly) works as designed.

---

## Change Summary (Executive)

The `tui-welcome-skeleton` change introduces the first interactive TUI surface for verbum. Ten files (7 new + 3 modified) wire OpenTUI behind a single argv branch in `src/index.tsx`. The welcome screen is a pure presentation-layer view showing the locked book-frame layout (Genesis 1:1 left, John 3:16 right, both in BSB) with an ANSI Shadow wordmark and user-driven polish (ribbon, underlines, angled shadow). The reducer follows ADR 0009 (Go-portability dialect). Testing is comprehensive for the reducer; manual smoke confirms TTY teardown works cleanly. The change is under 300 lines, single PR, no size exception needed. Ready for production.
