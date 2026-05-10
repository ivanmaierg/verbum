# Design: verbum-vod

## TL;DR

`verbum vod` ships as a tiny CLI dispatch (one `if` in `run.ts`) plus a pure picker (`pickVerseForDate`) plus a 365-entry POJO pool (`VERSE_POOL`) plus a `runVod(date)` handler that mirrors `run()`'s exit-code contract. No new dependencies, no new ports, no new domain types. `dayOfYear` is a private helper in `verse-pool.ts` using UTC midnight arithmetic (DST-safe). Pool entries are `{ usfm, chapter, verse }` tuples; `Reference` is built at use time so `makeBookId` errors flow through normal CLI error paths (R6 spirit). Devotional/comfort canon distribution: 80 Psalms / 50 Proverbs / 40 John / 35 Romans / 25 Philippians / 20 Isaiah / 15 Matthew / 15 (1 John+James) / 85 spread across NT epistles + Gospels + wisdom.

## Layer Audit Summary

| File | Layer | Imports allowed from | Verdict |
|------|-------|----------------------|---------|
| `src/application/verse-pool.ts` | application | domain only | OK — pure, no IO |
| `src/application/verse-pool.test.ts` | application | application + domain | OK |
| `src/cli/verse-pool-data.ts` | cli (config-data) | none (POJO export only) | OK — data, not logic |
| `src/cli/vod.ts` | cli | application + domain + cli/render + api | OK — same layer mix as `run.ts` |
| `src/cli/run.ts` (modified) | cli | unchanged | OK — adds 3 lines, preserves existing path |
| `tests/vod-smoke.test.ts` | test | application + domain + cli (stub repo) | OK — mirrors `tests/smoke.test.ts` |

No inward-arrow violations. Application never imports CLI.

## File-by-File Design

### `src/application/verse-pool.ts` (NEW, pure)

```ts
// Why: the picker is application-layer because it operates on POJO pool entries
// — it does NOT take a BibleRepository, does NOT touch IO. Pool data lives in
// the CLI layer (it is config, not a domain concept), but the picking algorithm
// is reusable and testable in isolation here.

export type PoolEntry = {
  readonly usfm: string;
  readonly chapter: number;
  readonly verse: number;
};

// pickVerseForDate — pure. Same date → same entry. Size-agnostic via modulo.
// Determinism formula: dayOfYear(date) % pool.length.
export function pickVerseForDate(
  date: Date,
  pool: readonly PoolEntry[],
): PoolEntry {
  const idx = dayOfYear(date) % pool.length;
  // pool.length is 365 by invariant I1; pool[idx] is always defined.
  // Non-null assertion is local and justified — the alternative (Result) would
  // pollute every caller for a branch that cannot fire.
  return pool[idx]!;
}

// dayOfYear — 1-based day of the calendar year using LOCAL date components,
// computed via UTC arithmetic to avoid DST hour-shift jumps causing day skips.
// Jan 1 → 1, Dec 31 (non-leap) → 365, Dec 31 (leap) → 366.
export function dayOfYear(date: Date): number {
  const startUtc = Date.UTC(date.getFullYear(), 0, 1);
  const todayUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const MS_PER_DAY = 86_400_000;
  return Math.floor((todayUtc - startUtc) / MS_PER_DAY) + 1;
}
```

Notes:
- `PoolEntry` is exported so `verse-pool-data.ts` can type its const without re-declaring the shape (single source of truth for the tuple shape).
- `dayOfYear` is exported (not just internal) so the test suite can assert it explicitly for known dates.
- No `Result` here — picker is total: pool is non-empty by invariant I1, modulo is always in range. Adding `Result` would force every CLI consumer to handle an impossible error branch (R1 says "domain functions never throw", not "every function returns Result regardless of fallibility").

### `src/application/verse-pool.test.ts` (NEW)

Mirrors the style of `src/domain/book-id.test.ts`. Three sections:

```ts
import { describe, it, expect } from "bun:test";
import { pickVerseForDate, dayOfYear } from "@/application/verse-pool";
import { VERSE_POOL } from "@/cli/verse-pool-data";
import { makeBookId } from "@/domain/book-id";

describe("dayOfYear", () => {
  it("Jan 1 → 1", () => expect(dayOfYear(new Date(2025, 0, 1))).toBe(1));
  it("Mar 15 (non-leap) → 74", () => expect(dayOfYear(new Date(2025, 2, 15))).toBe(74));
  it("Jul 4 (non-leap) → 185", () => expect(dayOfYear(new Date(2025, 6, 4))).toBe(185));
  it("Dec 31 (non-leap) → 365", () => expect(dayOfYear(new Date(2025, 11, 31))).toBe(365));
  it("Feb 29 (leap) → 60", () => expect(dayOfYear(new Date(2024, 1, 29))).toBe(60));
  it("Dec 31 (leap) → 366", () => expect(dayOfYear(new Date(2024, 11, 31))).toBe(366));
});

describe("pickVerseForDate — determinism", () => {
  it("same date twice → same entry (referentially equal)", () => {
    const a = pickVerseForDate(new Date(2025, 5, 15), VERSE_POOL);
    const b = pickVerseForDate(new Date(2025, 5, 15), VERSE_POOL);
    expect(a).toBe(b);
  });

  it("Jan 1 2025 → VERSE_POOL[1] (day 1 % 365)", () => {
    expect(pickVerseForDate(new Date(2025, 0, 1), VERSE_POOL)).toBe(VERSE_POOL[1]);
  });

  it("Mar 15 2025 → VERSE_POOL[74]", () => {
    expect(pickVerseForDate(new Date(2025, 2, 15), VERSE_POOL)).toBe(VERSE_POOL[74]);
  });

  it("Jul 4 2025 → VERSE_POOL[185]", () => {
    expect(pickVerseForDate(new Date(2025, 6, 4), VERSE_POOL)).toBe(VERSE_POOL[185]);
  });

  it("Dec 31 2025 → VERSE_POOL[0] (365 % 365)", () => {
    expect(pickVerseForDate(new Date(2025, 11, 31), VERSE_POOL)).toBe(VERSE_POOL[0]);
  });

  it("Dec 31 2024 (leap) → VERSE_POOL[1] (366 % 365)", () => {
    expect(pickVerseForDate(new Date(2024, 11, 31), VERSE_POOL)).toBe(VERSE_POOL[1]);
  });

  it("day N+1 ≠ day N", () => {
    const a = pickVerseForDate(new Date(2025, 5, 15), VERSE_POOL);
    const b = pickVerseForDate(new Date(2025, 5, 16), VERSE_POOL);
    expect(a).not.toBe(b);
  });
});

describe("VERSE_POOL — invariants (I1, I2)", () => {
  it("I1: pool contains exactly 365 entries", () => {
    expect(VERSE_POOL.length).toBe(365);
  });

  it("I2: every entry's usfm is accepted by makeBookId", () => {
    for (const entry of VERSE_POOL) {
      const result = makeBookId(entry.usfm);
      if (!result.ok) {
        throw new Error(
          `Pool entry rejected: usfm="${entry.usfm}" ${entry.chapter}:${entry.verse}`,
        );
      }
    }
  });

  it("every entry has chapter >= 1 and verse >= 1", () => {
    for (const entry of VERSE_POOL) {
      expect(entry.chapter).toBeGreaterThanOrEqual(1);
      expect(entry.verse).toBeGreaterThanOrEqual(1);
    }
  });
});
```

Pattern matches `book-id.test.ts` (no `bun:test` mock harness, just `describe`/`it`/`expect`).

### `src/cli/verse-pool-data.ts` (NEW, data only)

```ts
// Why: the daily verse pool lives in the CLI layer because it is configuration
// data, not a domain concept (the proposal explicitly rejected a VersePool port).
// Each entry is a USFM string + chapter + verse; the pool size is 365 (I1) so
// no verse repeats within a year. Curation style: devotional / comfort canon
// — Psalms-heavy with cornerstone NT verses (John 3:16, Rom 8:28, Phil 4:6-7,
// Jer 29:11, Pro 3:5-6, Isa 40:31, etc.). Light on genealogies, Levitical law,
// prophetic oracles, judgment passages.
//
// Maintenance: any edit MUST keep length === 365. The "every entry has a valid
// USFM" test in src/application/verse-pool.test.ts catches typos at `bun test`
// time. To rebalance, edit entries in place — the picker is size-agnostic but
// the test fails if length drifts from 365.

import type { PoolEntry } from "@/application/verse-pool";

export const VERSE_POOL: readonly PoolEntry[] = [
  // ... 365 entries (full list provided in apply-progress artifact)
];
```

### `src/cli/vod.ts` (NEW)

```ts
// Why: runVod owns the same exit-code contract as run() but for the vod
// subcommand — kept separate so run.ts stays a thin dispatcher.
// Mirrors run.ts's error-handling pattern exactly:
//   0 → verse on stdout
//   1 → repo error (network, etc.) on stderr
//   2 → makeBookId rejected pool entry on stderr (pool typo)

import { pickVerseForDate } from "@/application/verse-pool";
import { VERSE_POOL } from "@/cli/verse-pool-data";
import { makeBookId } from "@/domain/book-id";
import { getPassage } from "@/application/get-passage";
import {
  renderParseError,
  renderRepoError,
  renderPassage,
} from "@/cli/render";
import { createHelloAoBibleRepository } from "@/api/hello-ao-bible-repository";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { Reference } from "@/domain/reference";
import type { RepoError } from "@/domain/errors";

// Optional repo injection enables the smoke test to pass a fixture-backed stub
// without spawning a process or hitting the network — same pattern as run().
export async function runVod(
  date: Date,
  repo: BibleRepository = createHelloAoBibleRepository(),
): Promise<number> {
  const entry = pickVerseForDate(date, VERSE_POOL);

  // Construct BookId via the single factory (R6). A typo in pool data lands here.
  const bookResult = makeBookId(entry.usfm);
  if (!bookResult.ok) {
    process.stderr.write(renderParseError(bookResult.error) + "\n");
    return 2;
  }

  // Build Reference — single-verse range (start === end), v1 shape.
  const ref: Reference = {
    book: bookResult.value,
    chapter: entry.chapter,
    verses: { start: entry.verse, end: entry.verse },
  };

  const passageResult = await getPassage(repo, ref);
  if (!passageResult.ok) {
    // AppError = ParseError | RepoError; pool already passed makeBookId, so
    // the only ParseError that getPassage can surface is verse_not_found via
    // RepoError union — treat the remaining branch as RepoError.
    const err = passageResult.error as RepoError;
    process.stderr.write(renderRepoError(err) + "\n");
    return 1;
  }

  process.stdout.write(renderPassage(passageResult.value) + "\n");
  return 0;
}
```

### `src/cli/run.ts` (MODIFIED) — exact diff

Current lines 16-29 (BEFORE):

```ts
export async function run(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
  });

  const input = positionals.join(" ").trim();

  const refResult = parseReference(input);
  if (!refResult.ok) {
    process.stderr.write(renderParseError(refResult.error) + "\n");
    return 2;
  }
```

AFTER:

```ts
export async function run(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
  });

  // Subcommand dispatch (I6, I7): check before parseReference. Any positional
  // that is NOT a recognised subcommand falls through unchanged.
  if (positionals[0] === "vod") {
    return await runVod(new Date());
  }

  const input = positionals.join(" ").trim();

  const refResult = parseReference(input);
  if (!refResult.ok) {
    process.stderr.write(renderParseError(refResult.error) + "\n");
    return 2;
  }
```

Plus one new import at the top:

```ts
import { runVod } from "@/cli/vod";
```

Net diff: 1 import line + 4 logic lines (3 if you collapse the comment). Existing `verbum john 3:16` path is structurally untouched — invariant I8 holds.

### `tests/vod-smoke.test.ts` (NEW)

Mirrors `tests/smoke.test.ts` exactly: builds a fixture-backed `BibleRepository` stub (no real HTTP, no subprocess) and asserts the verse text comes back through the full `runVod` chain. Captures stdout via a write spy so we can assert what reached the user.

## Commit sequence (work-unit-commits)

| # | Commit | Files | Lines (est) | Why this slice is autonomous |
|---|--------|-------|-------------|-------------------------------|
| C1 | `feat(application): add pickVerseForDate picker + tests` | `src/application/verse-pool.ts`, `src/application/verse-pool.test.ts` (without the `VERSE_POOL` invariant tests — those land in C2) | ~60 | Pure function + tests. `bun test` green. No CLI changes, no pool dependency yet. |
| C2 | `feat(cli): add 365-entry verse pool data + invariant tests` | `src/cli/verse-pool-data.ts`, append invariant tests to `src/application/verse-pool.test.ts` | ~370 + 30 | Mechanical data file. The "every entry valid" test runs against the new data. `bun test` green. No runtime wire-up yet. |
| C3 | `feat(cli): add runVod handler + smoke test` | `src/cli/vod.ts`, `tests/vod-smoke.test.ts` | ~80 | Wires picker + pool + repo. Smoke test exercises the full chain via stub repo. `bun test` green. Not yet routed from `run.ts` — handler is dead code in production until C4. |
| C4 | `feat(cli): dispatch vod subcommand from run()` | `src/cli/run.ts` | ~5 | Smallest possible diff to existing code. Activates the feature. Existing `verbum john 3:16` smoke continues to pass (I8). `bun test` green. |

## Open Design Questions

None.
