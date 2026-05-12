# Archive Report: tui-reader-paging

**Archived**: 2026-05-12
**Status**: SHIPPED on branch `feat/tui-reader-paging`

---

## Executive Summary

Adds verse paging (15 verses/page) and verse cursor navigation (`↑`/`↓` with `▶` marker in accent blue) to the reader. Reassigns keybinds: `[`/`]` → page nav, `n`/`p` → chapter nav, `↑`/`↓` → cursor, `/` → palette, `q` → quit. Fixes the existing palette-state bug where `/` would clear the query mid-typing by gating reader keybinds behind `state.kind !== "awaiting"`. Introduces a new `getChapter` application use case so single-verse refs (`john 3:16`) drop the reader into the full chapter page with the cursor positioned on the requested verse. Book-page layout: bordered frame capped at 70 chars centered horizontally, 5-char prefix matching the `ui-sketches.md` Reading view, blank row between verses for vertical rhythm, focused verse rendered in accent color (not inverse). 156/156 tests pass.

---

## Branch Status

**Branch**: `feat/tui-reader-paging`
**Commits**: 8 — the 3 from the original SDD apply, the SDD-trail/verify-report commit, then 4 user-sanctioned post-verify iterations driven by manual smoke.
**Working tree**: clean, ready to push.

### Commit Log

| # | SHA | Message |
|---|---|---|
| 1 | `a85a974` | feat(tui): reader-reducer paging + cursor state and actions |
| 2 | `8764733` | feat(tui): reader-screen page slice + cursor gutter + inverse selection |
| 3 | `7032496` | feat(tui): keybind rebinding + awaiting gate fix; welcome hint |
| 4 | `cb749dc` | docs(openspec): add SDD trail + verify report for tui-reader-paging |
| 5 | `fbd7d71` | fix(tui): reader fetches whole chapter; verse refs position cursor |
| 6 | `5a5ef32` | feat(tui): denser pages + word-wrap with hanging indent |
| 7 | `0ac25aa` | feat(tui): book-page layout — capped width, centered, blank-line verse rhythm |
| 8 | (HEAD) | style(tui): focused verse uses accent color, not inverse |

---

## Verification Summary

**Initial SDD verify verdict**: PASS WITH WARNINGS
**Tests**: 156/156 pass (127 → +29: 24 reducer + 5 across get-chapter + new PassageFetched scenarios)
**tsc --noEmit**: exits 0
**Critical**: 0 | **Warning**: 1 (manual smoke pending — now resolved) | **Suggestion**: 1 (cursor color washout — fixed in commit 8)

### Post-verify sanctioned iterations (commits 5–8)

Manual PTY smoke after the initial verify surfaced four UX issues. All addressed on the same branch as user-directed improvements, not spec drift:

1. **C5 — Whole-chapter fetch + cursor positioning (commit `fbd7d71`)**: `john 3:16` was showing only verse 16 instead of dropping into the chapter page. New `getChapter` use case returns the whole chapter regardless of `ref.verses`; `PassageFetched` now positions `cursorIndex` to the index of the verse matching `ref.verses.start`, with `pageStartIndex` derived from `Math.floor(cursorIndex / VERSES_PER_PAGE) * VERSES_PER_PAGE`. `ChapterAdvanced`/`Retreated` reset `ref.verses` to `{1, 1}` so cursor lands on verse 1 of the new chapter. Also caps palette input width to 50 chars; fixes verify suggestion S1 (accent gutter was washing out under DIM).

2. **C6 — Denser pages + word-wrap (commit `5a5ef32`)**: `VERSES_PER_PAGE` bumped from 8 to 15. Word-wrap with hanging indent (5-space continuation) at `terminalWidth - 8`, floor 20. Tests rewritten to use `VERSES_PER_PAGE` symbol instead of hardcoded indices so future page-size tuning won't churn the suite.

3. **C7 — Book-page layout (commit `0ac25aa`)**: Wide terminals were producing a single 200-char wall of text that ran off the edges or floated at the top with empty space below. Now the bordered frame caps at 70 chars (`PAGE_MAX_WIDTH`), centers horizontally via `alignItems="center"`, auto-sizes to content height, with `paddingTop={1}` for top margin and a blank `<text>` row between verses. Matches `ui-sketches.md` Reading view (line 122) exactly.

4. **C8 — Focused verse color (HEAD)**: `INVERSE` attribute on the focused verse text rendered as black-on-light, jarring against a dark terminal. Replaced with `fg={ACCENT_HEX}` per `ui-sketches.md` line 148 ("Focused verse: accent color on the line + ▶ marker in the gutter"). Marker and text now share the accent token, reading as a single highlighted unit.

---

## Residual Manual Step — DONE

User confirmed PTY smoke after each post-verify iteration:
- Welcome → any key → reader palette
- Type `john 3:16` Enter → drops into page 2 of John 3 with cursor on verse 16 (accent blue)
- `↑` / `↓` move cursor through verses (rolls across page boundaries)
- `[` / `]` page back/forward (silent clamp at edges)
- `n` / `p` chapter nav (resets to verse 1 of new chapter)
- `/` reopens palette (no longer clears mid-typing — `awaiting`-state gate working)
- `q` exits cleanly

---

## Out-of-Scope Follow-Ups

Tracked for future SDD changes:

1. **Dynamic `VERSES_PER_PAGE`** from terminal height (current value is a static 15)
2. **Cross-chapter cursor flow** — `↓` past the last verse currently clamps; could trigger `ChapterAdvanced`
3. **Two-page open-book spread** on wide terminals (matches welcome screen aesthetic)
4. **Visual feedback on page-boundary clamp** (current behavior is silent)
5. **Long-word wrap** — a single word longer than wrap width currently overflows; `wordWrap` could break long tokens

---

## Engram Observations (Traceability)

| Topic | ID | Type | Notes |
|---|---|---|---|
| `sdd/tui-reader-paging/explore` | 279 | architecture | Library survey, state machine sketch, keybind map |
| `sdd/tui-reader-paging/proposal` | 280 | architecture | Locked decisions |
| `sdd/tui-reader-paging/spec` | 281 | architecture | 27 REQs |
| `sdd/tui-reader-paging/tasks` | 282 | architecture | 37 tasks across 3 commits |
| `sdd/tui-reader-paging/apply-progress` | 283 | architecture | All 3 commits, 127 → 151 tests |
| `sdd/tui-reader-paging/verify-report` | 284 | architecture | PASS WITH WARNINGS |
| `sdd/tui-reader-paging/archive-report` | 287 | architecture | This report |

Plus discovery memories surfaced during this change:
- `opentui/text-children-rule` (#276) — `<input>` cannot nest inside `<text>` (caught in the previous PR but reinforced here)

---

## SDD Cycle Complete

The `tui-reader-paging` change has been fully:

- Proposed, specified, designed (via explore), tasked
- Applied (3 original commits)
- Verified (PASS WITH WARNINGS)
- Smoke-tested (4 post-verify user-directed iterations)
- Archived (this report)

Cycle closed. No blockers for merge.
