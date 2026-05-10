# Verify Report: verbum-vod (Re-verify)

**Verdict**: PASS WITH WARNINGS
**Findings**: 0 CRITICAL / 1 WARNING / 1 SUGGESTION (down from 2W/2SG)

---

## TL;DR

Re-verify of `feat/verbum-vod` after followup commits C5 (SG1 refactor) and C6 (W1 test).

- Full suite: 59 pass / 0 fail (was 58). +1 is exactly the W1 exit-1 test.
- SG1 fully resolved: `as RepoError` casts removed from `run.ts` and `vod.ts`; `isRepoError` type predicate added to `src/domain/errors.ts`; runtime predicate verified correct.
- W1 fully resolved: exit-1 path now has a direct test in `tests/vod-smoke.test.ts`.
- W2 remains skipped: documented as intentional — exit-2 path is structurally unreachable given I2.
- 1 WARNING remains: the exhaustiveness check in `errors.ts` has its conditional direction reversed.
- Previous SG2 (dayOfYear comment nit) remains low-priority; no action taken; still a SUGGESTION.

---

## Re-verify Summary

| Item | Previous status | Current status |
|------|----------------|-----------------|
| SG1 — `as RepoError` casts | SUGGESTION | RESOLVED (C5) |
| W1 — S5 network failure test | WARNING | RESOLVED (C6) |
| W2 — S4 exit-2 test | WARNING | SKIPPED (documented, intentional) |
| SG2 — dayOfYear comment nit | SUGGESTION | unchanged, still SUGGESTION |
| New: exhaustiveness check direction | — | WARNING (new finding) |

---

## Spec Scenario Coverage Table

| # | Scenario | Test file | Test name | Status |
|---|----------|-----------|-----------|--------|
| S1 | Same-day determinism | tests/vod-smoke.test.ts | "runVod is deterministic..." | COVERED |
| S2 | Day-over-day variation | src/application/verse-pool.test.ts | "day N+1 ≠ day N" | COVERED |
| S3 | Year wrap-around (non-leap) | src/application/verse-pool.test.ts | "Dec 31 2025 → VERSE_POOL[0]" | COVERED |
| S4 | Invalid pool entry — exit 2 | NONE | W2 intentional skip (I2 makes unreachable) | WARNING (skip) |
| S5 | Network failure — exit 1 | tests/vod-smoke.test.ts | "runVod returns 1 and writes network error" | COVERED ✓ |
| S6 | Pool integrity — test-time check | src/application/verse-pool.test.ts | "I2: every entry's usfm..." | COVERED |
| S7 | vod subcommand dispatched | run.ts + vod-smoke.test.ts | structural + smoke | COVERED |
| S8 | Backward compatibility | tests/smoke.test.ts | 3 existing tests | COVERED |

---

## Findings

### WARNING

**W-REMAIN — exhaustiveness check direction in errors.ts is reversed**
- File: `src/domain/errors.ts` line 39
- Code: `const _exhaustiveCheck: RepoErrorKind extends RepoError["kind"] ? true : never = true;`
- The intended guard is: "if a new RepoError variant is added but REPO_ERROR_KINDS is not updated, fail at compile time."
- The actual guard does the opposite: it fires if REPO_ERROR_KINDS contains a kind that is NOT in RepoError["kind"]. That is, it catches stale entries in REPO_ERROR_KINDS, not missing ones.
- If `RepoError` gains `{ kind: "timeout" }` but REPO_ERROR_KINDS still has only 6 entries: `RepoErrorKind` (6 members) extends `RepoError["kind"]` (7 members) = true. Check does NOT fire. isRepoError silently misclassifies "timeout" as ParseError.
- The correct check is: `RepoError["kind"] extends RepoErrorKind ? true : never` — a 7-member union extending a 6-member union = never → error.
- Runtime behavior of isRepoError is currently correct (all 6 variants match). Risk only materialises when a new RepoError variant is added.
- Not CRITICAL because no new RepoError variants are imminent and the predicate works today. But the guard is broken and gives false confidence.

**W-S4-SKIP — exit-2 path remains untested (documented intentional skip)**
- File: tests/vod-smoke.test.ts
- No test exercises runVod with a bad pool entry → exit 2. I2 invariant makes this unreachable in production. Skip is documented in apply-progress.
- Future risk: if I2 is ever weakened (pool injectable, dynamic pool), the exit-2 path becomes reachable but untested. No footgun today.

### SUGGESTION

**SG2 — dayOfYear comment could be clearer (unchanged from previous verify)**
- File: `src/application/verse-pool.ts`
- "local calendar fields, UTC epoch arithmetic" worth clarifying. Non-blocking.

---

## Evidence

### Test run (HEAD: 3c8e673)
- Full suite: **59 pass / 0 fail / 831 expect() calls** across 8 files in ~28ms
- `tests/vod-smoke.test.ts`: **3 pass** (was 2 after C3; +1 is exactly the W1 exit-1 test)
- Test count delta: 58 → 59 (+1 = W1 test only). CONFIRMED.

### TypeScript (bunx tsc --noEmit)
- **Pre-existing errors only** — confirmed by stashing all 6 verbum-vod commits and running tsc on main: identical error list (bun:test not found, process not found, Bun not found). These are project-wide tsconfig gaps predating this change.
- C5 and C6 introduce **zero new tsc errors**.

### Commit inspection

| # | SHA | Message | Format | Attribution |
|---|-----|---------|--------|-------------|
| C5 | 8207373 | `refactor(cli): replace AppError casts with kind-based narrowing` | Conventional ✓ | None ✓ |
| C6 | 3c8e673 | `test(vod): cover runVod exit-1 path with failing repo stub` | Conventional ✓ | None ✓ |

C5: pure refactor (no new logic), 3 files, 42+/11−. Existing suite is regression net. No new logic without tests. PASS.
C6: test-only commit. 1 file (tests/vod-smoke.test.ts), 43 insertions. Central change is the test. PASS.

### SG1 verification

1. `src/domain/errors.ts`: `isRepoError` type predicate added. Runtime check via `REPO_ERROR_KINDS.includes(err.kind)`. Verified at runtime: network → true, unknown_book → false. CORRECT.
2. `src/cli/run.ts`: No `as RepoError` cast. Uses `isRepoError(err)` guard with both branches (renderRepoError / renderParseError). CORRECT.
3. `src/cli/vod.ts`: No `as RepoError` cast. Same dual-branch narrowing. CORRECT.
4. Exhaustiveness check present but direction reversed — see WARNING above.

### W1 verification

- Test in `tests/vod-smoke.test.ts` lines 43–76.
- Uses `failingRepo: BibleRepository` with `getChapter` returning `{ ok: false, error: { kind: "network", message: "simulated failure" } }`.
- Asserts: `exitCode === 1` ✓, `stderrCapture.toContain("network failure")` ✓ (renderRepoError produces "Error: network failure — simulated failure"), `stdoutCapture === ""` ✓.
- Spy cleanup via try/finally. CORRECT.
- Mental removal test: removing `return 1` from vod.ts would make runVod fall through and return 0 → `expect(exitCode).toBe(1)` fails. Test is load-bearing. CONFIRMED.

### House rules audit (changes only)

- R1: `isRepoError` is a pure predicate, no throws. PASS.
- R5: REPO_ERROR_KINDS uses discriminated kind field. PASS.
- R6: No new casts introduced (casts removed). PASS.

---

## W2 Skip Justification Assessment

- apply-progress documents: "exit-2 path (makeBookId failure on pool entry) is structurally unreachable given the I2 pool-integrity invariant."
- I2 test (`src/application/verse-pool.test.ts`) walks all 365 entries through `makeBookId` and fails the suite if any reject. So at any bun test run, a bad pool entry is caught before it could produce a runtime exit-2.
- Future risk (if I2 weakens): documented in apply-progress and confirmed in this report.
- Skip decision is technically justified and risk is low.

---

## Recommendation

**Proceed to archive.** The W-REMAIN finding (reversed exhaustiveness check) is a correctness gap in a defensive guard, not a runtime bug. The guard works in the direction it was inadvertently written (catches stale REPO_ERROR_KINDS entries, not missing ones), and `isRepoError` is functionally correct today. The risk is future-facing only. Recommend filing a follow-up task to flip the conditional direction before the next RepoError variant is added.
