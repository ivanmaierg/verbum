# Tasks: tui-reader-paging

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~136 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain (cached YOLO mode) |
| Decision needed before apply | No |

---

## Commit C1 — feat(tui): reader-reducer paging + cursor state and actions

**Files**: `src/tui/reader/reader-reducer.test.ts`, `src/tui/reader/reader-reducer.ts`

**Satisfies**: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, NFR-3, NFR-4

### RED phase — `reader-reducer.test.ts`

- [ ] **T1.1** Update existing `PassageFetched` test assertions to expect the new `loaded` shape (`cursorIndex: 0`, `pageStartIndex: 0`) — confirm tests fail with current reducer. (REQ-1, REQ-4)
- [ ] **T1.2** Add test: `VERSES_PER_PAGE` is a named export equal to `8`. (REQ-3)
- [ ] **T1.3** Add test: `PassageFetched` when `state.kind !== "loading"` returns state unchanged — no new fields on non-loaded variants. (REQ-5)
- [ ] **T1.4** Add tests: `CursorMovedUp`, `CursorMovedDown`, `PageAdvanced`, `PageRetreated` are no-ops when `state.kind` is `awaiting`, `loading`, or `network-error`. (REQ-7)
- [ ] **T1.5** Add test: `CursorMovedDown` within page — `cursorIndex` increments by 1, `pageStartIndex` unchanged. (REQ-9)
- [ ] **T1.6** Add test: `CursorMovedDown` at last verse of page (not last page) — `pageStartIndex` advances by `VERSES_PER_PAGE`, `cursorIndex` equals new `pageStartIndex`. (REQ-10)
- [ ] **T1.7** Add test: `CursorMovedDown` at last verse of last page — state unchanged (silent clamp). (REQ-11)
- [ ] **T1.8** Add test: `CursorMovedUp` within page — `cursorIndex` decrements by 1, `pageStartIndex` unchanged. (REQ-12)
- [ ] **T1.9** Add test: `CursorMovedUp` at first verse of page (not first page) — `pageStartIndex` retreats by `VERSES_PER_PAGE`, `cursorIndex` equals last verse of retreated page (`min(newPageStart + VERSES_PER_PAGE - 1, verses.length - 1)`). (REQ-13)
- [ ] **T1.10** Add test: `CursorMovedUp` at `cursorIndex === 0`, `pageStartIndex === 0` — state unchanged (silent clamp). (REQ-14)
- [ ] **T1.11** Add test: `PageAdvanced` when next page exists — `pageStartIndex` advances by `VERSES_PER_PAGE`, `cursorIndex` equals new `pageStartIndex`. (REQ-15)
- [ ] **T1.12** Add test: `PageAdvanced` at last page — state unchanged (silent clamp). (REQ-16)
- [ ] **T1.13** Add test: `PageRetreated` when previous page exists — `pageStartIndex` retreats by `VERSES_PER_PAGE`, `cursorIndex` equals new `pageStartIndex`. (REQ-17)
- [ ] **T1.14** Add test: `PageRetreated` at first page (`pageStartIndex === 0`) — state unchanged (silent clamp). (REQ-18)
- [ ] **T1.15** Add test: `ChapterAdvanced` and `ChapterRetreated` still transition to `loading` state — no cursor fields on resulting state. (REQ-19)
- [ ] **T1.16** Confirm `bun test` shows all new tests RED and existing tests pass. Gate before GREEN.

### GREEN phase — `reader-reducer.ts`

- [ ] **T1.17** Export `VERSES_PER_PAGE = 8` as a named constant. (REQ-3)
- [ ] **T1.18** Extend the `loaded` state variant type with `cursorIndex: number` and `pageStartIndex: number`. (REQ-1)
- [ ] **T1.19** Add four new action types to the union: `CursorMovedUp`, `CursorMovedDown`, `PageAdvanced`, `PageRetreated`. (REQ-6)
- [ ] **T1.20** Update `PassageFetched` handler to initialize `cursorIndex: 0, pageStartIndex: 0` on the `loading → loaded` transition. (REQ-4)
- [ ] **T1.21** Add `CursorMovedDown` handler to the object-dispatch table: within-page increment; cross-page-boundary advance; silent clamp at last verse of last page. (REQ-8, REQ-9, REQ-10, REQ-11, NFR-4)
- [ ] **T1.22** Add `CursorMovedUp` handler to the object-dispatch table: within-page decrement; cross-page-boundary retreat; silent clamp at first verse of first page. (REQ-8, REQ-12, REQ-13, REQ-14, NFR-4)
- [ ] **T1.23** Add `PageAdvanced` handler to the object-dispatch table: advance `pageStartIndex` + reset `cursorIndex`; silent clamp at last page. (REQ-8, REQ-15, REQ-16, NFR-4)
- [ ] **T1.24** Add `PageRetreated` handler to the object-dispatch table: retreat `pageStartIndex` + reset `cursorIndex`; silent clamp at first page. (REQ-8, REQ-17, REQ-18, NFR-4)
- [ ] **T1.25** Confirm all four handlers return state unchanged when `state.kind !== "loaded"` (guard at top of each handler or before dispatch). (REQ-7)
- [ ] **T1.26** Run `bun test` — confirm all new tests GREEN and total test count is in the 145–155 range. (NFR-3)
- [ ] **T1.27** Run `bun run tsc --noEmit` — confirm exit 0. (NFR-2)

---

## Commit C2 — feat(tui): reader-screen page slice + cursor gutter + inverse selection

**Files**: `src/tui/reader/reader-screen.tsx`

**Satisfies**: REQ-23, REQ-24, REQ-25, REQ-26, NFR-1, NFR-2

> No automated tests — this is the visual surface. Manual smoke is the gate for this commit.

- [ ] **T2.1** Verify `TextAttributes.INVERSE` is exported from `@opentui/core` (check node_modules or type declarations). If missing, surface as a blocker before proceeding. (NFR-1)
- [ ] **T2.2** In the `loaded` branch of `reader-screen.tsx`, replace full `passage.verses` render with `passage.verses.slice(pageStartIndex, pageStartIndex + VERSES_PER_PAGE)`. (REQ-23)
- [ ] **T2.3** For each rendered verse, add a gutter cell: render `▶` in `ACCENT_HEX` foreground when `verse index === cursorIndex`; render a space for all other verses. (REQ-24)
- [ ] **T2.4** For the verse at `cursorIndex`, apply `TextAttributes.INVERSE` to the verse text element; all other verse texts render without `INVERSE`. (REQ-25)
- [ ] **T2.5** Update `bottomTitleFor` loaded case to return exactly: `" ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit "`. (REQ-26)
- [ ] **T2.6** Run `bun run tsc --noEmit` — confirm exit 0. (NFR-2)
- [ ] **T2.7** Manual smoke: launch TUI, load a passage with more than 8 verses, verify only 8 verses render, `▶` appears on the first verse with inverse highlight, bottom title reflects new keybind string.

---

## Commit C3 — feat(tui): keybind rebinding + awaiting gate fix; welcome hint

**Files**: `src/tui/tui-driver.tsx`, `src/tui/welcome/welcome-screen.tsx`

**Satisfies**: REQ-20, REQ-21, REQ-22, REQ-26 (driver wiring), REQ-27, NFR-2

Sequential after C2 (depends on reader-screen shape being stable).

- [ ] **T3.1** In `tui-driver.tsx` `useKeyboard`, add the `awaiting`-state gate (`readerState.kind !== "awaiting"`) AFTER the `q`/`Q` quit check. All reader-only keybinds must sit inside this gate. (REQ-20, REQ-21)
- [ ] **T3.2** Inside the gate, add `up` key → dispatch `CursorMovedUp`. (REQ-22)
- [ ] **T3.3** Inside the gate, add `down` key → dispatch `CursorMovedDown`. (REQ-22)
- [ ] **T3.4** Rebind `[` from `ChapterRetreated` to `PageRetreated`. (REQ-22)
- [ ] **T3.5** Rebind `]` from `ChapterAdvanced` to `PageAdvanced`. (REQ-22)
- [ ] **T3.6** Add `n` key → dispatch `ChapterAdvanced`. (REQ-22)
- [ ] **T3.7** Add `p` key → dispatch `ChapterRetreated`. (REQ-22)
- [ ] **T3.8** Confirm `/` key (`PaletteReopened`) remains inside the gate and is NOT above it — gate now fixes the double-dispatch bug. (REQ-21)
- [ ] **T3.9** Update `welcome-screen.tsx` hint line to exactly: `"  any key to start  •  ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit"`. (REQ-27)
- [ ] **T3.10** Run full `bun test` — confirm all tests pass, no regressions. (NFR-3)
- [ ] **T3.11** Run `bun run tsc --noEmit` — confirm exit 0. (NFR-2)
- [ ] **T3.12** Manual smoke: verify `↑`/`↓` move cursor, `[`/`]` page-navigate, `n`/`p` chapter-navigate, `/` opens palette only when NOT in awaiting state, `q` quits from any state.

---

## Dependency Order

```
T1.1–T1.27 (C1, sequential)
    └─▶ T2.1–T2.7 (C2, sequential — depends on C1 loaded shape)
            └─▶ T3.1–T3.12 (C3, sequential — depends on C1 actions + C2 screen)
```

All three commits are sequential. No tasks within a commit are parallelisable given strict TDD ordering (RED must confirm fail before GREEN proceeds).

---

## Risk Notes

- **T2.1** (`TextAttributes.INVERSE` availability) is the only external dependency that could block C2. Verify before writing screen code.
- Arrow key names (`"up"` / `"down"`) are confirmed from `mock-keys.d.ts` but must be re-verified at C3 implementation against the live `@opentui/core` key event shape.
- Existing tests that assert on the `loaded` state shape (T1.1) will fail until T1.17–T1.20 are applied — this is the expected RED gate.
