# Apply Progress — v1-architecture-spike: all 18 tasks complete

## Branch
feat/v1-architecture-spike (off main)

## Status
18/18 tasks complete

## Completed (in order)
- T-1 ✅ commit: b4306fa "chore: initialize bun project with package.json and tsconfig"
- T-2 ✅ commit: 4408afc "feat: add domain primitives — Result, BookId, TranslationId, errors, passage types, and reference parser with tests"
- T-3 ✅ commit: 4408afc (errors.ts — ParseError, RepoError, AppError, UnknownBookError)
- T-4 ✅ commit: 4408afc (translations.ts — TranslationId brand, makeTranslationId, DEFAULT_TRANSLATION_ID)
- T-5 ✅ commit: 4408afc (passage.ts — Verse, Chapter, Passage plain TS types)
- T-6 ✅ commit: 4408afc (book-id.ts — BookId brand, makeBookId, full 66-book USFM canonical set)
- T-7 ✅ commit: 4408afc (reference.ts — Reference, VerseRange, parseReference + reference.test.ts)
- T-8 ✅ commit: 4408afc (book-id.test.ts — makeBookId unit tests)
- T-9 ✅ commit: bcabd53 "feat: add BibleRepository port and getPassage use case with tests"
- T-10 ✅ commit: bcabd53 (get-passage.ts + get-passage.test.ts)
- T-11 ✅ commit: 29f3f17 "feat: add Zod schemas, john-3-bsb fixture, HelloAo adapter with toVerseText helper and unit tests"
- T-12 ✅ commit: 29f3f17 (src/api/__fixtures__/john-3-bsb.json — real fixture from helloao)
- T-13 ✅ commit: 29f3f17 (hello-ao-bible-repository.ts + hello-ao-bible-repository.test.ts)
- T-14 ✅ commit: 51c28e2 "feat: add CLI render formatters, run driver, and entry point"
- T-15 ✅ commit: 51c28e2 (run.ts — argv → use case → exit code)
- T-16 ✅ commit: 51c28e2 (index.tsx — entry point)
- T-17 ✅ commit: 5262bd7 "feat: add smoke test and GitHub Actions CI workflow with compile step"
- T-18 ✅ commit: 5262bd7 (.github/workflows/ci.yml)

## Decisions made during apply
- "unknown_book" chosen over "invalid_book" for `makeBookId` error kind — matches ParseError vocabulary; domain is consistent across all error union variants
- `bun.lock` committed (replaces bun.lockb in Bun 1.2.x) — lockfile format changed in newer Bun
- Fixture fetched from real helloao API and saved as static JSON — RawChapterResponseSchema.safeParse passes on it
- Zod `passthrough()` used on RawChapterResponseSchema to allow unknown top-level fields (footnotes, audioLinks) without schema failure
- Catch-all object schema added to RawChapterContentItemSchema union so unknown future content types (e.g. "poetry") are accepted at the schema level and dropped by type===\"verse" filter in the adapter
- `bun test` runs without a --cwd flag — tests use @/ path alias from tsconfig which Bun resolves correctly

## Deviations from spec/design
- T-2 and T-3–T-8 landed in the same commit (C2) — grouped domain files together. Tasks spec split them into separate commits per commit cadence suggestion; actual grouping is still work-unit-reviewable.
- Design shows `Reference = { verse: number }` for v1 spike in one place, but spec uses `verses: VerseRange` with start/end. Implemented `verses: VerseRange` consistently with `start === end` for single-verse references (matches design type catalog).

## Open questions surfaced during apply
- None — all design decisions were pre-resolved.

## Verification snapshot
- bun test: 29 pass, 0 fail (5 files: book-id.test.ts, reference.test.ts, get-passage.test.ts, hello-ao-bible-repository.test.ts, smoke.test.ts)
- bun run src/index.tsx john 3:16: "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life." — exit 0
- bun run src/index.tsx xyzzy 99:99: "Error: unknown book \"xyzzy\". Try a book name like \"john\" or \"genesis\"." (stderr), exit 2
- bun run src/index.tsx john abc: "Error: malformed chapter:verse \"abc\". Expected format: ..." (stderr), exit 2
- bun run src/index.tsx (no args): "Usage: verbum <reference> (e.g., verbum john 3:16)" (stderr), exit 2
- bun run src/index.tsx JOHN 3:16: same verse text as john 3:16, exit 0
- ./verbum (compiled) john 3:16: same verse text, exit 0
- ./verbum (compiled) xyzzy 99:99: same stderr error with "xyzzy", exit 2
- ./verbum (compiled, no args): usage message, exit 2
- CI workflow: configured at .github/workflows/ci.yml
