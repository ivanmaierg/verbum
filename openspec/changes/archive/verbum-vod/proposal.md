# Proposal: verbum-vod (Verse of the Day subcommand)

## TL;DR

Add `verbum vod` subcommand that prints a deterministic-per-day verse from a curated 365-verse pool. Live fetch via existing `getPassage` (mirrors `verbum john 3:16`). Pool data lives in CLI layer as USFM string tuples; `Reference` construction happens at use time so `makeBookId`'s Result flows through normal CLI error handling (no R6 escape hatch).

## Intent

Give users a one-shot daily verse via `verbum vod` — same UX shape as `verbum john 3:16` (one-shot, exits 0, bare verse on stdout). Deterministic per calendar day so the same day always yields the same verse, no RNG, no persistence. This is the second user-visible CLI path and forces the codebase to grow a real subcommand boundary that future commands (`--help`, `random`, etc.) can plug into.

## Scope

### In Scope
- New `verbum vod` subcommand routed in `src/cli/run.ts` (single `if positionals[0] === "vod"` check)
- Pure `pickVerseForDate(date, pool)` function in `src/application/verse-pool.ts` using `dayOfYear % pool.length`
- 365-verse hardcoded pool in `src/cli/verse-pool-data.ts` as `readonly { usfm: string; chapter: number; verse: number }[]`
- New `runVod(date)` handler in `src/cli/vod.ts` that constructs `Reference` from pool entry, calls `getPassage`, renders via existing `renderPassage`
- Unit tests for `pickVerseForDate` (determinism, date boundaries, pool wrap-around)
- Smoke test `tests/vod-smoke.test.ts` proving `runVod(fixedDate)` returns 0 with verse text on stdout

### Out of Scope
- Caching, offline mode, `--date YYYY-MM-DD` override flag
- `--format text|json|markdown` (defer until format work lands across all commands)
- Routing table / Command pattern abstraction (1 subcommand does not justify it; revisit at 3+)
- TUI integration (vod is CLI-only for v1)
- Welcome-screen pool reuse / consolidating `welcome-content.ts` static text with live-fetched pool verses
- Localization / non-English translations

## First Reviewable Cut

Single PR. ~120 lines of logic + ~370 lines of pool data (mechanical, scannable as data not logic). Ships:
- `src/cli/run.ts` subcommand check
- `src/cli/vod.ts`, `src/cli/verse-pool-data.ts`
- `src/application/verse-pool.ts` + test
- `tests/vod-smoke.test.ts`

**Review workload note for tasks phase**: pool-data file inflates raw line count but is review-light (one-pass scan for USFM typos, validated mechanically by the "every pool entry parses" unit test). Logic surface for review is ~120 lines. Tasks should split pool data into its own commit so the logic commits stay focused.

## Success Criterion

Running `verbum vod` on any given calendar day twice (same day) prints the SAME verse text to stdout, exits 0, and the verse is one of the 365 curated references. Verifiable:

```
$ verbum vod
For God so loved the world that He gave His one and only Son...

$ verbum vod  # same day
For God so loved the world that He gave His one and only Son...
```

Plus: `bun test` passes, including the new `pickVerseForDate` unit tests covering 3+ specific dates with known expected indices, and the "every pool entry has a valid USFM" mechanical check.

## Decisions

### D1: Pool size = 365 verses (one per day, no repetition within a year)

**Why** (revised after review feedback):

The original 30-verse decision was anchored to a curation-cost argument that quietly assumed hardcoded verse text. **D2 commits to live fetch**, which collapses the curation cost: pool entries are 3-tuple POJOs (`{ usfm, chapter, verse }`), not bodies of text. Curating 365 entries is one afternoon of reference-listing — no proportional 12x effort vs 30.

With curation cost out of the equation, the right tradeoff axis is **user experience**:
- 30 verses → noticeable repetition every month. A daily-verse feature that repeats monthly is visibly broken to anyone using it consistently.
- 365 verses → no repetition within a year. The verse genuinely feels "of the day."
- 30 makes sense if you only see the feature once or twice per quarter; 365 is the right size for daily use, which is the actual use case.

The picker (`dayOfYear % pool.length`) is size-agnostic — pool can shrink or grow later without code changes. We are not painting ourselves into a corner with 365.

**Curation source**: defer to `sdd-design`. Reasonable starting points: a published one-year plan (M'Cheyne, the Bible Project's daily reading), a curated "verse-a-day" devotional list, or a hand-picked balance across canon (Psalms-heavy + cornerstones + Proverbs daily). Designer picks one and justifies; if the user has a preference, they can override at design phase.

**Cost flagged**: pool data file is ~370 lines. Tasks should isolate it in its own commit so the work-unit-commits skill keeps logic and data review surfaces separate. Total PR size (~490 lines incl. data) exceeds the strict 400-line review budget but the 370-line data block is reviewed as data (mechanical typo scan + automated USFM validity test), not as logic. If the review workload guard fires in the tasks phase, the recommended split is: PR1 = routing + picker + 30-seed pool; PR2 = pool expansion to 365. This is a fallback, not the default.

### D2: Live fetch via `getPassage` (accept short-term divergence with welcome-content.ts)

**Why**: Consistency with `verbum john 3:16` is the dominant constraint — both subcommands hit the same code path for fetching and rendering, so the output format is identical and bugs in one surface in the other. Hardcoding pool text would create THREE sources of truth (pool, welcome, API) instead of two (welcome, API).

The downside is real but bounded: if the pool happens to include Genesis 1:1 or John 3:16, the welcome screen's hardcoded BSB text could drift from what `verbum vod` prints on that day if the upstream API ever updates the BSB rendering. **Mitigation**: explicitly document that `welcome-content.ts` is a snapshot for the welcome UI only and is NOT a source of truth for verse content. A future change can consolidate (either by removing welcome's hardcoded text in favor of a startup fetch, or by adding a "snapshot regeneration" script). This is OUT of scope for verbum-vod.

The pool MAY include John 3:16 and Genesis 1:1 — there is no v1 reason to exclude them.

### D3: Pool entries are USFM string tuples; `Reference` constructed at use time in `runVod`

**Why R6-spirit, not just R6-letter**: R6 says "no `as BookId` casts" and "branded IDs via single factory." The proposed alternatives:

- *Option A (`makeBookIdOrThrow` helper)* — introduces a parallel API to `makeBookId` that exists only to dodge the Result. Even if scoped to "static data only," it is a precedent for "Result is annoying, throw a helper next to it." That precedent is exactly what R1 and R6 exist to prevent.
- *Option B (eager `buildPool()` returning `Result<Pool, BuildError>`)* — handles a "theoretically impossible" error at module load. Adds boilerplate at every consumer for a branch that will never run, and the "impossibility" is brittle: any typo in pool data turns into a runtime crash with no clear ownership.
- *Option C (CHOSEN — pool entries are `{ usfm: string; chapter: number; verse: number }`, `runVod` calls `makeBookId` then constructs the `Reference`)* — flows the Result through the SAME error path that `parseReference` already uses (`exit 2` on invalid book). A typo in pool data surfaces as `unknown_book` on stderr the first time that day's verse triggers — loud, located, recoverable by editing one line. No new abstraction. No spirit-violation. The picker stays pure (operates on POJO tuples, not `Reference`).

Option C is the only one that respects R1 (no throwing), R5 (errors are unions, not exceptions), AND R6 (single factory) without adding a parallel API.

## Non-goals

This proposal explicitly does NOT:
- Introduce `--format` flag (out of scope for ALL commands until format work lands)
- Rotate the welcome screen verse based on day-of-year (welcome is static; vod is the daily channel)
- Add the verse pool to the TUI (TUI continues to use `welcome-content.ts` constants only)
- Build a routing table, Command interface, or subcommand registry abstraction
- Introduce a `VersePool` port in the application layer (pool is config data, not an external system — exploration Approach 2 explicitly rejected)
- Persist "last shown verse" anywhere (determinism comes from the date, not from history)
- Add `--date` override (testability comes from `runVod(date: Date)` taking the date as an argument; no flag needed for v1)

## Capabilities

### New Capabilities
- `verse-of-the-day`: deterministic-per-day verse selection from a curated pool, surfaced as the `verbum vod` CLI subcommand. Includes pool data shape, picker function contract, subcommand routing, and CLI output behavior.

### Modified Capabilities
- `cli-runner` (or equivalent — sdd-spec to confirm against existing spec names): the CLI entry now performs subcommand dispatch on `positionals[0]` before delegating to reference parsing. Backward compatible (any positional that is not `vod` falls through unchanged).

## Approach

Pure-function picker, USFM-string pool, single subcommand check in `run.ts`. Quoting the exploration's recommended Approach 3:

1. `src/cli/run.ts`: at the top of `run()`, after `parseArgs`, branch on `positionals[0] === "vod"` → return `await runVod(new Date())`. All other paths unchanged.
2. `src/cli/verse-pool-data.ts`: `export const VERSE_POOL: readonly { usfm: string; chapter: number; verse: number }[] = [...]` — 365 hand-picked entries.
3. `src/application/verse-pool.ts`: `export function pickVerseForDate(date: Date, pool: readonly PoolEntry[]): PoolEntry`. Pure. Determinism via `dayOfYear(date) % pool.length`.
4. `src/cli/vod.ts`: `runVod(date: Date): Promise<number>`. Picks entry → `makeBookId(entry.usfm)` → on error, render to stderr, exit 2. On ok → build `Reference` → call `getPassage` → on error, render to stderr, exit 1 → on ok, `console.log(renderPassage(passage))` → exit 0. Mirrors `run.ts`'s existing error handling exactly.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/cli/run.ts` | Modified | Add 3-line subcommand check at top of `run()` |
| `src/cli/vod.ts` | New | `runVod(date)` handler |
| `src/cli/verse-pool-data.ts` | New | 365-entry hardcoded pool |
| `src/application/verse-pool.ts` | New | Pure `pickVerseForDate` |
| `src/application/verse-pool.test.ts` | New | Unit tests for picker + every-entry-validates check |
| `tests/vod-smoke.test.ts` | New | End-to-end smoke for `runVod` |
| `src/index.tsx` | Untouched | Already delegates non-empty argv to `run()` |
| `src/domain/*` | Untouched | Pool is not a domain concept |
| `src/api/*` | Untouched | Reuses existing `BibleRepository` |
| `src/tui/*` | Untouched | TUI is out of scope |
| `src/cli/welcome-content.ts` | Untouched | Documented divergence risk, deferred |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Pool entry typo → runtime `unknown_book` on the day that entry rotates in | Medium | Unit test that walks all 365 entries through `makeBookId` and asserts every one is `ok` (catches typos at `bun test` time, not in production) |
| 370-line pool data file inflates PR size beyond 400-line review budget | Medium | Isolate pool data in its own commit (work-unit-commits); reviewer treats as data not logic; if review workload guard fires in tasks phase, fall back to chained PRs (routing+seed pool, then expand) |
| `welcome-content.ts` BSB text drifts from API rendering for shared references (Gen 1:1, John 3:16) | Low | Documented in D2 as accepted v1 risk; not blocking; consolidation is a separate future change |
| Subcommand collision when adding a 2nd subcommand later (e.g. `verbum random` or `verbum help`) | Low | One `if` chain is fine for 1–2 subcommands; explicit "build routing table when reaching 3+ subcommands" debt note added to the proposal as a forward signal for future SDD changes |
| Network failure on `getPassage` ruins the daily-verse experience | Medium | Same failure mode as existing `verbum john 3:16` — render error to stderr, exit 1. No new behavior; offline-first is a separate, larger concern |
| Timezone handling: "today" varies across users | Low | Use system local time via `new Date()` for v1 (same as user's clock). UTC normalization deferred until users complain |

## Rollback Plan

Single-PR change. Rollback = revert the PR. No data migrations, no config flags, no DB state. The 5-line edit to `run.ts` is the only modification to existing code; reverting it removes the `vod` dispatch and the existing `verbum john 3:16` path is structurally untouched. New files (`vod.ts`, `verse-pool*.ts`) become dead code on revert and can be deleted in a follow-up cleanup commit if desired.

## Dependencies

- Existing `BibleRepository` adapter (helloao) — no changes, just consumed
- Existing `makeBookId`, `Reference` factory chain in `src/domain/`
- Existing `renderPassage` and CLI error-rendering helpers in `src/cli/`
- No new npm packages

## Success Criteria

- [ ] `verbum vod` exits 0 and prints non-empty verse text to stdout when network is available
- [ ] Two invocations of `verbum vod` on the same calendar day produce IDENTICAL output
- [ ] `bun test` passes including new `pickVerseForDate` tests AND a "every pool entry has a valid USFM book" test
- [ ] `tests/vod-smoke.test.ts` passes with a fixed `Date` showing the expected verse for that day
- [ ] `verbum john 3:16` continues to work unchanged (regression check via existing smoke test)
- [ ] Pool contains exactly 365 entries, each with a known-good USFM code, chapter, and verse
