# Apply Progress: translation-picker

## Status: COMPLETE

## Tasks Completed

All 47 tasks across phases T1–T8 completed.

## Commits (8)

1. `feat(domain): add Translation interface to translations.ts (REQ-01, REQ-02)`
2. `feat(port+adapter): add getTranslations to port and helloao adapter (REQ-03, REQ-08–REQ-10)`
3. `refactor(use-case): promote translationId as explicit parameter to getChapter and getPassage (REQ-05–REQ-07)`
4. `feat(state): add translationId + translationName to loading/loaded/network-error variants (REQ-11–REQ-13)`
5. `feat(state): translationPicker sub-state, recomputeVisible, and 8 new actions (REQ-14–REQ-34, REQ-47)`
6. `feat(tui): useTranslationsFetch hook mirrors usePassageFetch idiom (REQ-38)`
7. `feat(tui): translation picker overlay, titleFor with translationName, useTranslationsFetch wired (REQ-39–REQ-44)`
8. `feat(tui): translation picker key routing — t to open, gate above verse-picker (REQ-35–REQ-37)`

## Test Results

- 285 tests passing (up from 240 baseline)
- 0 failures
- `tsc --noEmit` clean

## Files Changed

- `src/domain/translations.ts` — Translation interface added
- `src/domain/translations.test.ts` — new
- `src/api/schemas.ts` — RawTranslationSchema + RawTranslationsResponseSchema
- `src/api/hello-ao-bible-repository.ts` — getTranslations with closure cache
- `src/api/hello-ao-bible-repository.test.ts` — getTranslations tests
- `src/application/ports/bible-repository.ts` — getTranslations port method
- `src/application/get-chapter.ts` — translationId explicit param
- `src/application/get-chapter.test.ts` — updated call sites
- `src/application/get-passage.ts` — translationId explicit param
- `src/application/get-passage.test.ts` — updated call sites
- `src/cli/run.ts` — pass DEFAULT_TRANSLATION_ID
- `src/cli/vod.ts` — pass DEFAULT_TRANSLATION_ID
- `src/tui/reader/reader-reducer.ts` — state types + 8 actions + handlers
- `src/tui/reader/reader-reducer.test.ts` — updated + 27 new tests
- `src/tui/reader/reader-screen.tsx` — titleFor exported, overlay component, hooks wired
- `src/tui/reader/reader-screen.test.ts` — updated + titleFor tests
- `src/tui/reader/use-passage-fetch.ts` — state.translationId
- `src/tui/reader/use-translations-fetch.ts` — new hook
- `src/tui/reader/use-translations-fetch.test.ts` — new
- `src/tui/tui-driver.tsx` — translation picker gate + t key
- `tests/smoke.test.ts` — getTranslations stub added
- `tests/vod-smoke.test.ts` — getTranslations stubs added

## Notes

- helloao API field `englishName` mapped to `languageEnglishName` at adapter boundary
- `textDirection` defaults to `"ltr"` in schema if missing (conservative)
- Gate order in driver: quit → welcome → awaiting → translation-picker → verse-picker → reader-nav
- T3.8 used `DEFAULT_TRANSLATION_ID` temporarily; T4.7 replaced with `state.translationId`
