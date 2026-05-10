#210 [architecture] sdd/visual-identity-v1/apply-progress
**What**: Implemented all 5 commits for visual-identity-v1 on branch feat/visual-identity-v1

**Branch**: feat/visual-identity-v1 (off main @ c2d4c36)

**Status**: complete

**Commit SHAs (in order)**:
- C1: 60d8103 — feat(presentation): add shared color constants module
- C2: b3a9b9c — feat(cli): add ANSI helpers with TTY/NO_COLOR detection
- C3: 203641f — feat(tui): split wordmark into dim/accent two-tone via banner generator
- C4: 9a34b28 — feat(cli): apply error/text tokens to passage and error rendering
- C5: 84e2450 — docs: reconcile ui-sketches with locked accent direction

**Tasks completed (11/11)**:
- [x] T-1.1 src/presentation/colors.ts — ACCENT_HEX constant
- [x] T-2.1 src/cli/ansi.test.ts — full truth table RED phase
- [x] T-2.2 src/cli/ansi.ts — ANSI helpers + isColorEnabled GREEN phase
- [x] T-3.1 scripts/generate-banner.ts — dual figlet with parity guard
- [x] T-3.2 bun run generate:banner executed, src/cli/banner.ts regenerated
- [x] T-3.3 src/tui/welcome/welcome-screen.tsx — two-tone wordmark
- [x] T-3.4 Atomic C3 commit (all three files)
- [x] T-4.1 src/cli/render.test.ts — baseline + color tests RED phase
- [x] T-4.2 src/cli/render.ts — error token wrap GREEN phase
- [x] T-5.1 docs/ui-sketches.md — accent direction reconciliation

**Test results**:
- After C1: 59 pass / 0 fail (8 files)
- After C2: 77 pass / 0 fail (9 files — +18 new ansi tests)
- After C3: 77 pass / 0 fail (9 files — no new tests, imports verified)
- After C4: 83 pass / 0 fail (10 files — +6 new render tests)
- After C5: 83 pass / 0 fail (10 files — docs only, no test change)

**Deviations from design**:
1. accent() helper closer: spec says \x1b[0m (full reset). Design test code showed \x1b[39m but binding constraint #5 and spec S1 are unambiguous — used \x1b[0m as closer. Test updated to match spec.
2. env restore in ansi.test.ts: used save/restore pattern (individual key save) instead of full process.env overwrite — safer in Bun's test runner which doesn't always isolate env between tests.

**Working tree**: openspec/ directory exists but was NOT touched. Only spec-relevant files committed with specific git add paths.

## Post-verify follow-up commits

| Commit | Description |
|--------|-------------|
| C6: 2b23b03 | fix(tui): render two-tone wordmark side-by-side via per-line spans |

**C6 details**: The wordmark rendering bug was discovered post-verify during manual user inspection of the running TUI. The two-tone wordmark was stacking "UM" below "VERB" instead of rendering side-by-side. Root cause: OpenTUI cannot render two adjacent multi-line spans on the same row — newlines inside the first span force the second span to a new line. Fix: changed the banner generator exports from multi-line strings (`BANNER_DIM_PART`, `BANNER_ACCENT_PART` as single strings with embedded newlines) to per-line arrays (`BANNER_DIM_LINES`, `BANNER_ACCENT_LINES`), and updated welcome-screen.tsx to map-render each row as its own `<text>` element with two adjacent spans (one DIM, one with ACCENT_HEX color). 83/83 tests still pass; user confirmed the fix visually on the rendered TUI.

**Next**: sdd-verify complete; ready for archive
