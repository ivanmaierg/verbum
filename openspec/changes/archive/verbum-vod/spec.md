# Spec: verbum-vod

## TL;DR

Two capabilities touched: **verse-of-the-day** (new) and **cli-runner** (modified, backward-compatible). Seven acceptance scenarios. No implementation details — this spec describes WHAT, not HOW.

---

## Capability 1: verse-of-the-day (NEW)

### Purpose

`verbum vod` prints a deterministic, live-fetched verse to stdout and exits 0. Determinism is day-scoped: same calendar day → same verse. No RNG, no persistence.

### Public Contract

| Surface | Contract |
|---------|----------|
| CLI invocation | `verbum vod` |
| stdout | bare verse text (same format as `verbum john 3:16`) |
| exit 0 | verse printed successfully |
| exit 1 | `getPassage` returned `Result.err` — error on stderr |
| exit 2 | `makeBookId` rejected pool entry — error on stderr |

**Pool entry shape**

```ts
{ usfm: string; chapter: number; verse: number }
```

**Picker signature** (pure function, application layer)

```ts
pickVerseForDate(date: Date, pool: readonly PoolEntry[]): PoolEntry
```

Selection formula: `dayOfYear(date) % pool.length` (1-based day-of-year, modulo pool size).

### Invariants

| # | Invariant |
|---|-----------|
| I1 | Pool MUST contain exactly 365 entries |
| I2 | Every pool entry MUST produce an `ok` Result from `makeBookId` — asserted by a test that walks all entries; build MUST fail if any entry is invalid |
| I3 | `pickVerseForDate` MUST be a pure function (no I/O, no side effects) |
| I4 | `runVod` MUST NOT throw — errors MUST be returned as `Result.err` or exit codes (R1) |
| I5 | `runVod` MUST call `makeBookId` via the single factory (no `as BookId` casts) (R6) |

### Acceptance Scenarios

#### Scenario: Same-day determinism

- GIVEN the user runs `verbum vod` on calendar day D
- WHEN `verbum vod` is run a second time on the same calendar day D (same system clock date)
- THEN both invocations print identical verse text to stdout
- AND both exit 0

#### Scenario: Day-over-day variation

- GIVEN the pool contains more than 1 entry
- WHEN `pickVerseForDate` is called with day N and then with day N+1 of the same year
- THEN the two returned entries are different pool objects (different indices)

#### Scenario: Year wrap-around (non-leap year)

- GIVEN the pool contains exactly 365 entries
- WHEN `pickVerseForDate` is called with Dec 31 (day 365, non-leap year)
- THEN the returned entry is at index `365 % 365 = 0` (first entry)
- AND WHEN `pickVerseForDate` is called with Jan 1 of the following year (day 1)
- THEN the returned entry is at index `1 % 365 = 1` (second entry)

#### Scenario: Invalid pool entry — makeBookId rejects

- GIVEN a pool entry whose `usfm` field is not a valid USFM book code
- WHEN `runVod` selects that entry and calls `makeBookId`
- THEN `runVod` prints an error message to stderr
- AND exits 2
- AND does NOT throw (R1)

#### Scenario: Network failure

- GIVEN `makeBookId` succeeds for the selected entry
- WHEN `getPassage` returns a `Result.err`
- THEN `runVod` prints the error to stderr
- AND exits 1
- AND does NOT throw (R1)

#### Scenario: Pool integrity — test-time check

- GIVEN the project's test suite runs via `bun test`
- WHEN `src/application/verse-pool.test.ts` executes
- THEN every entry in `VERSE_POOL` MUST produce an `ok` Result from `makeBookId`
- AND the test MUST fail (non-zero exit from `bun test`) if any entry is invalid

---

## Capability 2: cli-runner (MODIFIED)

### Purpose

The CLI entry point (`src/cli/run.ts`) now performs subcommand dispatch before delegating to reference parsing. All existing behavior is preserved; the new branch is additive.

### Public Contract

| Positional[0] | Behavior |
|---------------|----------|
| `"vod"` | Dispatch to `runVod(new Date())`; return its exit code |
| anything else | Fall through to `parseReference` (unchanged) |
| absent | Fall through to `parseReference` (unchanged, existing error handling) |

Exit codes for the `vod` branch align with existing codes: 0 ok, 1 repository/network error, 2 invalid book/parse error.

### Invariants

| # | Invariant |
|---|-----------|
| I6 | The `vod` branch MUST be checked BEFORE `parseReference` is called |
| I7 | All positionals that are NOT `"vod"` MUST reach `parseReference` unchanged |
| I8 | `verbum john 3:16` MUST behave identically before and after this change ships |

### Acceptance Scenarios

#### Scenario: vod subcommand dispatched

- GIVEN the user runs `verbum vod`
- WHEN `run()` executes
- THEN control reaches `runVod(new Date())` without passing through `parseReference`
- AND the exit code is whatever `runVod` returns

#### Scenario: Backward compatibility — existing reference parsing

- GIVEN `verbum john 3:16` was working before this change
- WHEN `verbum john 3:16` runs after this change ships
- THEN the output and exit code are identical to the pre-change behavior
- AND the existing smoke test passes without modification

---

## Out of Scope

- Caching / offline mode
- `--date YYYY-MM-DD` override flag
- `--format text|json|markdown` (deferred until format work lands across all commands)
- Routing table / Command pattern abstraction (revisit at 3+ subcommands)
- TUI integration
- Welcome screen using pool verses (`welcome-content.ts` divergence is accepted v1 risk)
- Localization / non-English translations
- UTC normalization of "today" (system local time is sufficient for v1)

---

## Spec-Level Risks

| Risk | Status |
|------|--------|
| Timezone: `new Date()` uses system local time — "today" differs across users in different zones | Formally documented as a v1 non-guarantee. UTC normalization is out of scope. |
| Pool entries for references shared with `welcome-content.ts` (e.g. Gen 1:1, John 3:16) may produce different text than the hardcoded BSB snapshots if the upstream API changes | Accepted v1 risk per D2. Not a spec failure; a future change owns consolidation. |
| `dayOfYear % pool.length` behavior for leap years (366 days, 365-entry pool): day 366 wraps to index `366 % 365 = 1`, which is the same entry as Jan 2 of the same year | Spec permits this. The formula is intentionally size-agnostic. Noted so tests can assert it explicitly if desired. |
