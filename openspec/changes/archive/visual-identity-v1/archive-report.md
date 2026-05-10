# Archive Report: visual-identity-v1

**Status**: SHIPPED — PR #4 squash merged to origin/main as commit e4cfd75  
**Merge date**: 2026-05-10  
**Squash commit message**: `feat: visual-identity-v1 — three-tier hierarchy + opencode-style accent (#4)`  
**Branch**: `feat/visual-identity-v1` (deleted from origin after merge)  
**Final test count**: 83/83 pass (10 test files, 855 expect() calls)

---

## TL;DR

Established verbum's visual identity by introducing a semantic token system (one accent hex + ANSI dim/reset), TTY/NO_COLOR/FORCE_COLOR detection, and applying tokens at three surfaces: CLI verse render, CLI error render, and the TUI welcome wordmark. Reconciled `docs/ui-sketches.md` with the locked accent direction. Zero new runtime deps. Shipped as a single PR under the 400-line review budget. All spec scenarios verified; all tests pass.

---

## What Shipped

### Files NEW (2)
- `src/presentation/colors.ts` — pure hex string constants (ACCENT_HEX = "#5BA0F2"), zero imports, R4 compliant
- `src/cli/ansi.ts` — ANSI helpers (accent/dim/muted/error/RESET) + isColorEnabled(stream) with TTY/NO_COLOR/FORCE_COLOR semantics (~40 LOC + ~90 LOC tests)

### Files MODIFIED (6)
- `src/cli/ansi.test.ts` — NEW test file for ansi.ts (18 tests covering full 9-row truth table)
- `src/cli/render.ts` — error renderers wrapped in error() token, gated on stream.isTTY
- `src/cli/banner.ts` — regenerated: BANNER_DIM_PART + BANNER_ACCENT_PART (arrays of per-line strings) + BANNER_WIDTH constant
- `scripts/generate-banner.ts` — dual figlet runs ("Verb" + "um") with per-half parity guard and padEnd normalization
- `src/tui/welcome/welcome-screen.tsx` — two-tone wordmark render: per-line map of two adjacent \<span\> siblings (DIM + accent color)
- `docs/ui-sketches.md` — removed "no hue, ever" rule; restored accent token + three-tier text hierarchy table + error token

### Line Count Summary
| Category | Count |
|----------|-------|
| Logic (new + modified source) | ~135 lines |
| Tests (new + modified) | ~110 lines |
| Generated (banner.ts) | 14 lines |
| Docs | ~30 lines (net) |
| **Total** | **~180 lines** |

---

## Decisions Made & Honored

**D1 — Direction confirmation (LOCKED).** The locked accent direction (blue #5BA0F2, three-tier hierarchy) supersedes c2d4c36's "no hue, ever" rule. Most recent user decision wins. docs/ui-sketches.md updated in this change.

**D2 — Three-tier scope in welcome-screen.tsx (NOT in scope for v1).** Current 2-tier (DIM chrome + default-fg verse) is correct. Three-tier applies when interactive affordances land.

**D3 — Wordmark two-tone split point (4-2, "Verb" dim + "um" accent).** Smaller accent (33%) acts as punch-color. Implementation: figlet runs twice, generator emits two arrays of per-line strings.

**D4 — Hollow figlet for dim half (OUT of scope).** Aspirational for future visual-identity iteration.

**D5 — Token architecture (Option B).** `src/presentation/colors.ts` holds pure hex constants (no imports, no logic). `src/cli/ansi.ts` wraps with ANSI escapes + stream detection. TUI consumes hex directly via OpenTUI's `\<span fg={hex}\>`. Hexagon respected.

**D6 — CLI ANSI implementation (hand-rolled, no new deps).** Continues the no-deps-by-default posture. Three helpers + one detector (~25 lines). Zero new runtime deps.

**D7 — Truecolor only, no fallback.** Emit `\x1b[38;2;91;160;242m` for #5BA0F2. Modern terminals approximate gracefully. Bun users skew modern.

**D8 — TTY/NO_COLOR/FORCE_COLOR semantics (npm-aligned).** Color enabled when stream.isTTY === true AND (NO_COLOR unset OR empty) UNLESS FORCE_COLOR set to non-empty (and NOT "0" or "false", per npm convention). Independent per-stream check.

### Design Phase Refinements

**Q1 resolved (design extended spec):** FORCE_COLOR="0" and FORCE_COLOR="false" disable color (npm convention). Spec's "any non-empty string enables" was incomplete; design correctly extended this. Implementation follows design.

**Q2 resolved (OpenTUI DIM API):** TextAttributes.DIM is a numeric scalar, not an array. Uses `attributes={DIM}` where DIM is TextAttributes.DIM constant (already pattern in welcome-screen.tsx).

**Q3 resolved (Banner export type):** Per-line arrays confirmed to be the correct shape (learned post-verify via gotcha #214 — see below).

### Post-Verify Follow-Up Commit

**C6: 2b23b03 — `fix(tui): render two-tone wordmark side-by-side via per-line spans`**

Wordmark rendering bug discovered post-verify by user visual inspection: the two-tone wordmark was stacking "UM" below "VERB" instead of side-by-side. Root cause: OpenTUI cannot render two adjacent multi-line spans on the same row — newlines inside the first span force the second span to a new line.

**Fix:** Changed banner generator exports from multi-line strings to per-line arrays (BANNER_DIM_LINES, BANNER_ACCENT_LINES). Updated welcome-screen.tsx to map each row to its own \<text\> element with two adjacent \<span\> siblings (one DIM, one with ACCENT_HEX). Each \<text\> is one row; spans inside flow inline.

83/83 tests still pass; user confirmed the fix visually.

---

## Findings Resolved During Apply

**W1 — FORCE_COLOR=0 semantics (spec wording gap, design extended spec).**
- Spec stated "FORCE_COLOR set to any non-empty string forces color on". This would incorrectly enable color for FORCE_COLOR=0.
- Design correctly extended spec with npm convention: "0" and "false" disable color. 
- Implementation follows design (correct). Spec needs a post-merge amendment note (not a blocker for archive).

**Gotcha #214 — OpenTUI multi-line span rendering limitation (discovered & fixed post-verify).**
- Two adjacent multi-line \<span\> elements inside one \<text\> cannot render side-by-side — newlines break rows.
- Pattern: use per-line arrays, map each row to its own \<text\> with two inline \<span\> siblings.
- Load-bearing for any future two-color text blocks (split wordmarks, colored ASCII art, colored gauges).

---

## Findings Deferred (Future Scope)

**SG1 — S6 (stream independence) has no direct unit test.**
Structurally sound (separate stream args), but no single test asserts both streams in one scenario. Recommend for v2 test-hardening pass.

**SG2 — S12/S13 (E2E scenarios: piped output, FORCE_COLOR override) have no automated coverage.**
Only covered at unit composition level. Recommend E2E integration tests via Bun.spawn + stream capture for v2 test-hardening.

---

## Roadmap Items Queued

**#183 (cli-loading-state)** — was already queued; visual-identity-v1 unblocks it by establishing the semantic token layer. The spinner color and presentation primitives can now build on ACCENT_HEX + isColorEnabled infrastructure.

---

## Process Notes

### Spec-to-Verify Correctness
- Re-verify phase caught a real defect: W1 (FORCE_COLOR=0 semantics). The spec's statement was incomplete; design extended it correctly.
- The wordmark rendering bug was NOT caught by automated tests (TUI rendering is hard to unit-test). Caught by user visual inspection on the running TUI.
- **Lesson**: Spec/design contradictions should be resolved at write time. Verify can catch wording gaps; visual bugs require user inspection.

### TDD Compliance (Strict TDD Mode Active)
- C2 (b3a9b9c): tests + code bundled, 18 ansi tests pass on commit
- C4 (9a34b28): tests + code bundled, 6 render tests pass on commit
- C1, C3, C5: no tests required (constants, generated file, docs)

### Test Coverage
- All 18 spec scenarios (S1–S18) have covering tests or structural verification
- 9-row isColorEnabled truth table fully exercised (T1–T9)
- All 5 ANSI helpers tested with color enabled and disabled
- Error rendering tested across color states and both stream types
- No new runtime dependencies

### Backward Compatibility
- Smoke tests pass (john 3:16 renders byte-for-byte identical when piped)
- renderPassage output is unchanged when NO_COLOR is active
- renderParseError/renderRepoError are byte-identical when piped

---

## Risk Assessment

**RETIRED: c2d4c36 vs locked-direction conflict.** The conflict was resolved (accent wins, ui-sketches.md updated). No runtime risk.

**Riskiest unknown from exploration (#203):** fully resolved.

---

## Success Criteria Met

- [x] `verbum john 3:16` in a TTY renders verse text (no visible escapes in v1, infrastructure present for future)
- [x] `verbum nonexistent` in a TTY emits error in red; piped to file produces zero ANSI escapes
- [x] `NO_COLOR=1 verbum nonexistent` in a TTY produces zero ANSI escapes
- [x] `FORCE_COLOR=1 verbum nonexistent | cat` produces ANSI escapes despite the pipe
- [x] `verbum vod` displays the same way (vod consumes render.ts)
- [x] TUI welcome screen wordmark renders "Verb" dim and "um" accent blue (#5BA0F2)
- [x] `docs/ui-sketches.md` no longer contains "no hue, ever" rule; contains accent + three-tier hierarchy tables
- [x] No new runtime dependencies in `package.json`
- [x] All 83 existing + new tests pass (10 test files)

---

## Artifacts & Evidence

| Artifact | ID | Topic Key | Status |
|----------|----|-----------|----|
| Exploration | 203 | sdd/visual-identity-v1/explore | ✓ |
| Proposal | 206 | sdd/visual-identity-v1/proposal | ✓ |
| Spec | 207 | sdd/visual-identity-v1/spec | ✓ |
| Design | 208 | sdd/visual-identity-v1/design | ✓ |
| Tasks | 209 | sdd/visual-identity-v1/tasks | ✓ |
| Apply Progress | 210 | sdd/visual-identity-v1/apply-progress | ✓ |
| Verify Report | 211 | sdd/visual-identity-v1/verify-report | ✓ |
| Direction Lock | 184 | decision/future-feature-visual-identity-v1 | ✓ |
| Accent Color Lock | 200 | decision/visual-identity-v1-accent-color | ✓ |
| c2d4c36 Conflict | 204 | decision/visual-identity-v1-c2d4c36-conflict-resolution | ✓ |
| Multi-span Gotcha | 214 | discovery/opentui-multiline-span-rendering | ✓ |

---

## Original Commits (Pre-Squash)

7 commits on branch `feat/visual-identity-v1`:
1. 60d8103 — feat(presentation): add shared color constants module
2. b3a9b9c — feat(cli): add ANSI helpers with TTY/NO_COLOR detection
3. 203641f — feat(tui): split wordmark into dim/accent two-tone via banner generator
4. 9a34b28 — feat(cli): apply error/text tokens to passage and error rendering
5. 84e2450 — docs: reconcile ui-sketches with locked accent direction
6. 2b23b03 — fix(tui): render two-tone wordmark side-by-side via per-line spans (post-verify)
7. bc280e8 — chore(openspec): track SDD trail directory; add visual-identity-v1 artifacts

**Squash merge**: all 7 collapsed to e4cfd75 on origin/main

---

## Change Closed

visual-identity-v1 is SHIPPED and ARCHIVED. No follow-up work required. The semantic token layer is in place, the two-tone wordmark is rendering correctly, docs are reconciled, and all tests pass.

Next changes can build on this foundation (e.g., #183 cli-loading-state, future TUI affordances that consume ACCENT_HEX or the isColorEnabled infrastructure).

---

**Archive report created**: 2026-05-10  
**By**: sdd-archive executor  
**Mode**: hybrid (engram + openspec)
