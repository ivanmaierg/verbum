# Tasks — v1-architecture-spike: ordered checklist

## TL;DR

18 tasks across 5 groups, ordered strictly inside-out: project surface → domain (pure types first, then the parser) → application port and use case → api adapter → cli driver + entry + smoke + CI. Every task bundles its test with the code that motivates it (work-unit-commits). **ALL 18 TASKS COMPLETE.**

---

## Review Workload Forecast

- Estimated changed lines: ~680
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes
- **Resolution: single-pr with size:exception — all 18 tasks land in one PR.**

---

## Pre-flight (project setup)

- [x] T-1: Initialize Bun project with `package.json` and `tsconfig.json`
- [x] T-2: Add `Result<T, E>` discriminated union in `src/domain/result.ts`

---

## Domain — pure types (no IO, no tests needed beyond type-check)

- [x] T-3: Add `ParseError`, `RepoError`, `AppError` discriminated unions in `src/domain/errors.ts`
- [x] T-4: Add `TranslationId` brand, `makeTranslationId` factory, and `DEFAULT_TRANSLATION_ID` constant in `src/domain/translations.ts`
- [x] T-5: Add `Verse`, `Chapter`, and `Passage` plain-TS types in `src/domain/passage.ts`
- [x] T-6: Add `BookId` brand, `makeBookId` factory, and full 66-book USFM canonical set in `src/domain/book-id.ts`

---

## Domain — parser (with tests)

- [x] T-7: Add `Reference`, `VerseRange` types and `parseReference` pure function in `src/domain/reference.ts`, plus colocated unit tests
- [x] T-8: Add colocated unit tests for `makeBookId` in `src/domain/book-id.test.ts`

---

## Application — port and use case

- [x] T-9: Add `BibleRepository` port interface in `src/application/ports/bible-repository.ts`
- [x] T-10: Add `getPassage` use case in `src/application/get-passage.ts`, plus colocated unit tests using an inline stub repository

---

## API adapter (Zod boundary)

- [x] T-11: Add Zod schemas for helloao chapter response in `src/api/schemas.ts`
- [x] T-12: Add recorded helloao fixture for John chapter 3 BSB at `src/api/__fixtures__/john-3-bsb.json`
- [x] T-13: Add `toVerseText` helper and `createHelloAoBibleRepository` factory in `src/api/hello-ao-bible-repository.ts`, plus colocated unit tests using the fixture and a stubbed `fetch`

---

## CLI driver and entry

- [x] T-14: Add `renderParseError`, `renderRepoError`, `renderPassage` formatters in `src/cli/render.ts`
- [x] T-15: Add `run(argv)` CLI driver in `src/cli/run.ts`
- [x] T-16: Add entry point `src/index.tsx` — positional-args → run() or usage error

---

## Smoke test and CI

- [x] T-17: Add end-to-end smoke test in `tests/smoke.test.ts` using a fixture-backed stub repository
- [x] T-18: Add GitHub Actions CI workflow in `.github/workflows/ci.yml`

---

## Definition of done — VERIFIED ✅

- [x] All REQ-1…REQ-14 have at least one task that satisfies them
- [x] All SCN-1…SCN-7 have a verifiable check (test or CI step)
- [x] `bun test` passes locally (29 pass, 0 fail across 5 files)
- [x] `bun run src/index.tsx john 3:16` → stdout contains verse text, exit 0, stderr empty (SCN-1)
- [x] `bun run src/index.tsx xyzzy 99:99` → stderr names "xyzzy", exit 2, stdout empty (SCN-3)
- [x] `bun run src/index.tsx john abc` → stderr mentions malformed chapter:verse, exit 2 (SCN-4)
- [x] `bun run src/index.tsx` (no args) → stderr contains usage message, exit 2, `parseReference` not called (SCN-5)
- [x] `bun run src/index.tsx JOHN 3:16` → stdout contains verse text, exit 0 (SCN-6)
- [x] `bun build --compile src/index.tsx --outfile ./verbum` exits 0; compiled binary passes all SCNs
- [x] CI workflow configured at .github/workflows/ci.yml (REQ-14)
- [x] No raw "BSB" literal outside `src/domain/translations.ts` (REQ-3)
- [x] No `as BookId` cast outside `makeBookId` (REQ-2, R6)
- [x] No Zod import outside `src/api/` (R4)
- [x] No `class` keyword in any file outside `src/tui/` (R2)
- [x] `renderParseError` has a `never` fallthrough (R5, REQ-11)
