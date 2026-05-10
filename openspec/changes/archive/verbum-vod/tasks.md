# Tasks: verbum-vod

## TL;DR

9 tasks across 4 commits. Logic surface ~145 lines (C1 ~60 + C3 ~80 + C4 ~5); data file ~370 lines (C2, mechanical). Strict TDD: false — tests bundled with code in same commit (work-unit-commits).

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (logic) | ~145 (C1 + C3 + C4) |
| Estimated changed lines (data) | ~370 (C2, mechanical POJO) |
| Estimated total | ~515 |
| 400-line budget risk | Low — logic surface is 145 lines; data file is mechanical scan |
| Chained PRs recommended | No — reviewer treats C2 as data scan; logic under budget |
| Suggested split | Single PR (4 work-unit commits within it) |
| Delivery strategy | ask-on-risk |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| C1–C4 | Full verbum-vod feature | 1 PR | 4 ordered commits, each bun test green |

---

## Commit C1 — `feat(application): add pickVerseForDate picker + tests`

Files: `src/application/verse-pool.ts`, `src/application/verse-pool.test.ts` (picker + dayOfYear tests only; pool invariant tests land in C2)

### T-1: Create `src/application/verse-pool.ts`

- [x] Export `PoolEntry` type: `{ readonly usfm: string; readonly chapter: number; readonly verse: number }`
- [x] Export `dayOfYear(date: Date): number` — 1-based, UTC arithmetic (DST-safe), Jan 1 → 1, Dec 31 non-leap → 365
- [x] Export `pickVerseForDate(date: Date, pool: readonly PoolEntry[]): PoolEntry` — formula `dayOfYear(date) % pool.length`; non-null assertion on `pool[idx]!` is justified (pool is non-empty by I1)
- [x] No `Result` wrapper — picker is total (R1 applies to fallible functions; this branch cannot fire)
- [x] No imports from CLI or API layers (layer audit: application only)

**Spec link**: I3 (pure function), R1, R6 spirit

**Acceptance**: file compiles; no imports from outside application/domain

### T-2: Create `src/application/verse-pool.test.ts` (picker + dayOfYear sections only)

- [x] `describe("dayOfYear")` — 6 cases: Jan 1 → 1, Mar 15 non-leap → 74, Jul 4 non-leap → 185, Dec 31 non-leap → 365, Feb 29 leap → 60, Dec 31 leap → 366
- [x] `describe("pickVerseForDate — determinism")` — 7 cases using STUB_POOL (Option B chosen): same-date referential equality, Jan 1 → STUB_POOL[1], Mar 15 → STUB_POOL[74], Jul 4 → STUB_POOL[185], Dec 31 2025 → STUB_POOL[0], Dec 31 2024 (leap) → STUB_POOL[1], day N ≠ day N+1
- [x] T-2 resolution: Option B — C1 uses STUB_POOL (365 synthetic PSA entries). Real-pool determinism tests moved to C2 alongside verse-pool-data.ts.
- [x] Follows style of `src/domain/book-id.test.ts` (bun:test, describe/it/expect, no mock harness)

**Spec link**: Scenario "Same-day determinism", "Day-over-day variation", "Year wrap-around"

**Acceptance**: `bun test src/application/verse-pool.test.ts` passes (picker + dayOfYear blocks) ✓

**Commit message**: `feat(application): add pickVerseForDate picker + tests` — SHA: cde9a9d

---

## Commit C2 — `feat(cli): add 365-entry verse pool data + invariant tests`

Files: `src/cli/verse-pool-data.ts`, append invariant tests to `src/application/verse-pool.test.ts`

### T-3: Create `src/cli/verse-pool-data.ts`

- [x] Import `PoolEntry` from `@/application/verse-pool`
- [x] Export `VERSE_POOL: readonly PoolEntry[]`
- [x] Transcribe entries from design observation #179. NOTE: design listed 81 Psalms despite saying 80 — removed PSA 145:18 (last Psalm) to achieve exactly 365 entries. All other entries faithfully transcribed.
- [x] Source order per design: JHN 3:16 at index 0, then Psalms (80), Proverbs (50), John (40), Romans (35), Philippians (25), Isaiah (20), Matthew (15), 1 John (8), James (7), Hebrews (10), Ephesians (12), Luke (10), 1 Peter (8), Colossians (6), Galatians (5), Genesis (5), Deuteronomy (5), Mark (5), 2 Timothy (4), Acts (4), Joshua (3), 1 Thessalonians (3), Jeremiah (3), Lamentations (1, 3:22 only)
- [x] File comment explains pool location in CLI layer; notes length === 365 invariant
- [x] No logic — pure POJO export only

**Spec link**: I1, I2

**Acceptance**: `VERSE_POOL.length === 365`; `bun test` green ✓

### T-4: Append invariant tests to `src/application/verse-pool.test.ts`

- [x] Add `describe("VERSE_POOL — invariants (I1, I2)")` block with 3 tests: I1 length=365, I2 makeBookId walk, chapter/verse >= 1
- [x] Add `describe("pickVerseForDate — determinism (real VERSE_POOL)")` block with 7 cases against actual VERSE_POOL
- [x] Import `makeBookId` from `@/domain/book-id`

**Spec link**: I1, I2, Scenario "Pool integrity — test-time check"

**Acceptance**: `bun test src/application/verse-pool.test.ts` all 3 invariant tests pass ✓

**Commit message**: `feat(cli): add 365-entry verse pool data + invariant tests` — SHA: 213f48e

---

## Commit C3 — `feat(cli): add runVod handler + smoke test`

Files: `src/cli/vod.ts`, `tests/vod-smoke.test.ts`

### T-5: Create `src/cli/vod.ts`

- [x] Export `async function runVod(date: Date, repo: BibleRepository = createHelloAoBibleRepository()): Promise<number>`
- [x] Step 1: `pickVerseForDate(date, VERSE_POOL)` → entry
- [x] Step 2: `makeBookId(entry.usfm)` — if `!ok`: `process.stderr.write(renderParseError(...) + "\n")`, return 2
- [x] Step 3: build `Reference`: `{ book: bookResult.value, chapter: entry.chapter, verses: { start: entry.verse, end: entry.verse } }`
- [x] Step 4: `await getPassage(repo, ref)` — if `!ok`: stderr + return 1
- [x] Step 5: `process.stdout.write(renderPassage(passageResult.value) + "\n")`, return 0
- [x] Never throws (R1, I4). Uses `makeBookId` not `as BookId` cast (R6, I5)
- [x] All imports correct per spec

**Spec link**: I4, I5, Scenario "Network failure", Scenario "Invalid pool entry — makeBookId rejects"

**Acceptance**: compiles; layer audit clean ✓

### T-6: Create `tests/vod-smoke.test.ts`

- [x] Build `stubRepo: BibleRepository` — `getChapter` returns verses 1..50 with text `STUB {book} {chapter}:{i+1}`
- [x] `describe("smoke — verbum vod happy path")` — 2 tests: fixed Date Mar 15 2025 → day 74 → VERSE_POOL[74] with stdout assertion; determinism test (two calls same date → same stdout)
- [x] Pattern mirrors `tests/smoke.test.ts` (in-process stub, no bun spawn)
- [x] Import `makeTranslationId` from `@/domain/translations` for Chapter shape

**Spec link**: Scenario "Same-day determinism", Scenario "Network failure" (exit path tested via stub)

**Acceptance**: `bun test tests/vod-smoke.test.ts` passes; no HTTP calls ✓

**Commit message**: `feat(cli): add runVod handler + smoke test` — SHA: 0a69c94

---

## Commit C4 — `feat(cli): dispatch vod subcommand from run()`

File: `src/cli/run.ts` (MODIFIED)

### T-7: Modify `src/cli/run.ts` — add import

- [x] Add `import { runVod } from "@/cli/vod";` to the existing imports block

**Spec link**: I6, I7, I8

### T-8: Modify `src/cli/run.ts` — add dispatch block

- [x] Added dispatch block before `const input = ...`: `if (positionals[0] === "vod") { return await runVod(new Date()); }`
- [x] Existing lines from `const input = ...` onward are UNTOUCHED (I8)
- [x] Net diff: 1 import + 4 lines

**Spec link**: I6 (vod before parseReference), I7 (non-vod falls through), I8 (backward compat)

**Acceptance**: `verbum john 3:16` smoke still passes; `bun test` fully green ✓

**Commit message**: `feat(cli): dispatch vod subcommand from run()` — SHA: 39fa954

---

## Dependency Order

C1 → C2 → C3 → C4 (strict chain; each commit left `bun test` green)

## Apply-Phase Risks (resolved)

| Risk | Resolution |
|------|------------|
| C2 length miscounting | Caught by `length === 365` test. Design had 81 Psalms despite saying 80 — removed PSA 145:18 to get exactly 365. |
| T-2 VERSE_POOL before C2 exists | Chose Option B: STUB_POOL in C1, real-pool tests moved to C2. |
| stdout spy in T-6 | Used try/finally as designed. Works correctly. |
| `renderParseError` cast | makeBookId returns UnknownBookError which is a ParseError subtype — no cast needed. |
