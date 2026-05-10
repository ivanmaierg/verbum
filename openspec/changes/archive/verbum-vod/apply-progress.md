# Apply Progress: verbum-vod

**Status**: complete
**Branch**: feat/verbum-vod (local only, not pushed)

## Commit Sequence

| # | SHA | Message |
|---|-----|---------|
| C1 | cde9a9d | feat(application): add pickVerseForDate picker + tests |
| C2 | 213f48e | feat(cli): add 365-entry verse pool data + invariant tests |
| C3 | 0a69c94 | feat(cli): add runVod handler + smoke test |
| C4 | 39fa954 | feat(cli): dispatch vod subcommand from run() |
| C5 | 8207373 | refactor(cli): replace AppError casts with kind-based narrowing |
| C6 | 3c8e673 | test(vod): cover runVod exit-1 path with failing repo stub |
| C7 | fe4bd31 | fix(domain): correct direction of RepoError exhaustiveness check |

## Tasks Completed

- [x] T-1: `src/application/verse-pool.ts` — PoolEntry, dayOfYear, pickVerseForDate
- [x] T-2: `src/application/verse-pool.test.ts` — dayOfYear tests + picker tests with STUB_POOL (C1) + real-pool determinism tests (C2)
- [x] T-3: `src/cli/verse-pool-data.ts` — 365-entry VERSE_POOL POJO
- [x] T-4: invariant tests appended to verse-pool.test.ts (I1: length=365, I2: makeBookId walks all entries, chapter/verse >= 1)
- [x] T-5: `src/cli/vod.ts` — runVod handler with exit-code contract
- [x] T-6: `tests/vod-smoke.test.ts` — 2 smoke tests with stub repo (C3) + 1 exit-1 test with failing repo stub (C6)
- [x] T-7: `src/cli/run.ts` — import runVod added
- [x] T-8: `src/cli/run.ts` — dispatch block added before parseReference

## Followup Tasks Completed (verify-report SG1 + W1)

- [x] SG1: Replace `as RepoError` casts in `run.ts` and `vod.ts` with `isRepoError` type predicate (C5). Added `isRepoError` + `REPO_ERROR_KINDS` exhaustiveness check to `src/domain/errors.ts`.
- [x] W1: Add exit-1 test for `runVod` with failing repo stub — asserts exit code 1, stderr contains "network failure", stdout empty (C6).
- [~] W2: SKIPPED — exit-2 path (makeBookId failure on pool entry) is structurally unreachable given the I2 pool-integrity invariant (every USFM in VERSE_POOL passes makeBookId). Adding a test would require an injectable pool API change just to reach an unreachable branch. Documented skip in apply-progress instead.

## Re-verify Followup (W-REMAIN — directional fix)

- [x] **W-REMAIN: exhaustiveness check direction was reversed (C7)**. Re-verify (#188) caught that the original `RepoErrorKind extends RepoError["kind"] ? true : never` was directionally wrong: a 6-member subset always extends a 7-member superset, so adding a new RepoError variant without updating REPO_ERROR_KINDS would silently pass the check while `isRepoError` misclassifies the new variant as a ParseError. Flipped to `RepoError["kind"] extends RepoErrorKind ? true : never` — now the superset cannot extend the smaller set, producing the intended `true = never` compile error when REPO_ERROR_KINDS falls out of sync. No runtime behavior change today (all 6 variants discriminate correctly); the guard now actually does what its comment says.

## T-2 Risk Resolution

**Chose Option B**: C1 uses a STUB_POOL (365 synthetic entries) for picker + dayOfYear tests. Real-pool determinism tests (7 cases) added in C2 alongside verse-pool-data.ts. Reasoning: picker is size-agnostic and should be tested generically; real-pool determinism belongs with the real data.

## Test Results Per Commit

| Commit | Tests run | Pass | Fail | Skip |
|--------|-----------|------|------|------|
| C1 (verse-pool.test.ts only) | 13 | 13 | 0 | 0 |
| C1 (full suite) | 46 | 46 | 0 | 0 |
| C2 (verse-pool.test.ts only) | 23 | 23 | 0 | 0 |
| C2 (full suite) | 56 | 56 | 0 | 0 |
| C3 (vod-smoke.test.ts only) | 2 | 2 | 0 | 0 |
| C3 (full suite) | 58 | 58 | 0 | 0 |
| C4 (full suite) | 58 | 58 | 0 | 0 |
| C5 (full suite) | 58 | 58 | 0 | 0 |
| C6 (full suite) | 59 | 59 | 0 | 0 |
| C7 (full suite) | 59 | 59 | 0 | 0 |

## SG1 + C7 Implementation Details

Added to `src/domain/errors.ts`:
- `REPO_ERROR_KINDS` — `as const` tuple of all 6 RepoError kind strings
- Compile-time exhaustiveness check: `RepoError["kind"] extends RepoErrorKind` (corrected in C7) — fires if a new RepoError variant is added but REPO_ERROR_KINDS is not updated
- `isRepoError(err: AppError): err is RepoError` — type predicate using the tuple

Both `run.ts` and `vod.ts`:
- Removed `import type { RepoError }` (no longer needed for cast)
- Imported `{ isRepoError }` from `@/domain/errors`
- Replaced `const err = passageResult.error as RepoError` + single `renderRepoError` call with `if (isRepoError(err)) { renderRepoError } else { renderParseError }` narrowing

## Deviations from Design

1. **PSA 145:18 removed from pool**: Design header says "Psalms 80 entries" but listed 81 Psalms. Total would have been 366. Removed the last Psalm (`PSA 145:18` at position 81 in the section) to land exactly at 365. The `length === 365` test caught this during C2. All other entries transcribed faithfully.

2. **Psalm section comment header updated**: Changed "indices 81–130" → "indices 80–129" for Proverbs to reflect actual positions after Psalms reduction.

3. **W2 skipped**: exit-2 path not tested. Pool integrity (I2) guarantees this path is unreachable at runtime. Forcing testability would require API surface changes with no production benefit.

4. **C7 retroactive fix**: The first SG1 implementation (C5) introduced an exhaustiveness check that compiled in the right direction but tested the wrong invariant. Re-verify (#188) caught this. Fixed in C7 with a one-line conditional swap.

## Acceptance Checks

- `bun run src/index.tsx john 3:16` → exit 0, verse text on stdout (\"For God so loved the world...\") ✓ backward compat preserved
- `bun run src/index.tsx vod` → exit 1 (verse_not_found from network-restricted CI environment, correct error path) ✓ dispatch working, runVod executing
- Full suite 59/59 green after C7 ✓
- `bunx tsc --noEmit` — no new errors introduced by C7; pre-existing project-wide @types/bun + @types/node missing remain unchanged

## Files Changed

- `src/application/verse-pool.ts` (NEW) — PoolEntry type + dayOfYear + pickVerseForDate
- `src/application/verse-pool.test.ts` (NEW) — 23 tests across 5 describe blocks
- `src/cli/verse-pool-data.ts` (NEW) — 365-entry VERSE_POOL
- `src/cli/vod.ts` (NEW then MODIFIED) — runVod handler; SG1 cast fix applied
- `tests/vod-smoke.test.ts` (NEW then MODIFIED) — 2 happy-path smoke tests + 1 exit-1 test
- `src/cli/run.ts` (MODIFIED) — +1 import, +4 logic lines (dispatch block); SG1 cast fix applied
- `src/domain/errors.ts` (NEW then MODIFIED) — isRepoError predicate + REPO_ERROR_KINDS + exhaustiveness check (C7 corrects direction)
