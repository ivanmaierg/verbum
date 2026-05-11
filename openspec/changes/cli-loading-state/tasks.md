# Tasks — cli-loading-state

## TL;DR

13 tasks across 4 commits (C1–C4). Strict TDD mode: tests ship in their own commit
before the implementation commit. Net diff ~155 lines (logic) + 2 modified lines.
Single PR — logic surface is well under the 400-line budget.

---

## Phase 1 — Red (failing tests)

### C1 — `test(cli): add failing unit tests for loading module`

Files: `src/cli/loading.test.ts` (NEW, ~80 lines)

---

- [ ] **T-01 — Create `src/cli/loading.test.ts` with all unit test groups**
  - REQ: REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-12
  - Files: `src/cli/loading.test.ts`
  - Rationale: Write every test described in the design before the implementation exists. All tests must fail at this point (import will fail entirely until loading.ts is created — that is expected and counts as red).
  - Checklist:
    - [ ] Import: `import { withLoading, isSpinnerEnabled, SPINNER_FRAMES } from "./loading";`
    - [ ] Define `fakeStream(isTTY)` factory returning `{ stream: NodeJS.WriteStream, writes: string[] }` — pattern from `ansi.test.ts`
    - [ ] **Group 1 — `isSpinnerEnabled` truth table** (cases S1–S8 from design):
      - [ ] S1: TTY, no env → `true`
      - [ ] S2: pipe, no env → `false`
      - [ ] S3: TTY, `NO_COLOR="1"` → `false`
      - [ ] S4: TTY, `NO_COLOR=""` (empty) → `true` (empty = no opinion)
      - [ ] S5: pipe, `FORCE_COLOR="1"` → `true` (override)
      - [ ] S6: TTY, `FORCE_COLOR="0"` → `false`
      - [ ] S7: TTY, `FORCE_COLOR="false"` → `false`
      - [ ] S8: pipe, `NO_COLOR="1"` + `FORCE_COLOR="1"` → `false` (NO_COLOR wins)
      - [ ] Use `beforeEach`/`afterEach` env-var save/restore pattern cloned from `ansi.test.ts`
    - [ ] **Group 2 — `withLoading` TTY-false no-op**:
      - [ ] T-NOOP-1: `isTTY=false`, fn returns `42`, `interval: 1_000_000` → no writes, result `42` (REQ-5)
      - [ ] T-NOOP-2: `isTTY=false`, fn returns `{ ok: true, value: "x" }` → passes through with referential equality (REQ-8)
    - [ ] **Group 3 — `withLoading` TTY-true renders + cleans up**:
      - [ ] T-TTY-1: `isTTY=true`, `interval: 1_000_000`, fn resolves `7` → `writes[0] === "\r⠋"`, `writes[last] === "\r \r"`, result `7` (REQ-4, REQ-6, REQ-7)
      - [ ] T-TTY-2: `isTTY=true`, `interval: 1`, fn awaits microtask → cleanup is still last write (REQ-7 survival under real tick)
    - [ ] **Group 4 — `withLoading` rejection path**:
      - [ ] T-REJECT-1: `isTTY=true`, fn rejects `new Error("nope")` → `expect(...).rejects.toThrow("nope")`, `writes[last] === "\r \r"` after settle (REQ-7, REQ-8)
    - [ ] **Group 5 — frame array shape**:
      - [ ] T-FRAMES-1: `SPINNER_FRAMES.length === 10` (REQ-4)
      - [ ] T-FRAMES-2: every frame is a single-grapheme string (`frame.length === 1`) (REQ-4)
  - **Acceptance**: `bun test src/cli/loading.test.ts` — all tests FAIL with import error (red confirmed)

---

## Phase 2 — Green (implementation)

### C2 — `feat(cli): implement loading module — spinner + isSpinnerEnabled`

Files: `src/cli/loading.ts` (NEW, ~50 lines)

---

- [ ] **T-02 — Create `src/cli/loading.ts` with exports and types**
  - REQ: REQ-1, REQ-2, REQ-11
  - Files: `src/cli/loading.ts`
  - Rationale: Export the exact type-level surface locked by REQ-1 and REQ-2. TypeScript compiler must accept `withLoading(process.stderr, () => somePromise)` without errors and infer `T`.
  - Checklist:
    - [ ] Export `SPINNER_FRAMES` — 10-element `as const` Braille tuple: `["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]`
    - [ ] Export `SpinnerFrame = (typeof SPINNER_FRAMES)[number]`
    - [ ] Export `WithLoadingOptions = { readonly interval?: number }`
    - [ ] Export stub stubs `isSpinnerEnabled` and `withLoading` with correct signatures (can be stubs at this step — next task fills bodies)
    - [ ] No `package.json` changes (REQ-11)

- [ ] **T-03 — Implement `isSpinnerEnabled` precedence chain**
  - REQ: REQ-2, REQ-3
  - Files: `src/cli/loading.ts`
  - Rationale: Exactly mirrors `isColorEnabled` in `ansi.ts`. Precedence: NO_COLOR (non-empty) → false; FORCE_COLOR "0"/"false" → false; FORCE_COLOR (other non-empty) → true; isTTY === true → true; fallback → false.
  - Checklist:
    - [ ] Step 1: `if (process.env.NO_COLOR) return false`
    - [ ] Step 2: read `process.env.FORCE_COLOR`; if present, lowercase it: `"0"` or `"false"` → `false`; else → `true`
    - [ ] Step 3: fallback `return stream.isTTY === true`
    - [ ] No shared utility with `isColorEnabled` — intentional duplication (design decision)

- [ ] **T-04 — Implement `withLoading` control flow**
  - REQ: REQ-1, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8
  - Files: `src/cli/loading.ts`
  - Rationale: Two paths — (a) TTY-false: return `fn()` directly, zero writes; (b) TTY-true: initial frame write → setInterval → try/await fn → finally clearInterval + cleanup write. Cleanup must be `"\r" + " ".repeat(1) + "\r"` — erase exactly the frame column.
  - Checklist:
    - [ ] TTY-false path: `if (!isSpinnerEnabled(stream)) return fn()` — no try/finally, no writes
    - [ ] TTY-true path: write `"\r" + SPINNER_FRAMES[0]` before starting interval (initial render before awaiting fn)
    - [ ] Start `setInterval` at `options?.interval ?? 80` — each tick: `stream.write("\r" + SPINNER_FRAMES[i % SPINNER_FRAMES.length]); i++`
    - [ ] `try { return await fn() } finally { clearInterval(handle); stream.write("\r \r") }`
    - [ ] Interval handle typed as `ReturnType<typeof setInterval>` (not `NodeJS.Timeout`)
    - [ ] Never write to `process.stdout` or any stream other than the passed `stream`
    - [ ] `fn` rejection propagates unchanged — do NOT catch or convert to Result (R1 spirit)
  - **Acceptance**: `bun test src/cli/loading.test.ts` — all ~14 tests pass, zero open handle warnings (green confirmed)

---

## Phase 3 — Integration

### C3 — `feat(cli): wrap getPassage with withLoading in run.ts and vod.ts`

Files: `src/cli/run.ts` (MODIFY), `src/cli/vod.ts` (MODIFY)

---

- [ ] **T-05 — Integrate `withLoading` into `run.ts`**
  - REQ: REQ-9
  - Files: `src/cli/run.ts`
  - Rationale: Deliver the spinner for the primary `verbum <book> <ref>` command path. Exactly one line changes plus one import — no other lines touch (REQ-9 constraint).
  - Checklist:
    - [ ] Add `import { withLoading } from "@/cli/loading";` after the existing `@/cli/render` import
    - [ ] Change line 39: `await getPassage(repo, refResult.value)` → `await withLoading(process.stderr, () => getPassage(repo, refResult.value))`
    - [ ] No other lines in `run.ts` change

- [ ] **T-06 — Integrate `withLoading` into `vod.ts`**
  - REQ: REQ-10
  - Files: `src/cli/vod.ts`
  - Rationale: Deliver the spinner for `verbum vod`. Pattern identical to REQ-9 (same import path, same wrapping shape).
  - Checklist:
    - [ ] Add `import { withLoading } from "@/cli/loading";` after the existing `@/cli/render` import
    - [ ] Change line 40: `await getPassage(repo, ref)` → `await withLoading(process.stderr, () => getPassage(repo, ref))`
    - [ ] No other lines in `vod.ts` change
  - **Acceptance**: `bun test` full suite passes; layer audit clean (no new dependencies in `package.json`)

---

## Phase 4 — Smoke

### C4 — `test(cli): extend vod-smoke with loading-state assertion`

Files: `tests/vod-smoke.test.ts` (MODIFY — append one `describe` block)

---

- [ ] **T-07 — Extend `tests/vod-smoke.test.ts` with no-spinner-in-pipe smoke assertion**
  - REQ: REQ-13
  - Files: `tests/vod-smoke.test.ts`
  - Rationale: End-to-end proof that piped/redirected invocations get zero spinner bytes on stderr. Uses `NO_COLOR=1` (safe save/restore in finally) rather than mutating `process.stderr.isTTY`. Extends the existing file — no new smoke file (design decision to avoid harness duplication).
  - Checklist:
    - [ ] Append `describe("smoke — verbum vod loading state is invisible to redirected pipelines", ...)` block
    - [ ] Save `process.env.NO_COLOR` before mutation; restore in `finally`
    - [ ] Monkey-patch `process.stderr.write` inside the describe block; restore in `finally`
    - [ ] Call `await runVod(fixed, stubRepo)` with a deterministic fixed date and the existing `stubRepo`
    - [ ] Assert none of the 10 Braille frames appear in captured stderr
    - [ ] Assert `"\r"` does not appear in captured stderr
    - [ ] No new test files — only extend `tests/vod-smoke.test.ts`
  - **Acceptance**: `bun test tests/vod-smoke.test.ts` passes; Bun reports zero open handle warnings

---

## Phase 5 — Verify

- [ ] **T-08 — Run full test suite and confirm zero regressions**
  - REQ: REQ-11, REQ-12, REQ-13
  - Files: none (read-only verification)
  - Rationale: Final gate before PR — all pre-existing tests must continue to pass; no new dependencies in `package.json`.
  - Checklist:
    - [ ] `bun test` — all tests pass
    - [ ] Confirm `package.json` is unchanged (REQ-11)
    - [ ] Confirm `bun test src/cli/loading.test.ts` exits with zero and no open handle warnings
    - [ ] Confirm `bun test tests/vod-smoke.test.ts` exits with zero

---

## Dependency Order

```
T-01 (red tests)
  └─ T-02 (types + exports)
       └─ T-03 (isSpinnerEnabled impl)
            └─ T-04 (withLoading impl — green)
                 ├─ T-05 (run.ts integration)
                 └─ T-06 (vod.ts integration)
                      └─ T-07 (smoke extension)
                           └─ T-08 (verify)
```

T-05 and T-06 can be done in either order within C3 — they touch different files and have no shared dependency between them.

---

## Commit Map

| Commit | Tasks | Files | TDD Phase |
|--------|-------|-------|-----------|
| C1 | T-01 | `src/cli/loading.test.ts` (NEW) | Red |
| C2 | T-02, T-03, T-04 | `src/cli/loading.ts` (NEW) | Green |
| C3 | T-05, T-06 | `src/cli/run.ts`, `src/cli/vod.ts` (MODIFY) | Integration |
| C4 | T-07, T-08 | `tests/vod-smoke.test.ts` (MODIFY) | Smoke + Verify |

---

## House Rules Compliance (per task)

| Task | Rules checked |
|------|---------------|
| T-01 | REQ-12: fake streams only, no global monkey-patch; `afterEach` env restore |
| T-02 | R11: no decorators; R1: transparent to Result; R5: no new error types |
| T-03 | R12: isSpinnerEnabled is the sole gate; intentional duplication (not R3 — not a port) |
| T-04 | R1: never throws; R12: `withLoading<T>` transparent; R3 N/A (thunk ≠ port callback) |
| T-05 | REQ-9: only one line + one import change |
| T-06 | REQ-10: identical pattern to T-05 |
| T-07 | REQ-13: NO_COLOR save/restore in `finally`; no new test files |
| T-08 | REQ-11: `package.json` unchanged |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~155 (loading.ts ~50 + loading.test.ts ~80 + run.ts +2 + vod.ts +2 + smoke +20) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |
| Suggested PR structure | Single PR (4 ordered work-unit commits) |
