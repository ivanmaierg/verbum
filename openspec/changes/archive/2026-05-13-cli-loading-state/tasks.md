# Tasks — cli-loading-state

## TL;DR

13 tasks across 4 commits (C1–C4). Strict TDD mode: tests ship in their own commit
before the implementation commit. Net diff ~155 lines (logic) + 2 modified lines.
Single PR — logic surface is well under the 400-line budget.

---

## Phase 1 — Red (failing tests)

### C1 — `test(cli): add failing unit tests for loading module`

Files: `src/cli/loading.test.ts` (NEW, ~80 lines)

- [ ] **T-01 — Create `src/cli/loading.test.ts` with all unit test groups**
  - REQ: REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-12
  - Files: `src/cli/loading.test.ts`
  - Rationale: Write every test described in the design before the implementation exists. All tests must fail at this point (import will fail entirely until loading.ts is created — that is expected and counts as red).
  - Coverage: Fake stream factory, `isSpinnerEnabled` truth table (S1–S8), `withLoading` no-op path, TTY-true renders + cleanup, rejection path, frame array validation

---

## Phase 2 — Green (implementation)

### C2 — `feat(cli): implement loading module — spinner + isSpinnerEnabled`

Files: `src/cli/loading.ts` (NEW, ~50 lines)

- [ ] **T-02 — Create `src/cli/loading.ts` with exports and types**
  - REQ: REQ-1, REQ-2, REQ-11
  - Files: `src/cli/loading.ts`
  - Rationale: Export the exact type-level surface locked by REQ-1 and REQ-2.
  - Checklist: SPINNER_FRAMES tuple, SpinnerFrame type, WithLoadingOptions, stub signatures, no package.json changes

- [ ] **T-03 — Implement `isSpinnerEnabled` precedence chain**
  - REQ: REQ-2, REQ-3
  - Files: `src/cli/loading.ts`
  - Rationale: Mirrors `isColorEnabled` in `ansi.ts`. Precedence: NO_COLOR → FORCE_COLOR → isTTY
  - Checklist: NO_COLOR check → FORCE_COLOR logic → isTTY fallback, intentional duplication (not shared utility)

- [ ] **T-04 — Implement `withLoading` control flow**
  - REQ: REQ-1, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8
  - Files: `src/cli/loading.ts`
  - Rationale: Two paths — TTY-false (no-op), TTY-true (animate + cleanup)
  - Checklist: Gate check, initial frame write, setInterval tick loop, try/finally cleanup, R1 spirit (no throw)

---

## Phase 3 — Integration

### C3 — `feat(cli): wrap getPassage with withLoading in run.ts and vod.ts`

Files: `src/cli/run.ts` (MODIFY), `src/cli/vod.ts` (MODIFY)

- [ ] **T-05 — Integrate `withLoading` into `run.ts`**
  - REQ: REQ-9
  - Files: `src/cli/run.ts`
  - Checklist: One import + one line wrap at line 39

- [ ] **T-06 — Integrate `withLoading` into `vod.ts`**
  - REQ: REQ-10
  - Files: `src/cli/vod.ts`
  - Checklist: One import + one line wrap at line 40

---

## Phase 4 — Smoke

### C4 — `test(cli): extend vod-smoke with loading-state assertion`

Files: `tests/vod-smoke.test.ts` (MODIFY — append one `describe` block)

- [ ] **T-07 — Extend `tests/vod-smoke.test.ts` with no-spinner-in-pipe smoke assertion**
  - REQ: REQ-13
  - Files: `tests/vod-smoke.test.ts`
  - Checklist: Append describe block, NO_COLOR save/restore, stderr write spy, runVod call, assert no frames/carriage returns

- [ ] **T-08 — Run full test suite and confirm zero regressions**
  - REQ: REQ-11, REQ-12, REQ-13
  - Files: none (read-only verification)
  - Checklist: `bun test` passes, package.json unchanged, loading.test.ts passes, vod-smoke.test.ts passes

---

## Commit Map

| Commit | Tasks | Files | TDD Phase |
|--------|-------|-------|-----------|
| C1 | T-01 | `src/cli/loading.test.ts` (NEW) | Red |
| C2 | T-02, T-03, T-04 | `src/cli/loading.ts` (NEW) | Green |
| C3 | T-05, T-06 | `src/cli/run.ts`, `src/cli/vod.ts` (MODIFY) | Integration |
| C4 | T-07, T-08 | `tests/vod-smoke.test.ts` (MODIFY) | Smoke + Verify |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~155 (loading.ts ~50 + loading.test.ts ~80 + run.ts +2 + vod.ts +2 + smoke +20) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |
| Suggested PR structure | Single PR (4 ordered work-unit commits) |
