# Tasks: palette-chapter-picker

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~320 |
| 400-line budget risk | Low-Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| C1 | book-chapters domain module | PR 1 (single) | No dependencies; pure data + helper |
| C2 | reader-reducer extensions | PR 1 (single) | Depends on C1 (chaptersForBook) |
| C3 | chapter grid + verse picker views | PR 1 (single) | Depends on C2 (state shape) |
| C4 | tui-driver gate for verse picker keys | PR 1 (single) | Depends on C2 + C3 |

---

## C1 — feat(domain): book-chapters module

### RED

- [x] 1.1 Create `src/domain/book-chapters.test.ts` — test `chaptersForBook("JHN")` returns 21
- [x] 1.2 Add test: `chaptersForBook("GEN")` returns 50
- [x] 1.3 Add test: `chaptersForBook("PSA")` returns 150
- [x] 1.4 Add test: `chaptersForBook("REV")` returns 22
- [x] 1.5 Add test: unknown key (e.g. `"XYZ"`) returns 0 (not `undefined`)
- [x] 1.6 Run `bun test` — confirm all 5 new tests fail (RED)

### GREEN

- [x] 1.7 Create `src/domain/book-chapters.ts` — export `BOOK_CHAPTERS: Record<string, number>` with exactly 66 entries (Protestant canon, static literal, no runtime fetch)
- [x] 1.8 Export `chaptersForBook(canonical: string): number` — returns `BOOK_CHAPTERS[canonical] ?? 0`
- [x] 1.9 Run `bun test src/domain/book-chapters.test.ts` — confirm all 5 pass (GREEN)

---

## C2 — feat(tui): reader-reducer phase + intent + versePicker state

### RED — shape update tests

- [x] 2.1 In `reader-reducer.test.ts`: update all `awaiting`-state snapshot sites (~12) to include `phase: "book"`, `chapters: []`, `bookChosen: null`
- [x] 2.2 Update all `loaded`-state snapshot sites (~10) to include `versePicker: null`
- [x] 2.3 Update all `loading`-state snapshot sites (~5) to include `intent: "view"`
- [x] 2.4 Run `bun test` — confirm updated sites fail because reducer/state don't yet include these fields (RED)

### RED — new action tests

- [x] 2.5 Add test group `BookChosen` — REQ-17, REQ-18 (book phase → chapter phase; no-op when selectedIndex < 0)
- [x] 2.6 Add test group `ChapterChosen` / `SuggestionAccepted chapter phase` — REQ-19, REQ-20 (chapter phase → loading/pick-verse; no-op when bookChosen null)
- [x] 2.7 Add test group `QueryTyped chapter-phase override` — REQ-21 (always resets phase/bookChosen/chapters)
- [x] 2.8 Add test group `PassageFetched intent branches` — REQ-22 (pick-verse → versePicker opened), REQ-23 (view → versePicker null)
- [x] 2.9 Add test group `VersePickerMovedDown` — REQ-30 (+10, clamped; SCENARIO-09)
- [x] 2.10 Add test group `VersePickerMovedUp` — REQ-29 (−10, clamped; SCENARIO-10)
- [x] 2.11 Add test group `VersePickerMovedRight` — REQ-33 (+1, clamped; SCENARIO-11)
- [x] 2.12 Add test group `VersePickerMovedLeft` — REQ-32 (−1, clamped; SCENARIO-12)
- [x] 2.13 Add test group `VersePickerAccepted` — REQ-25, REQ-26 (lands cursor, closes overlay; no-op when null)
- [x] 2.14 Add test group `VersePickerCancelled` — REQ-27, REQ-28 (closes overlay, cursor stays 0; no-op when null)
- [x] 2.15 Add test group `PickerBackedOut` — REQ-35, REQ-36 (chapter→book revert; no-op in book phase)
- [x] 2.16 Run `bun test` — confirm new groups all fail (RED)

### GREEN

- [x] 2.17 Extend `ReaderState` `awaiting` variant: add `phase`, `chapters`, `bookChosen` fields (REQ-04)
- [x] 2.18 Extend `ReaderState` `loading` variant: add `intent` field (REQ-06)
- [x] 2.19 Extend `ReaderState` `loaded` variant: add `versePicker` field (REQ-07)
- [x] 2.20 Update `initialReaderState` / `makeAwaiting` to include the three new awaiting defaults (REQ-05)
- [x] 2.21 Update existing `SuggestionAccepted` handler — add book-phase branch (REQ-17, REQ-18) and chapter-phase branch (REQ-19, REQ-20)
- [x] 2.22 Update `QueryTyped` handler — reset phase/bookChosen/chapters unconditionally (REQ-21)
- [x] 2.23 Update `PassageFetched` handler — branch on `intent`; set `versePicker` accordingly (REQ-22, REQ-23)
- [x] 2.24 Add new action handlers to the `satisfies` object-dispatch table (REQ-51): `VersePickerMovedUp`, `VersePickerMovedDown`, `VersePickerMovedLeft`, `VersePickerMovedRight`, `VersePickerAccepted`, `VersePickerCancelled`, `PickerBackedOut`
- [x] 2.25 Update every `loading` state construction site to pass `intent: "view"` (REQ-06)
- [x] 2.26 Run `bun test` — confirm all tests pass (GREEN)

---

## C3 — feat(tui): chapter grid + verse picker overlay views

- [x] 3.1 In `src/tui/reader-screen.tsx` awaiting branch: when `phase === "chapter"`, render `NumberGrid` (10-col rows) from `state.chapters`; highlight `selectedIndex` cell with `ACCENT_HEX` + `▶` prefix (REQ-41, REQ-42, REQ-43)
- [x] 3.2 In loaded branch: when `versePicker !== null`, render `NumberGrid` overlay above/over the (dimmed) page content; numbers run 1..`passage.verses.length` (REQ-45, REQ-46)
- [x] 3.3 Update `titleFor` / `bottomTitleFor` to produce distinct strings for: `awaiting/chapter`, `loading/pick-verse`, `loaded/versePicker!=null` (REQ-44, REQ-47, REQ-48)
- [x] 3.4 If `reader-screen.tsx` exceeds ~200 lines, extract `NumberGrid` to `src/tui/number-grid.tsx`
- [x] 3.5 Run `bun run tsc --noEmit` — confirm no new type errors (REQ-50)

---

## C4 — feat(tui): driver gate handles verse picker keys

- [x] 4.1 Inspect `node_modules/@opentui/core/lib/KeyHandler.d.ts` (or runtime source) — record exact key name strings for `escape`, `left`, `right`, `return`, `up`, `down`, `tab`
- [x] 4.2 In `src/tui/tui-driver.tsx`: add verse-picker gate BEFORE existing loaded-state branch — when `kind === "loaded"` and `versePicker !== null`, dispatch per REQ-38 key table using verified names
- [x] 4.3 In the same gate: suppress all other keys (return without dispatching) per REQ-39
- [x] 4.4 In awaiting-state branch: when `phase === "chapter"`, map `escape` key to `PickerBackedOut` (REQ-40)
- [x] 4.5 Confirm `q`/`Q` quit handler sits above all new gates (REQ-37)
- [x] 4.6 Run `bun test` — full suite passes
- [x] 4.7 Run `bun run tsc --noEmit` — clean compile

---

## Spec Coverage Map

All 53 requirements mapped to task groups. All requirements met. All tasks complete.
