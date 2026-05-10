# Spec — v1-architecture-spike

## TL;DR

This spec governs the smallest end-to-end hexagonal slice for `verbum`: parse `john 3:16`, fetch BSB chapter 3 from helloao, slice verse 16, print to stdout, exit 0. It covers one happy-path scenario and a parse-error path, resolves four open questions from the proposal, and sets stable requirement and scenario IDs for downstream tasks and apply phases.

---

## Resolved decisions

**D1 — Default translation constant lives in domain, not the CLI driver.**
`DEFAULT_TRANSLATION_ID` is defined in `src/domain/` as a `TranslationId`-branded constant, keeping the CLI a thin driver and giving every future consumer a single import target.

**D2 — `TranslationId` brand is introduced now.**
The brand is established in `src/domain/translation-id.ts` with a `makeTranslationId` factory (R6). Passing a raw `"BSB"` string without a brand anywhere outside that factory is a review-blocker. One-line cost, full portability from the first commit.

**D3 — Parse-error message formatting belongs in the CLI layer (`src/cli/`), not the domain.**
The domain owns the `ParseError` discriminated union (R5); the CLI driver owns `renderParseError(err: ParseError): string`, which may add ANSI colors, exit-code conventions, or terminal-width wrapping without polluting domain purity. The house-rules R5 example of a `format()` function is illustrative, not prescriptive — R5 mandates the union shape, not the formatting location.

**D4 — The v1 spike parser accepts only `<book> <chapter>:<verse>` — no ranges, no whole-chapter.**
`john 3:16` is the only accepted shape. `john 3` (whole chapter) and `john 3:16-18` (range) are OUT for this spike and deferred to a subsequent v1 slice. This keeps `parseReference` to a single code path.

---

## Requirements

### REQ-1: `Result<T, E>` utility type

- MUST be defined in `src/domain/result.ts` as a discriminated union `{ ok: true; value: T } | { ok: false; error: E }` (R1, R5).
- MUST NOT depend on any runtime library — plain TypeScript only (R4).
- MUST be the exclusive mechanism for representing fallible outcomes across all layers in this slice.

### REQ-2: `BookId` brand and factory

- MUST be defined in `src/domain/book-id.ts` (R6).
- MUST expose `BookId` as a branded string type and `makeBookId(s: string): Result<BookId, InvalidBookError>` as the only creation path.
- MUST include at minimum the full canonical USFM set needed to satisfy SCN-1 (`JHN`) and SCN-3 (rejection of unknown input).
- The `as BookId` cast MUST appear only inside `makeBookId`; all other call sites use the factory (R6).
- `InvalidBookError` MUST be `{ kind: "invalid_book"; input: string }` (R5).

### REQ-3: `TranslationId` brand, factory, and default constant

- MUST be defined in `src/domain/translation-id.ts` (R6, D2).
- MUST expose `TranslationId` branded string, `makeTranslationId(s: string): TranslationId` factory, and `DEFAULT_TRANSLATION_ID: TranslationId` constant whose value is the BSB identifier `"BSB"` (D1).
- Raw string literals `"BSB"` MUST NOT appear anywhere outside `src/domain/translation-id.ts`.

### REQ-4: `ParseError` discriminated union

- MUST be defined in `src/domain/errors.ts` (R5).
- MUST cover exactly these variants for the spike:
  - `{ kind: "empty_input" }` — returned by `parseReference` when called with a blank or whitespace-only string. The entry point (REQ-12) never calls `parseReference` with no args, so this variant is not reachable from SCN-5; it remains in the union for completeness (future callers, unit tests, programmatic API use).
  - `{ kind: "unknown_book"; input: string }`
  - `{ kind: "malformed_chapter_verse"; input: string }`
  - `{ kind: "out_of_range"; chapter: number; max: number }`
- MUST NOT include a `format` or message method — presentation is CLI's responsibility (D3).

### REQ-5: `parseReference` — reference parser

- MUST be a pure function `parseReference(input: string): Result<Reference, ParseError>` in `src/domain/reference.ts` (R1).
- MUST accept ONLY the shape `<book-name-or-alias> <chapter>:<verse>` (D4).
- MUST normalize book aliases case-insensitively: `"john"`, `"JOHN"`, `"Jn"` all resolve to `BookId` `"JHN"` (R6).
- MUST return `{ ok: false, error: { kind: "empty_input" } }` when input is blank or whitespace-only.
- MUST return `{ ok: false, error: { kind: "unknown_book"; input: <token> } }` when the book token does not match any alias.
- MUST return `{ ok: false, error: { kind: "malformed_chapter_verse"; input: <token> } }` when the `<chapter>:<verse>` token is absent or not parseable as two positive integers.
- MUST return `{ ok: false, error: { kind: "out_of_range"; ... } }` when chapter or verse exceeds the canonical maximum for that book.
- MUST NOT perform any IO, import Zod, or reference global state (R1, R4).
- The `Reference` type MUST be `{ book: BookId; chapter: number; verse: number }` for this spike — no `Range` field yet.

### REQ-6: `BibleRepository` port

- MUST be defined in `src/application/ports/bible-repository.ts` (R3).
- MUST expose at minimum: `getChapter(translationId: TranslationId, bookId: BookId, chapter: number): Promise<Result<Chapter, RepoError>>` (R3, R12).
- MUST take only primitives and branded structs as arguments — no callbacks, no observables (R3).
- `RepoError` MUST be a discriminated union with a `kind` field (R5); for this spike, variants MAY include `{ kind: "network_error"; message: string }` and `{ kind: "schema_mismatch"; message: string }`.
- The `Chapter` type MUST be `{ verses: Verse[] }` where `Verse = { number: number; text: string }` — plain TypeScript, no Zod (R4).

### REQ-7: Zod schemas for helloao chapter response

- MUST live in `src/api/schemas.ts` and MUST NOT be imported from outside `src/api/` (R4).
- MUST model the mixed-content `verse.content` field as `z.array(z.union([z.string(), z.object({ noteId: z.number() })]))`.
- MUST use `z.discriminatedUnion("type", [...])` for `chapter.content[]` items, covering at minimum: `{ type: "verse" }`, `{ type: "heading" }`, `{ type: "line_break" }`.
- Unknown `type` variants SHOULD be handled gracefully (dropped, not a fatal schema failure) — exact strategy deferred to design (Q6).
- MUST NOT use conditional, mapped, or template-literal types that cross the domain or application boundary (R7).

### REQ-8: `toVerseText` flattening helper

- MUST be defined inside `src/api/` (not exported to domain or application).
- MUST accept `Array<string | { noteId: number }>` and return `string`.
- MUST include only the string elements and discard `{ noteId }` objects (footnotes stripped — Option A, locked in proposal).
- The resulting string MUST be non-empty for any verse that contains at least one string segment.

### REQ-9: `HelloAoBibleRepository` adapter

- MUST live in `src/api/hello-ao-bible-repository.ts`.
- MUST implement the `BibleRepository` port (REQ-6).
- MUST use `fetch()` (Bun built-in) for HTTP calls — no third-party HTTP library.
- MUST parse the raw response with the Zod schemas from REQ-7 via `safeParse` — never `parse` (throws).
- MUST return `{ ok: false, error: { kind: "schema_mismatch" } }` on Zod parse failure.
- MUST map parsed verses to domain `Verse` using `toVerseText()` (REQ-8).
- MUST return `Promise<Result<Chapter, RepoError>>` — never bare `Promise<Chapter>` (R12).
- MUST NOT expose any Zod type or schema outside `src/api/` (R4).

### REQ-10: `getPassage` use case

- MUST be defined in `src/application/get-passage.ts`.
- MUST have the signature `getPassage(repo: BibleRepository, ref: Reference): Promise<Result<Passage, AppError>>` (R12).
- MUST call `repo.getChapter(translationId, ref.book, ref.chapter)` using `DEFAULT_TRANSLATION_ID` (D1).
- MUST slice the returned `Chapter.verses` to locate the verse matching `ref.verse`.
- MUST return `{ ok: false, error: { kind: "verse_not_found" } }` if the verse number is absent in the chapter data.
- MUST NOT perform reference parsing — it receives an already-validated `Reference` (single responsibility).
- `Passage` MUST be `{ reference: Reference; translationId: TranslationId; verse: Verse }` for this spike.
- `AppError` MUST be a discriminated union covering at minimum `{ kind: "repo_error"; inner: RepoError }` and `{ kind: "verse_not_found" }` (R5).

### REQ-11: CLI driver (`src/cli/run.ts`)

- MUST collect positional argv tokens via Bun's built-in `parseArgs` from `"util"` — no hand-rolled parser.
- MUST join the positional tokens into a single input string and pass it to `parseReference`.
- On `ParseError`: MUST write `renderParseError(err)` to stderr and exit with code `2` (D3).
- On `AppError` from `getPassage`: MUST write a non-empty message to stderr and exit with a non-zero code (exact code is unspecified for this spike beyond "not 0 and not 2").
- On success: MUST write the verse text to stdout and exit with code `0`.
- MUST NOT write to stdout on any error path.
- MUST NOT write to stderr on the happy path.
- `renderParseError(err: ParseError): string` MUST cover all four `ParseError.kind` variants exhaustively — a `never` fallthrough MUST be present (R5).

### REQ-12: Entry point (`src/index.tsx`)

- MUST detect CLI mode by checking whether positional argv arguments are present.
- When positional args are present, MUST delegate to `src/cli/run.ts` and exit.
- When no positional args are present, MUST treat the invocation as a usage error: write a usage message (e.g. `Usage: verbum <reference> (e.g., verbum john 3:16)`) to **stderr** and exit with code **2** (SCN-5).
- This keeps the no-args path consistent with the `ParseError` contract and avoids short-circuiting the parser with a silent stdout stub. When TUI mode lands in a future slice, this one-liner flips to launching the TUI with no spec contradiction.
- MUST NOT contain business logic.

### REQ-13: Smoke test

- MUST exercise the happy path end-to-end against a recorded fixture (no live network in CI).
- MUST cover at minimum: `john 3:16` → stdout contains verse text, exit 0.
- MUST cover at minimum: one unknown-book input → stderr non-empty, exit 2, stdout empty.
- The fixture MUST be a static JSON file representing a valid helloao chapter response — exact location deferred to design (Q6).
- MUST NOT make real network calls.

### REQ-14: Compiled binary CI step

- MUST run `bun build --compile src/index.tsx --outfile verbum` as a CI step.
- MUST execute the compiled binary against the same happy-path and parse-error cases from REQ-13.
- MUST assert exit codes and output streams for both cases.

---

## Acceptance scenarios

### SCN-1: Happy path — `john 3:16` via `bun run`

GIVEN: a valid helloao fixture for John chapter 3 containing verse 16 with non-empty text
WHEN: `bun run src/index.tsx john 3:16` is executed
THEN: stdout contains the BSB text of John 3:16
AND: exit code is 0
AND: stderr is empty

### SCN-2: Happy path — compiled binary

GIVEN: a compiled binary at `./verbum` built via `bun build --compile`
AND: the same fixture from SCN-1 is available
WHEN: `./verbum john 3:16` is executed
THEN: stdout contains the BSB text of John 3:16
AND: exit code is 0
AND: stderr is empty

### SCN-3: Parse error — unknown book

GIVEN: no fixture is required (parse fails before IO)
WHEN: `bun run src/index.tsx xyzzy 99:99` is executed
THEN: stderr contains a message that names the unknown book token (`"xyzzy"`)
AND: exit code is 2
AND: stdout is empty

### SCN-4: Parse error — malformed chapter:verse

GIVEN: no fixture is required
WHEN: `bun run src/index.tsx john abc` is executed
THEN: stderr contains a message about malformed chapter:verse
AND: exit code is 2
AND: stdout is empty

### SCN-5: No-args invocation — usage error

GIVEN: no fixture is required
WHEN: `bun run src/index.tsx` is executed with no positional arguments
THEN: stderr contains a usage message (e.g., `Usage: verbum <reference>`)
AND: exit code is 2
AND: stdout is empty
AND: `parseReference` is NOT called — the entry point short-circuits before delegating to the CLI driver (REQ-12)

### SCN-6: Case-insensitive book alias

GIVEN: a valid fixture for John chapter 3
WHEN: `bun run src/index.tsx JOHN 3:16` is executed
THEN: stdout contains the BSB text of John 3:16
AND: exit code is 0

### SCN-7: Compiled binary CI step passes

GIVEN: all source files are present and type-correct
WHEN: the CI workflow runs `bun build --compile src/index.tsx --outfile verbum`
THEN: the command exits 0
AND: the binary `./verbum` is executable
AND: `./verbum john 3:16` exits 0 with BSB verse text on stdout
AND: `./verbum xyzzy 99:99` exits 2 with non-empty stderr

---

## Out of scope (proposal Scope-OUT)

- `Cache` port and `FilesystemCache` adapter
- `PreferencesStore` and last-position memory
- `OutputFormatter` port and `--format text|json|markdown` flag
- `ToggleFavoriteTranslation` use case and favorites
- `ListTranslations` use case
- TUI presentation (all components, routing, reducer, effect runner)
- Mouse + keyboard symmetric input
- Network-error UX polish (timeouts, retries, friendly messages)
- Footnote preservation in verse text — locked as Option A (strip) for all of v1
- Reference shapes beyond `<book> <chapter>:<verse>`: ranges (`john 3:16-18`), whole-chapter (`john 3`), multi-chapter
- Verification of translations or books other than BSB / John 3

---

## Open questions for design (proposal Q5–Q6)

- **Q5**: `Chapter` vs `Passage` slicing location — spec assigns slicing to the use case (REQ-10). Design should confirm the adapter returns a full `Chapter` (all verses) and the use case owns verse extraction.
- **Q6**: Smoke test fixture directory — `src/api/__fixtures__/`? `tests/fixtures/`? Design or the first apply commit picks a location and documents it as a project convention.
