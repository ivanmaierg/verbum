# Archive Report: tui-reader-screen

**Archived**: 2026-05-12
**Status**: SHIPPED on branch `feat/tui-reader-screen`

---

## Executive Summary

Shipped the first interactive TUI consumer: a palette overlay accepts a reference, an async fetch via `useEffect + cancelled-flag` hits `getPassage`, and the chapter renders inside a properly-bordered reading frame. Extends `parseReference` to accept chapter-only refs (`john 3`). Welcome screen is preserved as a brand splash — any non-`q` key transitions to the reader. Border is native OpenTUI (`<box border title=... bottomTitle=...>`), not hand-drawn. 127/127 tests pass.

---

## Branch Status

**Branch**: `feat/tui-reader-screen`
**Commits**: 7 — the 4 from the original SDD apply, then 3 user-sanctioned post-verify fixes triggered by manual smoke.
**Working tree**: clean, ready to push.

### Commit Log

| # | SHA | Message |
|---|---|---|
| 1 | `479c996` | feat(domain): parseReference accepts chapter-only refs |
| 2 | `d214233` | feat(tui): reader reducer and async passage fetch hook |
| 3 | `61fab57` | feat(tui): reader screen replaces welcome on no-args |
| 4 | `e6a6912` | docs(openspec): add SDD trail + verify report for tui-reader-screen |
| 5 | `cd9945d` | fix(tui): reader palette crash — input cannot nest inside text |
| 6 | `9b77009` | feat(tui): welcome screen before reader on first key |
| 7 | `5c22012` | feat(tui): full-width bordered frame for reader; show real commands on welcome |

---

## Verification Summary

**Verdict (initial SDD verify)**: PASS WITH WARNINGS
**Tests**: 127/127 pass, 938 expect() calls
**tsc --noEmit**: exits 0
**Critical**: 0 | **Warning**: 1 | **Suggestion**: 1

### Post-verify sanctioned additions (commits 5–7)

Manual PTY smoke after the initial verify revealed:

1. **C5 — Crash fix (commit `cd9945d`)**: The awaiting-state initial render crashed at `appendInitialChild` because `<input>` was nested inside `<text>` in `reader-screen.tsx`. OpenTUI's `<text>` only accepts strings, `TextNodeRenderable`, or `StyledText` children. Verify missed this because no automated PTY render test exists. Logged as engram observation #276 (`opentui/text-children-rule`) for future reference.

2. **C6 — Welcome retained (commit `9b77009`)**: The original explore decision retired welcome from `verbum` no-args. User feedback ("what happened with the welcome screen?") prompted restoration: the App now owns a `phase: "welcome" | "reader"` state — boots in welcome, any non-`q` keypress transitions to reader. Welcome serves as brand splash; reader is the working default.

3. **C7 — Native bordered frame (commit `5c22012`)**: The hand-drawn `┌─...─┐` + `│` pillars + `├──┤` divider in `reader-screen.tsx` didn't align with variable-width verse text and looked broken. Replaced with OpenTUI's native `<box border title=... bottomTitle=...>` — reference goes in the top title slot, keybinds in the bottom title slot, body fills the bordered interior. Welcome hint line also updated from aspirational `? help • q quit` to real commands (`any key to start • / palette • ] next ch • [ prev ch • q quit`).

These additions were user-directed UX improvements + one critical crash fix. Tests stayed at 127/127 throughout.

---

## Residual Manual Step — DONE

PTY smoke confirmed by user: welcome shows, any key transitions to reader, palette accepts input, parse error surfaces for invalid input. Border renders correctly at full terminal width.

---

## Out-of-Scope Follow-Ups

Discovered during smoke and design discussion, deferred to a new SDD change `tui-reader-paging`:

1. **Verse pagination** — `[`/`]` reassigned from chapter nav to page nav within a chapter. Constant `VERSES_PER_PAGE` (likely 8).
2. **Verse cursor** — `↑`/`↓` move a `▶` marker between verses on the current page. Matches the original `ui-sketches.md` Reading view sketch (line 122).
3. **Chapter nav rebinding** — `n`/`p` take over what `[`/`]` did in this PR (next/prev chapter).
4. **State additions in `loaded`**: `cursor: number`, `pageStart: number`.

Also pending:
- **Key conflict in palette**: when the reader is in `awaiting` state with `<input>` focused, `useKeyboard` still fires for `[` / `]` / `/`. `[` / `]` are no-ops via reducer guards, but `/` would dispatch `PaletteReopened` and clear the query. Fix: gate reader-only keybinds behind `state.kind !== "awaiting"` in the driver.
- **Word-wrap for long verses** — currently a verse longer than the terminal width relies on OpenTUI's default text wrapping. Not stress-tested.

---

## Engram Observations (Traceability)

| Topic | ID | Type | Notes |
|---|---|---|---|
| `sdd/tui-reader-screen/explore` | 266 | architecture | Library survey, state machine sketch |
| `sdd/tui-reader-screen/proposal` | 267 | architecture | Locked decisions, scope |
| `sdd/tui-reader-screen/spec` | 268 | architecture | 22 REQs, 14 SCNs |
| `sdd/tui-reader-screen/design` | 270 | architecture | Full file contents, commit plan |
| `sdd/tui-reader-screen/tasks` | 271 | architecture | 9-task checklist |
| `sdd/tui-reader-screen/apply-progress` | 272 | architecture | All 9 tasks complete |
| `sdd/tui-reader-screen/verify-report` | 273 | architecture | PASS WITH WARNINGS |
| `opentui/text-children-rule` | 276 | discovery | OpenTUI gotcha from the crash fix |

---

## SDD Cycle Complete

The `tui-reader-screen` change has been fully:

- Proposed, specified, designed, tasked
- Applied (4 original commits)
- Verified (PASS WITH WARNINGS)
- Smoke-tested (3 post-verify fixes)
- Archived (this report)

Cycle closed. No blockers for merge.
