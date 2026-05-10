# Proposal — v1-architecture-spike: end-to-end hexagonal slice for John 3:16

## TL;DR

The smallest end-to-end slice that proves the four hexagonal layers wire correctly: parse `john 3:16`, fetch BSB chapter 3 of John from helloao, slice verse 16, print to stdout, exit 0. Both `bun run src/index.tsx` and the `bun build --compile` artifact must satisfy the same success criterion. Cache, preferences, TUI, format flags, favorites, and footnote preservation are explicitly deferred.

## What

This change ships a vertical slice through every hexagonal layer for one happy path (`john 3:16` → BSB text on stdout) and one parse-error path (`xyzzy 99:99` → stderr, exit 2). It is an **architecture spike**: the goal is not a feature, it is to prove the layer boundaries — domain purity, port-as-interface, Zod-only-at-boundary, presentation-as-thin-driver — actually hold when something flows through them. The slice produces a runnable CLI from both `bun run` and the compiled binary, and nothing else.

## Why now

v1 of `verbum` lists four use cases, three ports, and a TUI in the roadmap. Building any of those before the layer plumbing is proven risks discovering, mid-feature, that one of the house rules (R1, R3, R4, R12) doesn't survive contact with the real helloao response shape. Exploration already surfaced one such friction point — the mixed-array `verse.content` — and resolved it. This spike locks the resolution in code so every later slice (translation list, favorites, last-position, format flags, TUI) extends a working skeleton instead of debating its shape.

## Scope — IN

Concrete artifacts that ship in this PR, named at the layer they live in:

- `src/domain/reference.ts` — `Reference` type sketch, `parseReference(input: string): Result<Reference, ParseError>` (pure, no IO, no Zod)
- `src/domain/result.ts` — the shared `Result<T, E>` discriminated union (R1, R5)
- `src/domain/book-id.ts` — `BookId` brand + `makeBookId` factory with the canonical USFM set (R6); enough entries to cover John for the happy path plus the "unknown book" rejection for the error path
- `src/domain/errors.ts` — `ParseError` discriminated union (`empty_input`, `unknown_book`, `out_of_range`) (R5)
- `src/api/schemas.ts` — Zod schemas: `RawVerseContentItemSchema` (string-or-noteId union), `RawVerseSchema`, `RawChapterContentItemSchema` (discriminatedUnion on `type`), top-level chapter response
- `src/api/hello-ao-bible-repository.ts` — `HelloAoBibleRepository` implementing the `BibleRepository` port; contains `toVerseText()` flattening helper (footnotes stripped, Option A); returns `Promise<Result<Chapter, RepoError>>` (R12)
- `src/application/ports/bible-repository.ts` — the `BibleRepository` port interface (R3)
- `src/application/get-passage.ts` — `getPassage(repo, ref): Promise<Result<Passage, AppError>>` use case; orchestrates repo call + verse-range slicing
- `src/cli/run.ts` — argv → `parseReference` → `getPassage` → format → stdout/stderr; owns the exit-code contract
- `src/index.tsx` — entry that delegates to `src/cli/run.ts` when argv has a reference (TUI branch is a stub for this slice)
- One smoke test that exercises the happy path end-to-end against a recorded fixture (no live network in CI)
- A CI step that runs `bun build --compile` and executes the binary against the same two cases

**Exit code contract:** `0` happy path, `2` parse error. Anything else (network, schema mismatch) is out of scope for this slice's UX but the use case must still return a `Result` — it just won't have a polished error path yet.

## Scope — OUT

Deferred to subsequent v1 slices (cite roadmap row v1 unless noted):

- `Cache` port and `FilesystemCache` adapter (v1 row, separate slice)
- `PreferencesStore` and last-position memory (v1 row)
- `OutputFormatter` port and `--format text|json|markdown` (v1 row)
- `ToggleFavoriteTranslation` use case + favorites (v1 row)
- `ListTranslations` use case (v1 row)
- TUI presentation entirely (v1 row, biggest deferred chunk)
- Mouse + keyboard symmetric input (v1 row, TUI-bound)
- Network-error UX polish (timeouts, retries, friendly messages)
- Footnote preservation in verse text — locked as Option A (strip) for v1; revisit at v6 (cross-references + footnotes UI)
- Any reference shape beyond `book chapter:verse` and the unknown-book error case (e.g. ranges `john 3:16-18`, multi-chapter, whole chapter) — spec phase decides minimum parser surface
- BSB-other-than-John-3 verification: the success criterion only mandates John 3:16 works; broader translations and books are not part of the spike's pass condition

## Approach

Four files do real work, one per layer, plus the schema and the entry shim. The flow:

```
argv ──► src/cli/run.ts
            │
            ▼  parseReference(input)
        src/domain/reference.ts ──► Result<Reference, ParseError>
            │
            ▼  getPassage(repo, ref)
        src/application/get-passage.ts
            │  depends only on BibleRepository port
            ▼
        src/api/hello-ao-bible-repository.ts
            │  fetch + Zod + toVerseText() flattening
            ▼  Result<Chapter, RepoError>
        back up through application → cli → stdout
```

**Zod strategy.** All schemas live in `src/api/schemas.ts` and never escape — the adapter exposes domain types only (R4). The mixed-array gotcha is handled at the boundary by a `discriminatedUnion("type", ...)` schema for `chapter.content[]` items plus a small `toVerseText(items)` helper that filters to strings and joins. Domain `Verse = { number: number; text: string }` stays plain TypeScript.

**Argv parsing.** Use Bun's built-in `parseArgs` (`import { parseArgs } from "util"`). It is part of Node compat in Bun, ships in compiled binaries, and avoids a hand-rolled positional parser that would need its own tests. Reference parsing itself stays in the domain — `parseArgs` only collects the positional argv tokens and joins them.

**Exit codes.** Owned by `src/cli/run.ts` only. Use cases return `Result`; the CLI driver maps `{ ok: true }` → stdout + `0`, `ParseError` → stderr + `2`. Other error kinds funnel to a temporary "unexpected error" stderr + non-zero exit; spec/design will refine the contract later.

**One PR, one commit per layer when it earns its keep** (work-unit-commits): domain + tests, application + port, api adapter + schema, cli wiring + entry. Smoke test ships with the cli wiring commit since that's the first commit that can run end-to-end.

## Open questions (for spec/design)

1. **Default translation.** The success criterion says "BSB". Is `"BSB"` a hardcoded constant in the CLI driver for this slice, or does spec define a `DEFAULT_TRANSLATION_ID` in domain? Either is defensible; spec should pick.
2. **Translation lookup vs literal.** Is `"BSB"` passed as a literal `TranslationId` brand, or do we go through a `BookCatalog`/`TranslationCatalog` lookup? Spike-only: literal is fine. Spec should declare whether v1 introduces a `TranslationId` brand now or later.
3. **Parse-error message format.** Where does the user-facing string for `ParseError` live — domain (`format(err: ParseError): string`, like the house-rules example) or CLI (`renderParseError(err)` in `src/cli/`)? R5 example puts it in domain; spec should confirm.
4. **Reference parser surface.** This proposal only commits to `book chapter:verse` and the unknown-book error. Spec must declare whether `john 3` (whole chapter) and `john 3:16-18` (range) are in or out for v1.
5. **`Chapter` vs `Passage` boundary.** Repo returns a whole chapter; use case slices to the requested verse(s) and returns a `Passage`. Design should confirm that slicing lives in the use case, not the adapter (keeps the adapter dumb).
6. **Smoke test fixture location.** `src/api/__fixtures__/`? `tests/fixtures/`? Project standards don't specify yet. Design or first apply commit decides.

## Risks

- **Bun `parseArgs` quirks** — small chance of subtle differences between `bun run` and the compiled binary (e.g. argv[0] semantics). Mitigation: the CI step that runs the compiled binary against both success cases catches it on the first run.
- **Zod discriminatedUnion on `type` for chapter content** — if helloao introduces a new `type` (e.g. `"poetry"`) the schema rejects the response. Acceptable for the spike; spec/design should decide whether unknown content items are dropped or fail-loud.
- **R7 pressure in the api layer** — Zod ergonomics may tempt mapped/conditional types. R7 explicitly allows them in `src/api/` only; reviewer must confirm none leak across the boundary.
- **Test coverage of the compiled binary in CI** — running `bun build --compile` + a smoke test on every PR is new infrastructure; first run may surface a CI config issue rather than a code issue.
- **One-commit-per-layer cadence colliding with reviewable-on-its-own (work-unit-commits)**: the application commit can't run end-to-end without the adapter. Mitigation: ship application + port together, then api adapter, then cli (the cli commit is the one that gains the smoke test).

## Estimated size

| Bucket | Files | Lines (rough) |
|---|---|---|
| Domain (`reference.ts`, `result.ts`, `book-id.ts`, `errors.ts`) | 4 | ~120 |
| Application (`bible-repository.ts` port, `get-passage.ts`) | 2 | ~60 |
| Api (`schemas.ts`, `hello-ao-bible-repository.ts`) | 2 | ~120 |
| CLI + entry (`cli/run.ts`, `index.tsx`) | 2 | ~50 |
| Tests + fixture | 2 | ~80 |
| CI step | 1 (workflow edit) | ~20 |
| **Total** | **~13** | **~450** |

Slightly above the 400-line target. The Review Workload Guard should consider this borderline — likely still a single PR with `size:exception` if the maintainer agrees, otherwise a chained split where domain + application land first and the api adapter + cli wiring land second. Tasks phase will firm this up.

---

**Decisions locked into this proposal (do not re-litigate downstream):**
- Footnote handling: Option A (strip `{ noteId }`, join strings only).
- `BookId` USFM codes map 1:1 to helloao API book paths — no translation layer.
- `bun build --compile` is a CI artifact, not a research item.
- Zod stays in `src/api/` (R4); domain types are plain TS.
- All async data functions return `Promise<Result<T, E>>` (R12).
- Errors are `kind`-tagged unions (R5); no error class hierarchies.
- Argv parsing uses Bun's built-in `parseArgs` (no hand-rolled parser).
- Exit codes: `0` happy, `2` parse error.
