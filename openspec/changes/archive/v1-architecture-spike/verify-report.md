# Verify — v1-architecture-spike: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 2 SUGGESTION)

## TL;DR
PASS WITH WARNINGS. All 6 acceptance scenarios pass independently. 29/29 tests pass. Zero CRITICAL findings. Three WARNINGs: a `.parse()` call inside the adapter (spec mandates `safeParse`), raw `"BSB"` literals in test files (REQ-3 border case), and CI smoke step hitting real HTTP (design-acknowledged flakiness risk). Two SUGGESTIONs: CI step has a fragile `$?` check and `z.union` was used instead of the spec-mandated `z.discriminatedUnion`.

## Counts
- CRITICAL: 0
- WARNING: 3
- SUGGESTION: 2

## Scenario reproduction (independently re-run)

| SCN | Command | Exit | Stdout (first 80 chars) | Stderr | PASS/FAIL |
|-----|---------|------|------------------------|--------|-----------|
| SCN-1 | `bun run src/index.tsx john 3:16` | 0 | "For God so loved the world that He gave His one and only Son..." | empty | PASS |
| SCN-2 | `./verbum john 3:16` (compiled) | 0 | "For God so loved the world that He gave His one and only Son..." | empty | PASS |
| SCN-3 | `bun run src/index.tsx xyzzy 99:99` | 2 | empty | `Error: unknown book "xyzzy". Try a book name like "john" or "genesis".` | PASS |
| SCN-4 | `bun run src/index.tsx john abc` | 2 | empty | `Error: malformed chapter:verse "abc". Expected format: <book> <chapter>:<verse>` | PASS |
| SCN-5 | `bun run src/index.tsx` | 2 | empty | `Usage: verbum <reference> (e.g., verbum john 3:16)` | PASS |
| SCN-6 | `bun run src/index.tsx JOHN 3:16` | 0 | "For God so loved the world..." | empty | PASS |
| SCN-7 | `bun build --compile` exits 0; `./verbum john 3:16` exits 0 with "loved"; `./verbum xyzzy 99:99` exits 2 | — | — | — | PASS |
| bun test | 29 pass, 0 fail, 5 files | — | — | — | PASS (matches claim) |

## File structure check

Design specified 15 files. All present. No extra files outside the design.

| Design path | Found | Notes |
|-------------|-------|-------|
| src/domain/result.ts | ✅ | |
| src/domain/book-id.ts | ✅ | |
| src/domain/translations.ts | ✅ | |
| src/domain/reference.ts | ✅ | |
| src/domain/passage.ts | ✅ | |
| src/domain/errors.ts | ✅ | |
| src/application/ports/bible-repository.ts | ✅ | |
| src/application/get-passage.ts | ✅ | |
| src/api/schemas.ts | ✅ | |
| src/api/hello-ao-bible-repository.ts | ✅ | |
| src/api/__fixtures__/john-3-bsb.json | ✅ | |
| src/cli/run.ts | ✅ | |
| src/cli/render.ts | ✅ | |
| src/index.tsx | ✅ | |
| tests/smoke.test.ts | ✅ | |
| .github/workflows/ci.yml | ✅ | bonus (T-18) |
| Test colocates (*.test.ts) | ✅ | 4 additional test files, all within their layers |

## House rules audit

| Rule | Finding | File:line |
|------|---------|-----------|
| R1 — no throw in domain | PASS — zero `throw` in src/domain/ | — |
| R3 — port args no callbacks | PASS — `getChapter(translationId, book, chapter)` primitives/brands only | src/application/ports/bible-repository.ts |
| R4 — Zod only in src/api/ | PASS — only import is schemas.ts:6 | src/api/schemas.ts:6 |
| R5 — discriminated unions | PASS — all error types use `kind`, exhaustive switches with `never` fallthrough | src/cli/render.ts:20-26, 43-47 |
| R6 — brand casts inside factories only | PASS — `as BookId` only in book-id.ts:34, `as TranslationId` only in translations.ts:10 | |
| R7 — no conditional/mapped types in domain/application | PASS — none found | — |
| R11 — no decorators | PASS — no `@` decorator usage | — |
| R12 — async data functions return Promise<Result<T,E>> | PASS (with note) — `run()` returns `Promise<number>` which is acceptable (not data, it's an exit code; R12 exception applies) | src/cli/run.ts:16 |

## Apply-progress reconciliation

| Claim | Verified | Notes |
|-------|---------|-------|
| 6 commits landed | ✅ | b4306fa, 4408afc, bcabd53, 29f3f17, 51c28e2, 5262bd7 |
| Conventional commits, no AI attribution | ✅ | All `feat:` / `chore:` / `docs:`, no Co-Authored-By |
| 29 tests pass | ✅ | Independently reproduced: 29 pass, 0 fail |
| `unknown_book` decision in code | ✅ | src/domain/book-id.ts:32, src/domain/errors.ts:5 |
| `as RepoError` cast in run.ts | ✅ | src/cli/run.ts:37 — present and documented |
| SCN-1 stdout "For God so loved…" | ✅ | Reproduced live |
| SCN-3 stderr names "xyzzy", exit 2 | ✅ | Reproduced live |
| SCN-4 malformed message, exit 2 | ✅ | Reproduced live |
| SCN-5 usage message, exit 2 | ✅ | Reproduced live |
| SCN-6 JOHN 3:16 case-insensitive | ✅ | Reproduced live |
| Compiled binary all SCNs | ✅ | Reproduced live |

## Spec requirements coverage

| REQ | Satisfied by | PASS/FAIL |
|-----|-------------|-----------
| REQ-1 Result<T,E> | src/domain/result.ts | PASS |
| REQ-2 BookId brand+factory | src/domain/book-id.ts | PASS |
| REQ-3 TranslationId + DEFAULT_TRANSLATION_ID | src/domain/translations.ts | PASS (WARNING: test files use raw "BSB" literal) |
| REQ-4 ParseError union | src/domain/errors.ts:7-11 | PASS (out_of_range present despite design memo saying omit) |
| REQ-5 parseReference | src/domain/reference.ts:163 | PASS |
| REQ-6 BibleRepository port | src/application/ports/bible-repository.ts | PASS |
| REQ-7 Zod schemas | src/api/schemas.ts (WARNING: z.union not z.discriminatedUnion) | WARNING |
| REQ-8 toVerseText | src/api/hello-ao-bible-repository.ts:14 | PASS |
| REQ-9 HelloAoBibleRepository adapter | src/api/hello-ao-bible-repository.ts (WARNING: .parse() on line 68) | WARNING |
| REQ-10 getPassage use case | src/application/get-passage.ts | PASS |
| REQ-11 CLI driver | src/cli/run.ts + src/cli/render.ts (never fallthrough present) | PASS |
| REQ-12 Entry point | src/index.tsx (SCN-5 short-circuit confirmed) | PASS |
| REQ-13 Smoke test | tests/smoke.test.ts (no real HTTP) | PASS |
| REQ-14 Compiled binary CI | .github/workflows/ci.yml | PASS |

## Findings

### CRITICAL
None.

### WARNING

**W-1 — REQ-9 violated: `RawVerseSchema.parse(item)` in adapter (src/api/hello-ao-bible-repository.ts:68)**
Spec REQ-9 says "MUST parse the raw response with Zod schemas via `safeParse` — never `parse` (throws)." The adapter uses `safeParse` correctly for the main response (line 48) and for the filter (line 63), but then calls `RawVerseSchema.parse(item)` in the `.map()` at line 68. While in practice it cannot throw because the filter above guarantees validity, the spec is explicit. It is a review-blocker per the spec contract.

**W-2 — REQ-3 border case: raw `"BSB"` literal in test files**
REQ-3 says "Raw string literals `"BSB"` MUST NOT appear anywhere outside `src/domain/translations.ts`." Two test files use `makeTranslationId("BSB")` directly: `src/api/hello-ao-bible-repository.test.ts:8` and `src/application/get-passage.test.ts:22`. These use the factory (R6 satisfied), but the `"BSB"` literal itself is present outside `translations.ts`. Tests are a gray area — they can't use `DEFAULT_TRANSLATION_ID` everywhere since they sometimes need a specific translation for setup — but it's a nominal spec deviation. User decides whether to enforce this in tests.

**W-3 — CI smoke depends on live HTTP (design-acknowledged risk)**
`.github/workflows/ci.yml:32-36` — the happy-path binary smoke step calls `./verbum john 3:16` which makes a real network request to `bible.helloao.org`. If the API is down, CI fails for a non-code reason. This risk was explicitly accepted in the design and proposal, but it's a real flakiness source.

### SUGGESTION

**S-1 — REQ-7: `z.union` used instead of spec-mandated `z.discriminatedUnion`**
`src/api/schemas.ts:36` uses `z.union([...])` for `RawChapterContentItemSchema`. Spec REQ-7 says "MUST use `z.discriminatedUnion("type", [...])` for `chapter.content[]` items". Apply switched to `z.union` to accommodate the catch-all passthrough object (a valid tradeoff). The schema behavior is equivalent for all known types. Not a bug, but a literal spec deviation.

**S-2 — CI xyzzy check uses fragile `$?` idiom (ci.yml:40)**
`./verbum xyzzy 99:99 && exit 1 || [ $? -eq 2 ]` is correct but opaque. `set -e` in some CI runners can interact unexpectedly. Simpler alternative: `./verbum xyzzy 99:99; [ $? -eq 2 ]` or use `expected_exit=2` with an explicit comparison.

## Recommended next step
`sdd-archive` — all CRITICAL count is zero, all scenarios pass, all house rules hold. User should decide whether to fix W-1 (`.parse()` call) before archiving — it is a real spec violation — or document it as a known deviation. W-2 and W-3 are judgment calls.
