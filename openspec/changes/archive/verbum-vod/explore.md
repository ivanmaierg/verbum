#175 [architecture] sdd/verbum-vod/explore
## Exploration: verbum-vod (Verse of the Day subcommand)

### TL;DR — Riskiest Unknown

The riskiest unknown is **subcommand routing collision**: `run()` in `src/cli/run.ts` today treats ALL argv as a reference string (`positionals.join(" ")`). Adding `verbum vod` means "vod" would be interpreted as a book alias — and it would currently fall through to `unknown_book` error. The disambiguation must happen BEFORE `parseReference` is called, and the boundary between subcommand dispatch and reference parsing must be designed carefully so neither breaks the other.

---

### Current State

**Entry point**: `src/index.tsx`
- `argv.length === 0` → TUI (`tuiDriver()`)
- any args → `run(argv)` in `src/cli/run.ts`

**`src/cli/run.ts`** — `run(argv: string[]): Promise<number>`
- Uses `parseArgs` (Node `util`) to collect `positionals`
- Joins all positionals into one string: `positionals.join(" ")`
- Calls `parseReference(input)` — single path, no subcommand concept at all
- Exit codes: 0 (ok), 1 (repo error), 2 (parse error)

**`src/application/get-passage.ts`** — `getPassage(repo, ref)`
- Fetches the whole chapter via `BibleRepository.getChapter`
- Slices by verse range
- Returns `Result<Passage, AppError>`

**`src/cli/render.ts`**
- `renderPassage(passage)`: joins `verse.text` with `\n`
- Pure string formatters for error types

**Output format**: bare verse text on stdout, no labels, no reference prefix. Single line for single-verse references.

**Domain types**: `Reference`, `BookId` (branded), `TranslationId` (branded), `Passage`, `Chapter`, `Verse`. All are plain TS types — no Zod in domain (R4).

**Test runner**: Bun's built-in (`bun test`). Test files co-located in `src/` or `tests/`. Pattern: `bun:test` imports, stub repos as inline objects satisfying `BibleRepository` interface. No golden files. No HTTP in tests (fixtures only).

**Existing tests**:
- `src/application/get-passage.test.ts` — unit tests for `getPassage` with inline stubs
- `src/api/hello-ao-bible-repository.test.ts` — likely adapter tests (not read, but present)
- `src/domain/book-id.test.ts`, `reference.test.ts` — domain unit tests
- `src/tui/welcome/welcome-reducer.test.ts` — reducer test
- `tests/smoke.test.ts` — end-to-end wiring: `parseReference → getPassage → renderPassage` with fixture-backed stub repo

---

### Affected Areas

- `src/index.tsx` — NO CHANGE needed; already delegates to `run(argv)` for any non-empty args
- `src/cli/run.ts` — PRIMARY CHANGE: add subcommand dispatch before the reference parsing path
- `src/cli/vod.ts` (NEW) — `vod` command handler, analogous to the reference path in `run.ts`
- `src/application/get-verse-of-the-day.ts` (NEW, OPTIONAL) — new use case, or just a thin wrapper
- `src/application/ports/verse-pool.ts` (NEW) — port for verse pool data (if port approach chosen)
- `src/cli/verse-pool.ts` (NEW) — hardcoded pool adapter (data lives here, not in domain)
- `src/domain/` — NO CHANGE. Verse pool is not a domain concept.
- `src/api/schemas.ts` — NO CHANGE. Pool is not fetched from network.

---

### Approaches

#### 1. Inline subcommand check in `run.ts` + hardcoded pool in CLI layer

Add a check at the top of `run()`: if `positionals[0] === "vod"`, branch to a `runVod()` function defined in `src/cli/vod.ts`. Pool is a hardcoded TS array of `{ book, chapter, verse }` tuples. Day selection is a pure function `pickForDate(date: Date, pool): Reference`.

- Pros: minimal new files, consistent with existing run.ts pattern, no new ports/adapters
- Cons: pool is not injectable (not testable via port substitution), but the picker function IS pure and testable
- Effort: Low

#### 2. New port `VersePool` in application layer

Define `VersePool` port in `src/application/ports/verse-pool.ts` returning `Promise<Result<Reference[], VersePoolError>>`. Wire a hardcoded adapter in `src/api/hardcoded-verse-pool.ts`. New use case `getVerseOfTheDay(pool, repo, date)` composes both.

- Pros: full hexagonal correctness, swappable pool source later (JSON, remote)
- Cons: overkill for a hardcoded constant list; adds 3 new files for minimal value; the pool adapter doesn't actually need to be async
- Effort: Medium

#### 3. Pure function pool with no port (application-layer helper, not a use case)

Export `pickVerseForDate(date: Date, pool: readonly Reference[]): Reference` from `src/application/verse-pool.ts`. The pool constant (array of references) is defined in `src/cli/verse-pool-data.ts` (CLI layer data, not domain). `run.ts` wires it. No new port. No new use case.

- Pros: pure function is fully testable, no new interfaces, no port pollution, pool data stays out of domain, forward-compatible with `--format` flag
- Cons: pool data lives in CLI layer (acceptable since it's a config/data concern, not domain)
- Effort: Low

---

### Recommendation

**Approach 3** (pure function + CLI-layer pool data) is the right call.

Why: the verse pool is NOT a domain concept. It's configuration — a curated list someone picked. Putting a `VersePool` port in the application layer (Approach 2) violates the spirit of ports: ports exist for IO-dependent adapters, not constant data. A hardcoded TS array isn't an "external system" that needs abstracting now.

The critical insight is that `pickVerseForDate` must be a pure function. That's the only testability requirement. It takes `(date, pool)` and returns deterministically based on `date.toDateString()` hash or `dayOfYear % pool.length`. The pool array is just a constant — it doesn't need injection.

**Subcommand routing** belongs in `run.ts` as a first-check on `positionals[0]`. Pattern:
```
if (positionals[0] === "vod") {
  return runVod(new Date());
}
// existing reference path follows unchanged
```

This keeps `run.ts` as the single dispatch point and avoids any changes to `src/index.tsx`.

**Determinism approach**: `dayOfYear % pool.length` where `dayOfYear` is derived from the date. Pure, deterministic per day, trivially testable by passing a fixed Date. Avoids RNG entirely.

**Output format**: match `renderPassage` exactly — bare verse text on stdout, newline-terminated, exit 0. No label prefix for v1 (consistent with `john 3:16` output). This means `vod` can reuse `renderPassage` directly.

**Pool content**: 15–30 well-known verses as hardcoded `Reference` objects. First-cut: construct them via `makeBookId` + `makeTranslationId` (same factories the rest of the codebase uses — R6). No raw strings.

**`--format` compatibility**: the `renderPassage` function is already the format boundary. When `--format text|json|markdown` lands, the `vod` path just passes its `Passage` to the same formatter. No pre-building needed — just don't hardcode the output format in `runVod`.

---

### Subcommand Routing Design

`run.ts` today: `positionals.join(" ")` → `parseReference`. Problem: `vod` as positionals[0] would produce `parseReference("vod")` → `unknown_book` error, exit 2.

Fix: check `positionals[0]` before any parsing. Keep it explicit — no magic routing table for now (only one subcommand). A routing table / Command pattern makes sense when there are 3+ subcommands.

```ts
if (positionals[0] === "vod") {
  return runVod(new Date());
}
```

This is non-breaking for all existing paths. `verbum john 3:16` → `positionals[0]` is "john", falls through to reference path unchanged.

---

### Files That Will Be Touched (Estimate)

NEW:
- `src/cli/vod.ts` — `runVod(date: Date): Promise<number>`, wires pool + picker + repo + render
- `src/application/verse-pool.ts` — pure `pickVerseForDate(date, pool)` function
- `src/cli/verse-pool-data.ts` — hardcoded pool: array of 15–30 `Reference` objects
- `src/application/verse-pool.test.ts` — unit tests for `pickVerseForDate`
- `tests/vod-smoke.test.ts` — smoke: `runVod(fixedDate)` returns 0, stdout contains verse text

MODIFIED:
- `src/cli/run.ts` — ~5 lines: add subcommand check at top + import `runVod`

UNTOUCHED:
- `src/index.tsx`, `src/domain/*`, `src/api/*`, `src/tui/*`, `src/application/get-passage.ts`

Total estimate: ~120 lines added, ~5 modified. Well within 400-line budget. Single PR.

---

### Open Questions for Proposal Phase

1. **Pool size**: 15 verses? 30? 365? Affects churn period before repeating. The proposal should pick a number and list the actual verses.
2. **Reference construction in pool data**: use `makeBookId` factory or allow raw strings in pool data file (since it's CLI-layer, not domain)? House rule R6 says "no `as BookId` casts" — must use the factory. Pool data file must call `makeBookId` and handle the Result (which should always be ok for known USFM codes).
3. **Pool data file layer**: `src/cli/verse-pool-data.ts` (CLI layer, since it's wired in CLI) or `src/application/verse-pool-data.ts`? Since `pickVerseForDate` lives in application and needs the pool as an argument, the pool data itself could live in CLI (passes to use case). This keeps application layer pure.
4. **Error surface**: what happens if `pickVerseForDate` returns a reference that `getPassage` can't fetch (API down)? Same as existing `run.ts`: render repo error to stderr, exit 1. No special handling needed.
5. **Welcome-screen pool reuse**: the `welcome-content.ts` already has hardcoded BSB text (GENESIS_1_1_TEXT, JOHN_3_16_TEXT). The `vod` pool is fetched live from the API. Clarify for proposal: should `vod` verses also be pre-cached as static text, or always fetched? Fetching aligns with `john 3:16` behavior (network call), static text would eliminate the network dependency but diverge from the existing pattern.

---

### Ready for Proposal

Yes. Architecture is clear. Riskiest unknown (subcommand routing collision) has a clean solution. Recommend proceeding to `sdd-propose`.
