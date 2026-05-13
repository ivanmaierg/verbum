# Tasks: translation-picker

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~520–600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 = phases T1–T3 (domain + port + signature break) · PR 2 = phases T4–T8 (state + picker + UI) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| W1 | `Translation` type + `getTranslations` port + adapter + use-case signature break | PR 1 | Compiles and all tests pass before merge; CLI callers pass `DEFAULT_TRANSLATION_ID` |
| W2 | State extensions + picker reducer slice + fetch hook + overlay UI + header + driver routing | PR 2 | Targets main; depends on W1 merged |

---

## T1 — feat(domain): Translation type (REQ-01, REQ-02)

### RED
- [ ] T1.1 In `src/domain/translations.ts`: add failing test stubs in `src/domain/translations.test.ts` — assert `Translation` and `TranslationId` are importable from the same path and that the interface has the 5 required fields.
- [ ] T1.2 Run `bun test src/domain/translations.test.ts` — confirm RED.

### GREEN
- [ ] T1.3 Add `export interface Translation { id: TranslationId; name: string; language: string; languageEnglishName: string; textDirection: "ltr" | "rtl" }` to `src/domain/translations.ts` (REQ-01, REQ-02).
- [ ] T1.4 Run `bun test src/domain/translations.test.ts` — confirm GREEN. Run `bun run tsc --noEmit` — clean.

---

## T2 — feat(port+adapter): getTranslations (REQ-03, REQ-08–REQ-10)

### RED
- [ ] T2.1 In `src/api/hello-ao-bible-repository.test.ts`: add test group `getTranslations` — (a) fetch stub returns 200 with `{ translations: [...] }`, assert result is `ok:true`, items sorted by `languageEnglishName` then `name`; (b) two calls share one network request (cache); (c) fetch 500 → `ok:false`; (d) malformed JSON → `ok:false` schema_mismatch.
- [ ] T2.2 Run `bun test src/api/hello-ao-bible-repository.test.ts` — confirm RED.

### GREEN
- [ ] T2.3 Add `RawTranslationSchema` and `RawTranslationsResponseSchema` to `src/api/schemas.ts` (REQ-08).
- [ ] T2.4 Add `getTranslations(): Promise<Result<Translation[], RepoError>>` to `BibleRepository` interface in `src/application/ports/bible-repository.ts` (REQ-03).
- [ ] T2.5 Implement `getTranslations` in `createHelloAoBibleRepository` with closure-scoped `let cached: Translation[] | null = null`; endpoint `https://bible.helloao.org/api/available_translations.json`; sort by `languageEnglishName` asc then `name` asc; cache on success, no cache on error (REQ-08–REQ-10).
- [ ] T2.6 Run `bun test src/api/hello-ao-bible-repository.test.ts` — GREEN. Run `bun run tsc --noEmit` — clean.

---

## T3 — refactor(use-case): promote translationId parameter (REQ-05–REQ-07) ← breaking change

### RED
- [ ] T3.1 In `src/application/get-chapter.test.ts`: update all call sites to pass `translationId` as second argument (after `repo`); add assertion that `DEFAULT_TRANSLATION_ID` is NOT imported by `get-chapter.ts`.
- [ ] T3.2 In `src/application/get-passage.test.ts`: same update — pass `translationId` explicitly.
- [ ] T3.3 Run `bun test src/application` — confirm RED (wrong signatures).

### GREEN
- [ ] T3.4 Update `getChapter` signature: `(repo, translationId: TranslationId, ref)` — remove `DEFAULT_TRANSLATION_ID` import; pass `translationId` to `repo.getChapter` (REQ-05).
- [ ] T3.5 Update `getPassage` signature: `(repo, translationId: TranslationId, ref)` — same (REQ-06).
- [ ] T3.6 Update `src/cli/run.ts` — pass `DEFAULT_TRANSLATION_ID` at each call site (REQ-07).
- [ ] T3.7 Update `src/cli/vod.ts` — same (REQ-07).
- [ ] T3.8 Update `src/tui/reader/use-passage-fetch.ts` — pass `state.translationId` (REQ-07). Note: `translationId` does not exist on state yet; use `DEFAULT_TRANSLATION_ID` as a temporary stand-in — the next phase adds the field.
- [ ] T3.9 Run `bun test` — full suite GREEN. Run `bun run tsc --noEmit` — clean. **PR 1 boundary — merge before proceeding.**

---

## T4 — feat(state): translationId + translationName on ReaderState (REQ-11–REQ-13)

### RED
- [ ] T4.1 In `src/tui/reader/reader-reducer.test.ts`: update all `loading`, `loaded`, `network-error` snapshot sites to include `translationId` and `translationName` fields; add test that `initialReaderState` has `awaiting` kind (no translation fields); add `withTranslation helper` test asserting the helper propagates the two fields correctly.
- [ ] T4.2 Run `bun test src/tui/reader/reader-reducer.test.ts` — RED.

### GREEN
- [ ] T4.3 Add `translationId: TranslationId` and `translationName: string` to `loading`, `loaded`, and `network-error` variants in `reader-reducer.ts` (REQ-11).
- [ ] T4.4 Export `withTranslation<T extends { translationId: TranslationId; translationName: string }>(base: T, src: { translationId: TranslationId; translationName: string }): T` helper (design §data-flow consequences).
- [ ] T4.5 Update `initialReaderState`: stays `awaiting` — no translation fields (REQ-12 note: initial `loading` transition is seeded from `awaiting` via REQ-12's DEFAULT).
- [ ] T4.6 Patch every handler that constructs `loading`, `loaded`, or `network-error` to propagate translation fields using `withTranslation`; seed from `DEFAULT_TRANSLATION_ID` / `"Berean Standard Bible"` when transitioning from `awaiting` (REQ-12, REQ-13).
- [ ] T4.7 Update `use-passage-fetch.ts` call site from T3.8: replace temporary `DEFAULT_TRANSLATION_ID` with `state.translationId` now that the field exists; add `state.translationId` to the effect dependency array (design §data-flow consequences).
- [ ] T4.8 Run `bun test` — GREEN. `bun run tsc --noEmit` — clean.

---

## T5 — feat(state): translationPicker sub-state + 8 new actions (REQ-14–REQ-34)

### RED
- [ ] T5.1 Add test group `TranslationPickerOpened` — guard (loaded + picker null); no-op in awaiting/loading/network-error (REQ-16, REQ-24-a/b).
- [ ] T5.2 Add test group `TranslationsFetched` — sets status→"ready", items sorted, visibleItems first 50, selectedIndex→0; no-op when picker null (REQ-17, REQ-25-a/b).
- [ ] T5.3 Add test group `TranslationFetchFailed` — sets status→"error"; no-op otherwise (REQ-18, REQ-26-a/b).
- [ ] T5.4 Add test group `TranslationPickerQueryTyped` — updates query; recomputes visibleItems; resets selectedIndex (REQ-19, REQ-27-a/b).
- [ ] T5.5 Add test group `TranslationPickerMovedUp/Down` — clamp 0..visibleItems.length-1; no-op when picker null or not ready (REQ-20–21, REQ-28–30).
- [ ] T5.6 Add test group `TranslationPickerAccepted` — transitions to `loading` with chosen translation; no-op guards (REQ-22, REQ-31–32).
- [ ] T5.7 Add test group `TranslationPickerDismissed` — sets picker→null; no-op otherwise (REQ-23, REQ-33–34).
- [ ] T5.8 Run `bun test src/tui/reader/reader-reducer.test.ts` — RED.

### GREEN
- [ ] T5.9 Add `translationPicker: { status; query; items; visibleItems; selectedIndex } | null` to `loaded` variant (REQ-14).
- [ ] T5.10 Add `recomputeVisible(items, query)` pure helper (design §9).
- [ ] T5.11 Add all 8 action types to `ReaderAction` union and implement handlers in the `satisfies` dispatch table (REQ-16–23, REQ-24-a/b–REQ-34, ADR 0010 pattern).
- [ ] T5.12 Run `bun test` — GREEN. `bun run tsc --noEmit` — clean.

---

## T6 — feat(tui): useTranslationsFetch hook (REQ-38, design §7)

### RED
- [ ] T6.1 In `src/tui/reader/use-translations-fetch.test.ts`: add smoke test — fires when `state.kind==="loaded" && translationPicker?.status==="loading"`; dispatches `TranslationsFetched` on success; dispatches `TranslationFetchFailed` on repo error; does not fire when status is not "loading".
- [ ] T6.2 Run `bun test src/tui/reader/use-translations-fetch.test.ts` — RED (file missing).

### GREEN
- [ ] T6.3 Create `src/tui/reader/use-translations-fetch.ts` — mirrors `use-passage-fetch.ts` idiom; calls `repo.getTranslations()`; cancellation via cleanup bool; dispatches on resolution (design §7).
- [ ] T6.4 Run `bun test src/tui/reader/use-translations-fetch.test.ts` — GREEN.

---

## T7 — feat(tui): picker overlay + header indicator (REQ-39–REQ-44)

### RED
- [ ] T7.1 In `src/tui/reader/reader-screen.test.tsx`: add smoke — when state has `loaded` with `translationPicker.status==="ready"` + 3 items, rendered output contains item names and a cursor indicator on index 0; title shows `translationName` not literal "Berean Standard Bible" (REQ-43).
- [ ] T7.2 Add smoke — `translationPicker.status==="loading"` renders a loading indicator (REQ-40).
- [ ] T7.3 Add smoke — `translationPicker.status==="error"` renders error text (REQ-42).
- [ ] T7.4 Run `bun test src/tui/reader/reader-screen.test.tsx` — RED.

### GREEN
- [ ] T7.5 Fix `titleFor` in `reader-screen.tsx`: replace `"Berean Standard Bible"` literal with `state.translationName` for `loading`, `loaded`, `network-error` variants (REQ-43, REQ-44).
- [ ] T7.6 Add `TranslationPickerOverlay` component inline or in `src/tui/reader/translation-picker-overlay.tsx` — renders loading/ready/error branches per REQ-40–REQ-42; ready branch: query input line + list of `visibleItems` with accent + `▶` on `selectedIndex` + bottom hint (REQ-41).
- [ ] T7.7 Wire `useTranslationsFetch(state, dispatch, repo)` call into `ReaderScreen` alongside `usePassageFetch` (REQ-38, design §7).
- [ ] T7.8 Render `<TranslationPickerOverlay>` when `state.kind === "loaded" && state.translationPicker !== null` (REQ-39).
- [ ] T7.9 Update `bottomTitleFor` to add a hint line when picker is open (REQ-41).
- [ ] T7.10 Run `bun test` — GREEN. `bun run tsc --noEmit` — clean.

---

## T8 — feat(tui): driver key routing (REQ-35–REQ-37)

- [ ] T8.1 In `src/tui/tui-driver.tsx`: add translation-picker gate ABOVE verse-picker gate — when `loaded && translationPicker !== null`: `escape` → `TranslationPickerDismissed` (any status); when `status==="ready"`: `up` → MovedUp, `down` → MovedDown, `return` → Accepted; printable chars / backspace → `TranslationPickerQueryTyped`; all other keys suppressed (REQ-35, REQ-36, REQ-15).
- [ ] T8.2 Add `t` binding in the loaded no-overlay branch: when `translationPicker === null && versePicker === null`, `t` → `TranslationPickerOpened` (REQ-37).
- [ ] T8.3 Confirm gate order: quit → welcome → awaiting → verse-picker → translation-picker → reader-nav (design §8).
- [ ] T8.4 Run `bun test` — full suite GREEN. `bun run tsc --noEmit` — clean. Verify test count ≥ 250 (REQ-49). **PR 2 boundary.**

---

## Spec Coverage Map

| REQ | Task(s) |
|-----|---------|
| REQ-01–02 | T1.3 |
| REQ-03 | T2.4 |
| REQ-04 | T2.4 (no existing signature changed) |
| REQ-05–06 | T3.4–T3.5 |
| REQ-07 | T3.6–T3.8, T4.7 |
| REQ-08–10 | T2.3, T2.5 |
| REQ-11 | T4.3 |
| REQ-12 | T4.6 |
| REQ-13 | T4.6 |
| REQ-14 | T5.9 |
| REQ-15 | T8.1 |
| REQ-16–23 | T5.1–T5.11 |
| REQ-24-a/b–REQ-34 | T5.1–T5.11 |
| REQ-35–36 | T8.1 |
| REQ-37 | T8.2 |
| REQ-38 | T6.3, T7.7 |
| REQ-39–42 | T7.5–T7.9 |
| REQ-43–44 | T7.5 |
| REQ-45 | (no new deps added) |
| REQ-46 | T1.4, T2.6, T3.9, T4.8, T5.12, T6.4, T7.10, T8.4 |
| REQ-47 | T5.11 (satisfies pattern) |
| REQ-48 | enforced during review |
| REQ-49 | T8.4 (count check) |
