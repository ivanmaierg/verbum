# Exploration — v1-architecture-spike

## TL;DR — Riskiest Unknown

**Risk A (helloao API shape) is the riskiest.** The verse `content` field is a mixed array of `string | { noteId: number }` — not a plain string — which means the architecture's implicit `Verse.text: string` domain type must be defined explicitly to handle inline footnote references before any code is written. Risk B (bun compile) is a non-risk: documented fully, fetch() works, no restrictions. Risk C (BookId format) is confirmed safe: IDs are exactly the 3-letter USFM codes the architecture assumes.

## Risk A — helloao API shape

| Probe | Result |
|---|---|
| BSB exists? | Yes — exact id = `"BSB"` |
| Chapter shape | Flat array at `chapter.content[]` with mixed types: `{ type: "verse", number: N, content: Array<string \| { noteId: number }> }` |
| Verse-range slicing | Client-side (confirmed by ADR 0004 — "no per-verse endpoint") |
| Top-level structure | `{ translation, book, chapter, footnotes, ... }` |

**Gotcha — verse content is NOT a plain string.** John 3:16 example:
```json
{
  "type": "verse",
  "number": 16,
  "content": [
    "For God so loved the world that He gave His one and only",
    { "noteId": 17 },
    "Son, that everyone who believes in Him shall not perish but have eternal life."
  ]
}
```

The `chapter.content` array also contains `{ type: "heading" }` and `{ type: "line_break" }` interleaved with verse objects — filtering by `type === "verse"` is required.

**Required domain model adjustment:** The house rules (Rule 4) show `Verse = { number: number; text: string }` as an example, but the real API requires a two-step parse: join string segments, skip noteId objects. The Zod schema in `src/api/` must handle the mixed array. The domain `Verse` type can remain `{ number: number; text: string }` as long as the adapter flattens the content array into a plain string during parsing. The adapter must:
1. Filter `chapter.content` for `type === "verse"` items
2. For each verse, join only the `string` elements of `verse.content` (skip `{ noteId }` objects)
3. Map to domain `Verse = { number: number; text: string }`

This is a design decision for the Zod schema shape in `HelloAoBibleRepository`. It is NOT a domain model change — the domain stays clean. But the Zod schema must explicitly model `content: z.array(z.union([z.string(), z.object({ noteId: z.number() })]))`

**Chapter-level footnotes:** The response has a top-level `footnotes` field (indexed by noteId). Out of scope for v1 but the schema should not discard it blindly.

## Risk B — bun build --compile

| Probe | Result |
|---|---|
| hello-world compiles? | Yes — documented, works for simple TS files |
| binary runs with argv? | Yes — `Bun.argv` works in compiled binaries |
| fetch() works in compiled? | Yes — "All built-in Bun and Node.js APIs are supported" (official docs) |
| Top-level await? | Supported |
| Dynamic imports? | Supported (with --splitting flag if needed) |
| Native deps? | N-API .node files can be embedded; no native deps expected in v1 |

**No blockers.** `bun build --compile` is production-grade for this use case. The only macOS gotcha: Gatekeeper warnings on unsigned binaries (fixable with `codesign`). Not a v1 concern for local dev. The compiled binary includes the full Bun runtime — fetch(), filesystem, all Node.js-compatible APIs work identically to `bun run`.

**Practical note:** `Bun.argv` vs `process.argv` — both work in compiled binaries. The entry point for CLI mode should slice `Bun.argv.slice(2)` (or `process.argv.slice(2)`) to skip the binary path.

## Risk C — BookId aliases

| Probe | Result |
|---|---|
| Books endpoint | `GET /api/BSB/books.json` — confirmed correct path |
| ID format | 3-letter USFM codes: `GEN`, `JHN`, `1CO` |
| Matches architecture.md assumption? | Yes — exact match |
| Sample IDs | Genesis=`GEN`, John=`JHN`, 1 Corinthians=`1CO` |

**No blockers.** The architecture's `BookId` brand (`"JHN"`, `"GEN"`, `"1CO"`) matches helloao's canonical IDs exactly. The `BookCatalog` alias map (`"john"` → `"JHN"`, `"1cor"` → `"1CO"`) only needs to handle user-facing input normalization — the API IDs are already what we need. There is NO translation layer needed between domain BookId and API book path segment.

## Proposed adjustments to architecture

**One adjustment required — Verse parsing in `src/api/`:**

The Zod schema for chapter content must handle the mixed array. Proposed type in `src/api/schemas.ts`:

```ts
// Raw API shape (Zod schema, stays in src/api/)
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

// Adapter flattening in HelloAoBibleRepository:
function toVerseText(content: Array<string | { noteId: number }>): string {
  return content
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .trim();
}
```

Domain `Verse = { number: number; text: string }` stays clean — no domain change.

**Architecture.md `BibleRepository.getChapter` port signature:** The current architecture shows `getChapter` but doesn't name the return type precisely. Recommend naming it `Chapter = { verses: Verse[]; translationId: TranslationId }` to make the adapter's job explicit. This is additive, not a correction.

## Recommended next decision

Before `sdd-propose` runs, one decision must be locked:

**How to handle footnote references in verse text for v1:**
- Option A (recommended): Strip `noteId` objects, join strings only → plain `text: string`. Footnotes are a v6+ concern. Zero domain complexity.
- Option B: Preserve footnotes inline → `text` becomes `Array<string | FootnoteRef>`. Domain gains complexity now; Go port becomes harder.
- Option C: Raise a `ParseWarning` alongside the `Verse` when noteId objects are present.

Instinct: Option A. v1 success criterion is `john 3:16` prints and exits 0 — footnote preservation is not in scope. Option A keeps the domain clean per Rule 4 and Rule 7.
