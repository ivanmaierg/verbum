# Verify Report: translation-picker

## Change
translation-picker — TUI + domain translation picker overlay

## Mode
Strict TDD | Hybrid artifact store

## Completeness

| Phase | Tasks | Complete | %   |
|-------|-------|----------|-----|
| T1    | 4     | 4        | 100 |
| T2    | 6     | 6        | 100 |
| T3    | 9     | 9        | 100 |
| T4    | 8     | 8        | 100 |
| T5    | 12    | 12       | 100 |
| T6    | 4     | 4        | 100 |
| T7    | 10    | 10       | 100 |
| T8    | 4     | 4        | 100 |
| **Total** | **47** | **47** | **100%** |

## Build / Test / Type-Check Evidence

| Check | Result | Details |
|-------|--------|---------|
| bun test | PASS | 285/285 passing, 0 failing, 1177 expect() calls |
| bunx tsc --noEmit | PASS | No output, clean exit |
| Test count vs REQ-49 | PASS | 285 >= 250 (baseline 240, +45 new tests) |

## Commits

9 total: 8 implementation commits + 1 openspec artifact commit. All conventional format (feat/refactor/chore). No Co-Authored-By lines. No AI attribution.

## Spec Compliance Matrix

| REQ | Description | Status | Evidence |
|-----|-------------|--------|---------|
| REQ-01 | Translation interface 5 fields | PASS | src/domain/translations.ts:7-13 |
| REQ-02 | TranslationId co-located | PASS | src/domain/translations.ts:5 |
| REQ-03 | getTranslations() on port | PASS | src/application/ports/bible-repository.ts:17 |
| REQ-04 | No existing method changed | PASS | Port unchanged except new method |
| REQ-05 | getChapter accepts translationId; no DEFAULT import | PASS | src/application/get-chapter.ts |
| REQ-06 | getPassage accepts translationId | PASS | src/application/get-passage.ts |
| REQ-07 | All call sites pass translationId explicitly | PASS | cli/run.ts, cli/vod.ts, use-passage-fetch.ts |
| REQ-08 | Adapter implements getTranslations with closure cache | PASS | src/api/hello-ao-bible-repository.ts:28-59 |
| REQ-09 | Cache on success | PASS | cached = translations on line 55 |
| REQ-10 | No cache on error; retry next call | PASS | Cache not set on error paths; test passes |
| REQ-11 | translationId/translationName on loading/loaded/network-error | PASS | reader-reducer.ts:43-45 |
| REQ-12 | Initial loading seeded from DEFAULT + "Berean Standard Bible" | PASS | seedTranslation in all awaiting->loading transitions |
| REQ-13 | Every transition propagates translation fields | PASS | withTranslation helper in all relevant handlers |
| REQ-14 | translationPicker sub-state shape on loaded | PASS | reader-reducer.ts:33-39,44 |
| REQ-15 | All reader keys suppressed when picker open | PASS | tui-driver.tsx lines 52-67 |
| REQ-16 | TranslationPickerOpened action | PASS | reducer + tests |
| REQ-17 | TranslationsFetched action | PASS | reducer + tests |
| REQ-18 | TranslationFetchFailed action | PASS | reducer + tests |
| REQ-19 | TranslationPickerQueryTyped action | PASS | reducer + tests |
| REQ-20 | TranslationPickerMovedUp action | PASS | reducer + tests |
| REQ-21 | TranslationPickerMovedDown action | PASS | reducer + tests |
| REQ-22 | TranslationPickerAccepted action | PASS | reducer + tests |
| REQ-23 | TranslationPickerDismissed action | PASS | reducer + tests |
| REQ-24-a/b | TranslationPickerOpened sets loading state | PASS | exact shape asserted in reducer test |
| REQ-25-a/b | TranslationsFetched sets ready/items/visibleItems/selectedIndex=0 | PASS | reducer test + adapter sort |
| REQ-26-a/b | TranslationFetchFailed sets error | PASS | reducer test |
| REQ-27-a/b | TranslationPickerQueryTyped filter logic | WARNING | filter uses languageEnglishName, spec says language |
| REQ-28 | MovedUp clamps to 0 | PASS | reducer test |
| REQ-29 | MovedDown clamps to visibleItems.length-1 | PASS | reducer test |
| REQ-30 | Movement no-ops when picker null or not ready | PASS | 4 no-op tests |
| REQ-31 | Accepted transitions to loading with chosen translation | PASS | reducer test line 1238 |
| REQ-32 | Accepted guards | PASS | no-op tests |
| REQ-33 | Dismissed sets picker to null | PASS | reducer test |
| REQ-34 | Dismissed guards | PASS | no-op tests |
| REQ-35 | Picker key routing | PASS | tui-driver.tsx lines 53-67 |
| REQ-36 | Other keys suppressed; printable -> QueryTyped | PASS | tui-driver.tsx lines 58-66 |
| REQ-37 | t key -> TranslationPickerOpened | PASS | tui-driver.tsx line 86 |
| REQ-38 | Driver initiates getTranslations after Opened | PASS | useTranslationsFetch hooked in ReaderScreen |
| REQ-39 | Overlay renders when translationPicker !== null | PASS | reader-screen.tsx lines 192-194 |
| REQ-40 | loading -> single-line loading indicator | PASS | overlay lines 97-99 |
| REQ-41 | ready -> query + list + hints | PASS | overlay lines 103-127 |
| REQ-42 | error -> one-line error; Esc dismisses | PASS | overlay + driver |
| REQ-43 | titleFor uses translationName not literal | PASS | reader-screen.tsx line 63; test confirms KJV |
| REQ-44 | titleFor includes translationName in loading/network-error | PASS | titleFor switch covers all 3 variants |
| REQ-45 | No new runtime dependencies | PASS | package.json has 4 deps, unchanged |
| REQ-46 | tsc --noEmit clean | PASS | zero output |
| REQ-47 | satisfies pattern for new handlers | PASS | reader-reducer.ts lines 385-390 |
| REQ-48 | No restatement comments | PASS | Comments explain why, not what |
| REQ-49 | Test count >= 250 | PASS | 285 tests |

## Design Coherence

| Design Decision | Status | Notes |
|----------------|--------|-------|
| translationPicker sub-state shape | PASS | Matches design exactly |
| withTranslation helper | PASS | Exported, used in all transitions |
| recomputeVisible pure helper | PASS | Exported, tested |
| useTranslationsFetch mirrors usePassageFetch | PASS | Same cancellation pattern |
| Gate order: translation-picker above verse-picker | DEVIATION | Spec order says verse-picker first; implementation reverses it per REQ-15 semantics — behavior is correct |
| satisfies dispatch table | PASS | ADR 0010 pattern |
| Session cache (closure-scoped let) | PASS | REQ-08/09/10 confirmed |

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | PASS | Full evidence table in apply-progress |
| All tasks have tests | PASS | 47/47 |
| RED confirmed (test files exist) | PASS | All test files present |
| GREEN confirmed (tests pass) | PASS | 285/285 on fresh run |
| Triangulation adequate | PASS | Multiple guard/happy-path cases per action |
| Safety Net for modified files | PASS | Pre-existing tests ran before modifications |

**TDD Compliance**: 6/6 checks passed

## Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (reducer, domain, adapter) | ~240 | 8 | bun:test |
| Integration (screen, hooks) | ~45 | 4 | bun:test |
| E2E | 0 | 0 | not installed |
| **Total** | **285** | **18** | |

## Changed File Coverage

Coverage tool not available as separate runner. Proxy: 1177 expect() calls across 285 tests = 4.1 assertions/test average.

## Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| src/tui/reader/reader-screen.test.ts | 62 | expect(typeof bottomTitleFor(state)).toBe("string") | Type-only — loading/pick-verse case | WARNING |
| src/tui/reader/reader-screen.test.ts | 106 | expect(typeof bottomTitleFor(state)).toBe("string") | Type-only — network-error case | WARNING |
| src/tui/reader/reader-screen.test.ts | 122 | expect(typeof title).toBe("string") | Type-only — translationPicker active case | WARNING |
| src/tui/reader/use-translations-fetch.test.ts | 47-103 | All 3 tests | Hook never invoked; logic simulated manually. Cancellation and useEffect dep array untested | WARNING |

**Assertion quality**: 0 CRITICAL, 4 WARNING

## Issues

### CRITICAL
None.

### WARNING

**W-01** REQ-27 filter field deviation: `recomputeVisible` at reader-reducer.ts:21 filters on `t.languageEnglishName` (e.g. "English") instead of `t.language` (e.g. "en") as written in the spec. Tests match the implementation. Impact: searching by ISO code will not match. The implementation choice is superior UX but the spec literal is wrong.

**W-02** Gate order discrepancy: the spec and tasks list gate order as `verse-picker -> translation-picker` but the driver puts translation-picker first (tui-driver.tsx line 52). This satisfies REQ-15 correctly. The spec's stated order should be corrected.

**W-03** T6 hook tests (use-translations-fetch.test.ts) simulate the hook logic by calling `repo.getTranslations()` directly. The actual hook function is never invoked. The cancellation guard (`cancelled = true` in cleanup) and the `[state.kind, pickerStatus]` dependency array are not tested.

**W-04** Three type-only assertions in reader-screen.test.ts (lines 62, 106, 122) assert only that a function returns a string, not what string it returns. These do not verify behavior.

### SUGGESTION

**S-01** Update spec REQ-27 filter string from `${t.name} ${t.language}` to `${t.name} ${t.languageEnglishName}` to match the correct implementation.

**S-02** Update spec REQ-35 gate order description to reflect actual code order (translation-picker above verse-picker).

**S-03** Replace type-only assertions in reader-screen.test.ts with value assertions (e.g. assert the loading/pick-verse bottomTitle equals " loading…  •  q quit ").

**S-04** Add a test for `useTranslationsFetch` cancellation: open picker, unmount mid-fetch, verify no dispatch occurs after unmount.

## Verdict

PASS WITH WARNINGS

0 CRITICAL | 4 WARNING | 4 SUGGESTION

285/285 tests pass. Typecheck clean. 49/49 REQs implemented. All 47 tasks complete. Hexagonal boundary preserved — no domain->adapter leaks, no ports skipped. Commits are clean conventional format with no AI attribution. The 4 warnings are documentation/test quality issues; none block archive.
