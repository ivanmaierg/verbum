# Design — v1-architecture-spike

## TL;DR

Fifteen files across four hexagonal layers, with `Result<T, E>` as the universal control-flow type and one `BibleRepository` port between application and api. The adapter returns whole `Chapter`s; the use case slices to a `Passage`. Empty slices are a `RepoError.verse_not_found` (exit 1), unknown books are a `ParseError.unknown_book` (exit 2). All Zod stays inside `src/api/`; the domain is plain TS only.

## Resolved decisions

### Q5 — Chapter vs Passage boundary: slicing lives in the use case

`HelloAoBibleRepository` returns a full `Chapter` (`{ translationId, book, chapter, verses: Verse[] }`). The use case `getPassage(repo, ref)` calls `repo.getChapter(...)` and then slices `chapter.verses` by `ref.verses.start..ref.verses.end` to produce a `Passage`. Justification: the adapter never sees the `Reference` (R3 — port args are primitives/structs only — `getChapter` takes `(translationId, book, chapter)`), so the adapter can't slice even if it wanted to. Slicing is pure logic operating on a domain value object — it belongs in `src/application/`, where the `Reference` is in scope.

### Q6 — Smoke-test fixture location: `src/api/__fixtures__/`

Justification: colocates the recorded JSON with the schema + adapter that consume it. Matches React/Jest convention (`__mocks__`, `__fixtures__` are recognized as non-source by every modern bundler). On a Go port this maps mechanically to `internal/api/testdata/` (Go's `testdata/` directory is a stdlib convention). Rejected `tests/fixtures/` because it splits the fixture from its consumer — anyone reading `hello-ao-bible-repository.ts` would have to grep elsewhere. Rejected `src/api/__tests__/fixtures/` because v1 keeps unit tests next to their source files (`foo.test.ts` beside `foo.ts`), so there is no `__tests__` directory yet — adding one only for fixtures is premature.

### Q-bonus — Empty-slice case: `RepoError.verse_not_found`

When `ref.verses.start..end` falls outside the chapter's verse list (e.g. John 3:99), the slice is empty. Decision: return `{ ok: false, error: { kind: "verse_not_found" } }` from the use case. The CLI maps unknown `RepoError` variants to exit `1`. This is mildly imprecise (the repo *did* find the chapter; only the verse range is wrong) but introducing a third `RangeError` union for one v1 case is YAGNI. If v2 adds verse-range parsing (`john 3:16-18`) and we want richer UX, we promote it to a separate `RangeError` then. This also keeps `ParseError` truly parse-only (R5 — discriminated unions are easier to reason about when each kind is genuinely one concern).

## Type catalog (the contracts every layer agrees on)

### Domain types — `src/domain/`

```ts
// src/domain/result.ts  (R1, R5)
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// src/domain/book-id.ts  (R6)
export type BookId = string & { readonly __brand: "BookId" };
export function makeBookId(s: string): Result<BookId, UnknownBookError>;
//   CANONICAL set covers at least: GEN, EXO, ..., JHN, ..., REV
//   (full 66-book USFM list — cheap, future-proof, no domain knowledge cost)

// src/domain/translations.ts  (R6)
export type TranslationId = string & { readonly __brand: "TranslationId" };
export function makeTranslationId(s: string): TranslationId;
//   v1: no validation; trusts caller. Spec locks this as a v1 simplification.
export const DEFAULT_TRANSLATION_ID: TranslationId = makeTranslationId("BSB");

// src/domain/reference.ts
export type VerseRange = { start: number; end: number };
//   invariant: 1 <= start <= end. Enforced by parseReference, NOT by the type.
export type Reference = {
  book: BookId;
  chapter: number;        // >= 1
  verses: VerseRange;     // v1: always present (single verse → start === end)
};
export function parseReference(input: string): Result<Reference, ParseError>;

// src/domain/passage.ts  (R4 — plain TS, no Zod)
export type Verse = { number: number; text: string };
export type Chapter = {
  translationId: TranslationId;
  book: BookId;
  chapter: number;
  verses: Verse[];
};
export type Passage = {
  reference: Reference;
  verses: Verse[];   // sliced subset of Chapter.verses
};

// src/domain/errors.ts  (R5 — kind-tagged unions, no class hierarchies)
export type UnknownBookError = { kind: "unknown_book"; input: string };

export type ParseError =
  | { kind: "empty_input" }
  | { kind: "unknown_book"; input: string }
  | { kind: "malformed_chapter_verse"; input: string };
//   v1 omits "out_of_range" for parse — chapter/verse counts unknown until repo call.

export type RepoError =
  | { kind: "network"; message: string }
  | { kind: "schema_mismatch"; details: string }
  | { kind: "translation_not_found"; id: string }
  | { kind: "book_not_found"; id: string }
  | { kind: "chapter_not_found"; chapter: number }
  | { kind: "verse_not_found" };   // empty-slice case (see Q-bonus)

export type AppError = ParseError | RepoError;
```

Notes:
- All unions use `kind` (R5). Exhaustiveness checks via `const _: never = err` in switch defaults.
- No conditional / mapped / template-literal types anywhere in domain (R7). Unions are written out by hand.
- `VerseRange.start === end` for single-verse references like `john 3:16`.

## Port — `src/application/ports/bible-repository.ts`

```ts
import type { Result } from "@/domain/result";
import type { BookId } from "@/domain/book-id";
import type { TranslationId } from "@/domain/translations";
import type { Chapter } from "@/domain/passage";
import type { RepoError } from "@/domain/errors";

export interface BibleRepository {
  getChapter(
    translationId: TranslationId,
    book: BookId,
    chapter: number,
  ): Promise<Result<Chapter, RepoError>>;
}
```

Cites:
- R3: interface with primitive/struct args, no callbacks, no observables
- R12: `Promise<Result<T, E>>` — never bare `Promise<T>`
- v1 ships only `getChapter`. `getTranslations` and `getBooks` are deferred to later slices that need them.

## Use case — `src/application/get-passage.ts`

```ts
export async function getPassage(
  repo: BibleRepository,
  ref: Reference,
): Promise<Result<Passage, AppError>> {
  // 1. Fetch the whole chapter via the port.
  const chapterResult = await repo.getChapter(
    DEFAULT_TRANSLATION_ID,
    ref.book,
    ref.chapter,
  );
  if (!chapterResult.ok) return chapterResult; // RepoError propagates

  // 2. Slice by inclusive verse range.
  const { start, end } = ref.verses;
  const sliced = chapterResult.value.verses.filter(
    (v) => v.number >= start && v.number <= end,
  );

  // 3. Empty slice → verse_not_found (Q-bonus).
  if (sliced.length === 0) {
    return { ok: false, error: { kind: "verse_not_found" } };
  }

  // 4. Wrap and return.
  return {
    ok: true,
    value: { reference: ref, verses: sliced },
  };
}
```

Notes:
- `getPassage` is pure orchestration: no IO of its own, no Zod, no formatting.
- `DEFAULT_TRANSLATION_ID` is a domain constant (resolves Q1 in proposal — domain owns it, not CLI).
- Filtering by `v.number` (not array index) is intentional: API verses might not be contiguous if a translation has variant numbering. v1 BSB is contiguous, but the filter shape is correct for free.

## Adapter — `src/api/hello-ao-bible-repository.ts` (sketch)

```ts
// Zod schemas (live in src/api/schemas.ts — never imported outside src/api/)
const RawVerseContentItemSchema = z.union([
  z.string(),
  z.object({ noteId: z.number() }),
]);

const RawVerseSchema = z.object({
  type: z.literal("verse"),
  number: z.number(),
  content: z.array(RawVerseContentItemSchema),
});

const RawChapterContentItemSchema = z.discriminatedUnion("type", [
  RawVerseSchema,
  z.object({ type: z.literal("heading"), content: z.array(z.string()) }),
  z.object({ type: z.literal("line_break") }),
]);

const RawChapterResponseSchema = z.object({
  translation: z.object({ id: z.string() }),
  book: z.object({ id: z.string() }),
  chapter: z.object({
    number: z.number(),
    content: z.array(RawChapterContentItemSchema),
  }),
});

// Adapter — preferred form per R2 (no class):
export function createHelloAoBibleRepository(): BibleRepository {
  return {
    async getChapter(translationId, book, chapter) {
      try {
        const url =
          `https://bible.helloao.org/api/${translationId}/${book}/${chapter}.json`;
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 404) {
            return { ok: false, error: { kind: "chapter_not_found", chapter } };
          }
          return {
            ok: false,
            error: { kind: "network", message: `HTTP ${res.status}` },
          };
        }
        const json = await res.json();
        const parsed = RawChapterResponseSchema.safeParse(json);
        if (!parsed.success) {
          return {
            ok: false,
            error: { kind: "schema_mismatch", details: parsed.error.message },
          };
        }
        const verses: Verse[] = parsed.data.chapter.content
          .filter((item): item is z.infer<typeof RawVerseSchema> =>
            item.type === "verse")
          .map((v) => ({ number: v.number, text: toVerseText(v.content) }));
        return {
          ok: true,
          value: { translationId, book, chapter, verses },
        };
      } catch (err) {
        return {
          ok: false,
          error: { kind: "network", message: String(err) },
        };
      }
    },
  };
}

// Helper, also in src/api/ (footnote-strip; Option A from exploration)
function toVerseText(items: Array<string | { noteId: number }>): string {
  return items
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .trim();
}
```

Decisions:
- R2: prefer `createHelloAoBibleRepository(): BibleRepository` factory over `class HelloAoBibleRepository implements BibleRepository`.
- R12: `getChapter` never throws — fetch errors and JSON errors are caught and converted to `RepoError`.
- R7: the `z.infer<typeof RawVerseSchema>` cast is in `src/api/` only — Rule 7 explicitly permits Zod-derived types inside the api layer.
- The `try/catch` boundary is the only `try/catch` in the codebase; everything else is `Result`-based control flow.

## CLI driver — `src/cli/run.ts` (sketch)

```ts
export async function run(argv: string[]): Promise<number> {
  // 1. Collect positional tokens via Bun's parseArgs (proposal-locked).
  const { positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
  });
  const input = positionals.join(" ").trim();

  // 2. Parse → ParseError → exit 2.
  const refResult = parseReference(input);
  if (!refResult.ok) {
    process.stderr.write(renderParseError(refResult.error) + "\n");
    return 2;
  }

  // 3. Use case → propagate Result.
  const repo = createHelloAoBibleRepository();
  const passageResult = await getPassage(repo, refResult.value);

  // 4. Render Passage to stdout (exit 0) or RepoError to stderr (exit 1).
  if (!passageResult.ok) {
    // ParseError can't reach here (already short-circuited). Narrow to RepoError.
    const err = passageResult.error as RepoError;
    process.stderr.write(renderRepoError(err) + "\n");
    return 1;
  }
  process.stdout.write(renderPassage(passageResult.value) + "\n");
  return 0;
}
```

Decisions:
- Formatters (`renderParseError`, `renderRepoError`, `renderPassage`) live in `src/cli/render.ts`. Resolves Q3 in proposal: formatting is presentation, not domain. R5 only mandates the *shape* of error unions — the *string* representation is a CLI concern (and a TUI would render the same `ParseError` differently).
- Exit-code contract owned exclusively here: `0` happy, `1` repo error, `2` parse error.
- The `as RepoError` narrowing is acceptable because we already returned on the `ParseError` branch above. Apply phase can replace it with a runtime narrowing helper if reviewer prefers.

## Entry — `src/index.tsx`

```ts
import { run } from "./cli/run";
const exitCode = await run(Bun.argv.slice(2));
process.exit(exitCode);
```

For this slice, all argv routes to CLI mode. Architecture.md describes a TUI branch (`verbum` with no args → TUI); that branch is a v1 follow-up slice. The entry stays thin so adding a TUI mode later is one if-statement.

## File map

| Path | Responsibility | Layer |
|---|---|---|
| `src/domain/result.ts` | `Result<T, E>` discriminated union (R1, R5) | domain |
| `src/domain/book-id.ts` | `BookId` brand + `makeBookId` factory + canonical USFM map (R6) | domain |
| `src/domain/translations.ts` | `TranslationId` brand + `DEFAULT_TRANSLATION_ID = "BSB"` (R6) | domain |
| `src/domain/reference.ts` | `Reference`, `VerseRange`, `parseReference` | domain |
| `src/domain/passage.ts` | `Verse`, `Chapter`, `Passage` types | domain |
| `src/domain/errors.ts` | `ParseError`, `RepoError`, `AppError` (R5) | domain |
| `src/application/ports/bible-repository.ts` | `BibleRepository` interface (R3) | application |
| `src/application/get-passage.ts` | `getPassage(repo, ref)` use case (R12) | application |
| `src/api/schemas.ts` | All Zod schemas; never imported outside `src/api/` (R4) | api |
| `src/api/hello-ao-bible-repository.ts` | `createHelloAoBibleRepository()` factory implementing the port | api |
| `src/api/__fixtures__/john-3-bsb.json` | Recorded fixture for the smoke test (Q6) | api |
| `src/cli/run.ts` | argv → use case → exit code | cli |
| `src/cli/render.ts` | `renderParseError`, `renderRepoError`, `renderPassage` formatters | cli |
| `src/index.tsx` | Entry — calls `run(Bun.argv.slice(2))` and exits | entry |
| `tests/smoke.test.ts` | End-to-end smoke test using a stub repo backed by the fixture | tests |

Total: 15 files (proposal estimated 13 — added `translations.ts` and `passage.ts` after splitting type homes for clarity).

## Data flow diagram

```
argv: ["john", "3:16"]
  │
  ▼
src/index.tsx                          (entry)
  │  Bun.argv.slice(2) → run(argv)
  ▼
src/cli/run.ts                         (presentation driver)
  │  positionals.join(" ") = "john 3:16"
  ▼
src/domain/reference.ts                (pure domain)
  │  parseReference("john 3:16")
  │    → Result<Reference, ParseError>
  │  Reference = { book: "JHN", chapter: 3, verses: { start: 16, end: 16 } }
  ▼
src/application/get-passage.ts         (use case)
  │  getPassage(repo, ref)
  ▼
src/application/ports/bible-repository.ts   (port)
  │  repo.getChapter("BSB", "JHN", 3)
  ▼
src/api/hello-ao-bible-repository.ts   (driven adapter)
  │  fetch https://bible.helloao.org/api/BSB/JHN/3.json
  │    → Zod parse (RawChapterResponseSchema)
  │    → filter type==="verse"
  │    → toVerseText() flattens content[]
  │  Chapter = { translationId, book, chapter, verses: Verse[] }
  ▲
  │ Result<Chapter, RepoError>
src/application/get-passage.ts         (slice + wrap)
  │  filter verses where v.number ∈ [16, 16]
  │  Passage = { reference, verses: [{ number: 16, text: "For God..." }] }
  ▲
  │ Result<Passage, AppError>
src/cli/run.ts                         (render + exit)
  │  renderPassage(passage) → stdout
  ▼
exit 0
```

## Test strategy (high level — tasks phase has the breakdown)

- **Domain unit tests** — colocated as `src/domain/foo.test.ts`. Cover `parseReference` happy + sad paths, `makeBookId` canonical+rejection, `Result` doesn't need its own test.
- **Application unit tests** — `src/application/get-passage.test.ts` with an inline stub `BibleRepository` (one that returns a hardcoded `Chapter`). Covers the slice logic and the empty-slice → `verse_not_found` path.
- **Adapter unit tests** — `src/api/hello-ao-bible-repository.test.ts`. Loads `__fixtures__/john-3-bsb.json`, stubs `fetch` (Bun supports `Bun.spyOn` or a plain monkeypatch), asserts the mapped `Chapter`.
- **Smoke test** — `tests/smoke.test.ts` wires a fixture-backed `BibleRepository` into `getPassage` and asserts the rendered string contains "loved". This test does NOT use the real HTTP adapter — that is what the CI compiled-binary step is for.
- **CI compiled-binary check** — see CI step below; the only place a real `fetch` happens in automated tests.

## CI step (rough — `.github/workflows/ci.yml`)

```yaml
- run: bun install
- run: bun test
- run: bun build --compile src/index.tsx --outfile ./verbum
- run: ./verbum john 3:16 | grep -i "loved"
- run: |
    set +e
    ./verbum xyzzy 99:99
    [ $? -eq 2 ]
```

The compiled-binary step is the only place real HTTP happens in CI. If helloao is down, this step fails — accepted risk; alternative is mocking, which defeats the purpose of compiling.

## Risks / unknowns surfaced during design

- **Empty-slice classification** — resolved as `RepoError.verse_not_found` (Q-bonus). If v2 adds richer verse-range UX, promote to a dedicated `RangeError` then.
- **R2 friction with `class implements BibleRepository`** — resolved by preferring the factory form `createHelloAoBibleRepository()`. The class form is sketched only for readers who'd otherwise reach for it.
- **`as RepoError` narrowing in `src/cli/run.ts`** — minor type smell. Apply phase can replace with a `narrowToRepoError(err: AppError): err is RepoError` helper if reviewer prefers. Not a R6 violation (R6 is about *brand* casts in the domain).
- **Schema rejection on unknown content `type`** — `z.discriminatedUnion("type", ...)` rejects `{ type: "poetry" }` if helloao adds it. Acceptable for this spike (proposal locked); spec/design of the next slice should add a `passthrough` or `catchall` strategy.
- **Bun `parseArgs` + compiled binary** — proposal flagged this; the CI compiled-binary step catches any divergence. No action in design.
- **Domain constants tested via the type system, not unit tests** — `DEFAULT_TRANSLATION_ID = makeTranslationId("BSB")` has no behavioral test. It's a one-line constant; if it were `makeBookId("BSB")` (wrong factory) the type system catches it. Acceptable.

## Architectural decisions log (ADR-style)

### ADR-DESIGN-1 — Slicing in the use case, not the adapter

**Context:** API returns whole chapters. User wants a single verse.
**Decision:** Slice in `getPassage` (application), not `getChapter` (api).
**Rationale:** Adapter port signature only takes `(translationId, book, chapter)` per R3 — no `Reference`. Adapter literally cannot slice without violating the port shape. Pushing slicing to the use case keeps the adapter dumb, makes the domain `Reference` the single source of truth for "what does the user want", and matches the architecture.md description of `Passage` as an aggregate distinct from raw chapter data.
**Rejected:** "Adapter takes a `Reference` and returns a `Passage` directly." Violates R3 (port args should be primitives, not domain aggregates the adapter doesn't need).

### ADR-DESIGN-2 — Empty-slice → `RepoError.verse_not_found`

**Context:** `john 3:99` parses cleanly but the chapter has no verse 99.
**Decision:** `getPassage` returns `{ ok: false, error: { kind: "verse_not_found" } }`. CLI exits `1`.
**Rationale:** Simplest variant addition. Avoids a third top-level error union (`RangeError`) for one v1 case. Semantically defensible — "the repo couldn't satisfy your request."
**Rejected:**
- Add a `RangeError` union returned by the use case. Cleaner conceptually but YAGNI for v1.
- Push to `ParseError.out_of_range`. Wrong layer — parser doesn't know chapter lengths.

### ADR-DESIGN-3 — Formatters in CLI, not domain

**Context:** R5 example puts `format(err: ParseError)` in domain. Where does v1 put rendering?
**Decision:** `renderParseError`, `renderRepoError`, `renderPassage` all live in `src/cli/render.ts`.
**Rationale:** Formatting is presentation. The TUI will render the same `ParseError` with colors, layout, line wrapping. Domain functions returning strings are a layering smell. R5 mandates the union *shape*, not the formatting *location*.
**Rejected:** Domain-level formatter — would force the TUI to either reuse CLI strings (wrong) or duplicate the `kind` switch (also wrong; better to have one switch per presentation).

### ADR-DESIGN-4 — Fixture at `src/api/__fixtures__/`

**Context:** Q6 from proposal.
**Decision:** `src/api/__fixtures__/john-3-bsb.json`.
**Rationale:** Colocates fixture with consumer. React/Jest convention. Maps to `internal/api/testdata/` on Go port.
**Rejected:** `tests/fixtures/` (splits fixture from consumer). `src/api/__tests__/fixtures/` (no `__tests__` dir in v1 since unit tests are colocated as `*.test.ts`).

### ADR-DESIGN-5 — `createHelloAoBibleRepository()` factory over `class HelloAoBibleRepository`

**Context:** R2 forbids `class` outside React components.
**Decision:** Export a factory function returning an object literal that satisfies `BibleRepository`.
**Rationale:** R2 specifically calls out repositories as "functions or plain object factories". Factory form has no `this`, no constructor ceremony, ports cleanly to Go (`func NewHelloAoBibleRepository() BibleRepository`).
**Rejected:** `class HelloAoBibleRepository implements BibleRepository` — would technically work but violates R2 in a slice that exists specifically to validate house rules.

### ADR-DESIGN-6 — `DEFAULT_TRANSLATION_ID` in domain, not CLI

**Context:** Q1 from proposal — where does `"BSB"` live?
**Decision:** `src/domain/translations.ts` exports `DEFAULT_TRANSLATION_ID: TranslationId = makeTranslationId("BSB")`.
**Rationale:** "Which translation does the user get when they don't specify?" is a domain concept (what reading is). The CLI just consumes it. Future TUI consumes the same constant. If v1 later adds a `--translation` flag, the CLI overrides this default — the constant doesn't move.
**Rejected:** Hardcoded literal in `src/cli/run.ts`. Defensible for a spike but creates a refactor moment when the second consumer (TUI) appears.
