# Archive Report: verbum-vod

**Change**: `verbum-vod`
**Status**: SHIPPED
**PR**: #3 — https://github.com/ivanmaierg/verbum/pull/3
**Squash merge SHA**: `d72d334` on `origin/main`
**Squash commit message**: `feat: verbum vod — verse-of-the-day subcommand (#3)`
**Branch**: `feat/verbum-vod` — deleted from origin after merge
**Final test state**: 59/59 pass

---

## TL;DR

**verbum-vod** ships a deterministic-per-day verse subcommand via `verbum vod`, selecting one of 365 curated verses using day-of-year modulo pooling. Implementation: 7 original commits (C1–C4 feature + C5–C7 followup hardening). Merged to main as single squash commit. Verdict: **PASS** — all findings resolved before merge.

---

## What Shipped

### Features
- **New subcommand**: `verbum vod` dispatched from `src/cli/run.ts` (positional guard before reference parsing)
- **Verse picker**: `pickVerseForDate(date: Date, pool: readonly PoolEntry[]): PoolEntry` — pure, size-agnostic algorithm using `dayOfYear(date) % pool.length`
- **365-entry pool**: `VERSE_POOL` (CLI layer POJO) with devotional/comfort canon distribution: 80 Psalms, 50 Proverbs, 40 John, 35 Romans, 25 Philippians, 20 Isaiah, 15 Matthew, 12 Ephesians, 10 Hebrews, 10 Luke, 8 1 John, 8 1 Peter, 7 James, 6 Colossians, 5 each (Galatians, Genesis, Deuteronomy, Mark), 4 each (2 Timothy, Acts), 3 each (Joshua, 1 Thessalonians, Jeremiah), 1 Lamentations = 365
- **Exit-code contract**: 0 = success (verse on stdout), 1 = network/repo error, 2 = invalid pool entry (book parsing failure)
- **Handler**: `runVod(date: Date, repo?: BibleRepository)` in `src/cli/vod.ts` — mirrors `run()` error-handling pattern, live-fetches via existing `getPassage`
- **Type predicate**: `isRepoError(err: AppError): err is RepoError` in `src/domain/errors.ts` with corrected compile-time exhaustiveness guard against future `RepoError` drift

### Files Added/Modified
| Path | Type | Status | Lines (logic vs data) |
|------|------|--------|----------------------|
| `src/application/verse-pool.ts` | NEW | stable | 30 (logic) |
| `src/application/verse-pool.test.ts` | NEW | stable | 150 (tests) |
| `src/cli/verse-pool-data.ts` | NEW | stable | 370 (data) |
| `src/cli/vod.ts` | NEW → MODIFIED (SG1) | stable | 40 (logic) |
| `tests/vod-smoke.test.ts` | NEW → MODIFIED (W1+SG1) | stable | 80 (tests) |
| `src/cli/run.ts` | MODIFIED | stable | 5 (logic) |
| `src/domain/errors.ts` | MODIFIED (SG1+C7) | stable | 15 (predicate + check) |

**Logic surface**: ~145 lines (C1 picker ~60 + C3 handler ~80 + C4 dispatch ~5); **data surface**: ~370 lines (C2, mechanical POJO). Total: ~515 lines changed (logic + data + tests).

---

## Decisions Made Along the Way

### D1: Pool size = 365 verses (one per day, no repetition within a year)

**Rationale** (revised from initial 30-verse proposal during interactive review):
- Original proposal anchored pool size to curation cost assuming hardcoded verse text.
- D2 commits to live fetch via existing `getPassage`, collapsing curation cost to reference lists (3-tuple POJOs, not text bodies).
- With cost neutralized, the right axis is UX: 30-verse pool repeats monthly (visibly broken for daily use); 365-verse pool feels deterministic per day.
- Picker is size-agnostic (`dayOfYear % pool.length`) — pool can shrink/grow later without code changes. No corner-painting.
- **Curation source**: devotional/comfort canon (Psalms-heavy + cornerstones + Proverbs daily). Light on genealogies, Levitical law, prophetic judgment.

### D2: Live fetch via existing `getPassage` (accept divergence with welcome-content.ts)

**Rationale**:
- Consistency with `verbum john 3:16` is dominant — same code path for fetching and rendering ensures identical output format and shared bug surface.
- Downside: `welcome-content.ts` hardcoded BSB text may diverge if the upstream API updates. Documented as v1 risk (SDD capture, not blocking).
- Pool MAY include John 3:16, Genesis 1:1 — no reason to exclude them. Future change (welcome consolidation) owns the drift-reconciliation if ever needed.

### D3: Pool entries are USFM string tuples; `Reference` constructed at use time in `runVod`

**Rationale** (R6 spirit):
- Alternatives: (A) `makeBookIdOrThrow` helper — parallel API defeating R1/R6 intent; (B) eager `buildPool(): Result` — boilerplate at every consumer for unreachable error.
- **Chosen**: Pool entries = `{ usfm: string; chapter: number; verse: number }`, `runVod` calls `makeBookId` then constructs `Reference`. Flows Result through same error path as `parseReference` (exit 2 on invalid book).
- Typo in pool surfaces as `unknown_book` on stderr first time that day's verse triggers — loud, located, recoverable by editing one line. No new abstraction. Respects R1 (no throw), R5 (errors are unions), R6 (single factory).

---

## Findings Resolved Before Merge

### SG1 (SUGGESTION → RESOLVED in C5)
- **Original**: `as RepoError` casts in `run.ts` and `vod.ts` violate R6 (no casts).
- **Resolution**: Added `isRepoError(err: AppError): err is RepoError` type predicate to `src/domain/errors.ts` using `REPO_ERROR_KINDS` exhaustiveness tuple. Removed casts; replaced with dual-branch narrowing (`if (isRepoError) { ... } else { ... }`).
- **Status**: Fully resolved and runtime-verified correct.

### W1 (WARNING → RESOLVED in C6)
- **Original**: S5 scenario (network failure → exit 1) lacked direct test coverage.
- **Resolution**: Added third smoke test in `tests/vod-smoke.test.ts` using `failingRepo` stub that returns network error. Asserts exit 1, stderr contains "network failure", stdout empty.
- **Status**: Fully resolved. Test is load-bearing (removing `return 1` from vod.ts causes test failure).

### W-REMAIN (WARNING → RESOLVED in C7, before merge)
- **Original** (revealed during re-verify of C5+C6): Exhaustiveness check in `src/domain/errors.ts` line 39 had reversed conditional direction.
- **Defective code (C5)**: `const _exhaustiveCheck: RepoErrorKind extends RepoError["kind"] ? true : never = true;`
- **Problem**: Checked if REPO_ERROR_KINDS *was a subset of* RepoError["kind"], not the inverse. If RepoError gained a new variant but REPO_ERROR_KINDS wasn't updated, the check would silently pass while `isRepoError` misclassified the new variant as a `ParseError`.
- **Fix in C7 (`fe4bd31`)**: Flipped to `RepoError["kind"] extends RepoErrorKind ? true : never`. Now if RepoError gains a 7th variant, the 7-member superset cannot extend the 6-member subset → result is `never` → `true = never` is a compile error → drift caught at build time.
- **Status**: Fully resolved before merge. The guard now actually does what its comment claims.

### W2 (WARNING → SKIPPED, documented intentional)
- **Original**: S4 scenario (invalid pool entry → exit 2) lacked test coverage.
- **Analysis**: I2 invariant test walks all 365 pool entries through `makeBookId` and fails the suite if any reject. Exit-2 path is structurally unreachable at runtime given this guard.
- **Skip justification**: Adding a test would require injectable pool API just to reach an unreachable branch. Future risk: if I2 weakens (dynamic pool, injectable VERSE_POOL), exit-2 becomes reachable but untested. Documented in apply-progress; flagged for revisit if I2 changes.
- **Status**: Intentional skip. No footgun today.

### SG2 (SUGGESTION → not addressed, low priority)
- **Finding**: `dayOfYear` comment in `src/application/verse-pool.ts` could be clearer about "local calendar fields, UTC epoch arithmetic" pattern.
- **Status**: Functionally correct, comment-only nit. Not worth a commit on its own; will be picked up by any future edit to that function.

---

## Deviations from Design

### C2: Pool entry count correction
- **Design stated**: 80 Psalms entries.
- **Actual count**: 81 Psalms listed (off-by-one error in the design spec).
- **Resolution**: Removed last Psalm (`PSA 145:18` at index 81) to land exactly 365 total entries. `length === 365` test caught this at `bun test` time (C2).
- **All other entries**: Faithfully transcribed from design.

### C5–C7: Followup commits beyond the original 4-commit plan
- **C5**: Refactor cast → predicate (SG1 suggestion resolved).
- **C6**: Add exit-1 test (W1 warning resolved).
- **C7**: Fix exhaustiveness check direction (W-REMAIN warning found during re-verify, fixed before archive).
- **Impact**: +3 commits beyond original 4-commit plan. Squash merge coalesced all 7 into single `d72d334` on main.

---

## Roadmap Items Queued During This Change

Captured in engram for future SDD cycles (in priority order):

1. **#184** (`visual-identity-v1`): Direction LOCKED via opencode TUI reference (user-supplied 2026-05-10). Black background, three-tier text hierarchy (bright/mid/dim), ONE accent color reserved for actionable affordances, two-tone wordmark, whitespace-first composition. **Open taste call deferred to user**: accent color (warm amber / desaturated red / opencode-style blue / other). Recommended sequence: this lands BEFORE `cli-loading-state` so the loading spinner inherits theme tokens.
2. **#183** (`cli-loading-state`): TTY-aware loading indicator for blocking CLI commands (both `verbum <reference>` and `verbum vod`). Depends on #184 for theme tokens.

No outstanding follow-up tasks for `verbum-vod` itself — all findings resolved before merge.

---

## Traceability — Artifact Observation IDs

All SDD change artifacts for `verbum-vod` archived in engram:

| Artifact | Observation ID | Topic Key |
|----------|----------------|-----------
| Exploration | 175 | `sdd/verbum-vod/explore` |
| Proposal | 176 | `sdd/verbum-vod/proposal` |
| Spec | 178 | `sdd/verbum-vod/spec` |
| Design | 179 | `sdd/verbum-vod/design` |
| Tasks | 181 | `sdd/verbum-vod/tasks` |
| Apply Progress | 186 | `sdd/verbum-vod/apply-progress` |
| Verify Report | 188 | `sdd/verbum-vod/verify-report` |
| **Archive Report** | **195 (this)** | `sdd/verbum-vod/archive-report` |

---

## Test Coverage Summary

**Final state**: 59/59 tests pass, 831 expect() calls across 8 test files

---

## Final Verdict

**PASS** — all findings resolved before merge.

The change is production-ready and shipped. SG1, W1, and W-REMAIN were all closed before the squash-merge. W2 skip is documented and structurally justified (I2 invariant makes the branch unreachable). SG2 is a comment-only nit deferred to opportunistic cleanup. No outstanding follow-up tasks for verbum-vod.

---

## Archive Closure

**Change**: `verbum-vod`
**Merged**: d72d334 on origin/main
**Shipped in**: PR #3 (merged 2026-05-10)
**Test state**: 59/59 ✓
**Verdict**: SHIPPED, all findings resolved ✓
**Next phase**: None for this change. Queued future work in engram: #184 `visual-identity-v1` (direction locked, accent color is the open taste call), then #183 `cli-loading-state` (depends on #184 theme tokens).
