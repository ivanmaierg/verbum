# Archive Report: palette-suggestions

**Archived**: 2026-05-12
**Status**: SHIPPED on branch `feat/palette-suggestions`

---

## Executive Summary

Adds live book-name suggestions to the reader's palette. As the user types, a subsequence-scored fuzzy match against `BOOK_ALIASES` (~130 entries) produces up to 5 ranked suggestions rendered under the input. `↑`/`↓` navigates the list (clamped at edges; no wrap); selected row uses the accent color matching the verse cursor pattern. `Tab` accepts the selected suggestion — rewrites the input to `{DisplayName} ` (with trailing space, ready for chapter typing) and clears the list. `Enter` always submits the query as-typed, no ambiguity with suggestion selection. Driver's `awaiting`-state gate is split to allow `up`/`down`/`tab` through while suppressing everything else (except `q`/`Q` quit, which sits above the gate). New pure domain module `src/domain/book-suggestions.ts` with subsequence + light-scoring algorithm (exact-match, prefix, density bonuses); display names derived from longest alias per USFM code with regex transform for numbered books. 178/178 tests pass.

---

## Branch Status

**Branch**: `feat/palette-suggestions`
**Commits**: 5 — 3 from the original SDD apply, the SDD-trail/verify-report commit, then one post-verify bug fix from manual smoke.
**Working tree**: clean, ready to push.

### Commit Log

| # | SHA | Message |
|---|---|---|
| 1 | `04c9716` | feat(domain): book-suggestions module with subsequence-scored fuzzy match |
| 2 | `c904299` | feat(tui): reader-reducer awaiting state gains suggestion fields |
| 3 | `8556f03` | feat(tui): suggestion list view + driver gate split for navigation keys |
| 4 | `e0051ff` | docs(openspec): add SDD trail + verify report for palette-suggestions |
| 5 | `9d5b4df` | fix(tui): use onInput for per-keystroke palette updates |

---

## Verification Summary

**Initial SDD verify verdict**: PASS WITH WARNINGS (16/16 REQs satisfied)
**Tests**: 178/178 pass
**tsc --noEmit**: exits 0
**Critical**: 0 | **Warning**: 2 (test count gap vs target — non-blocking; no driver/view automated tests — by design) | **Suggestion**: 2 (cosmetic)

### Post-verify sanctioned fix (commit 5)

Manual PTY smoke revealed suggestions never appeared while typing. Root cause: OpenTUI's `<input>` follows DOM semantics — `onChange` fires on commit/blur, NOT per keystroke. The reader was wired to `onChange`, so `state.query` only updated when `onSubmit` fired on Enter (which races just in time for `QuerySubmitted` to read the final value). During typing, `state.query` was perpetually empty, so `suggestBooks` returned `[]` every render.

One-line fix: `onChange` → `onInput`. `onInput` is OpenTUI's per-keystroke event. `QueryTyped` now dispatches on every character, suggestions populate live, list renders correctly.

This bug was latent in PR #10 and #11 as well — the reader still worked because `onChange` fires just before `onSubmit` on Enter, so the final value landed in `state.query` in time. But during typing, state lagged. This PR is the first that actually depends on per-keystroke updates.

---

## Residual Manual Step — DONE

User confirmed PTY smoke after the fix:
- Type `john` → suggestion list shows John, 1 John, 2 John, 3 John in accent-styled rows
- `↓` highlights top result
- `Tab` rewrites input to `John ` and clears list
- Type `3:16` → Enter → loads John 3:16

---

## Out-of-Scope Follow-Ups

Captured as engram backlog (`next-step/palette-chapter-picker`, observation #298):

1. **Chapter picker after book pick** — user surfaced during smoke. Backlog: not on the v1 roadmap (`docs/roadmap.md` line 15). Discipline decision: ship roadmap capabilities (translations, favorites, last-position, `--format`, mouse input) before more palette UX polish.
2. **Suggestion column alignment** — USFM codes currently render right after display name with 2 spaces; a fixed-column right-alignment would scan better. Cosmetic.
3. **Recent references / history** — out of scope for this PR; could plug into the palette as a default list when query is empty.
4. **Chapter-level suggestions** within a book ("John 3" → chapter options) — covered by the chapter-picker backlog item above.

---

## Engram Observations (Traceability)

| Topic | ID | Type | Notes |
|---|---|---|---|
| `sdd/palette-suggestions/explore` | 291 | architecture | Subsequence algorithm, state machine sketch, key-handling analysis |
| `sdd/palette-suggestions/proposal` | 292 | architecture | Locked decisions |
| `sdd/palette-suggestions/spec` | 293 | architecture | 16 REQs |
| `sdd/palette-suggestions/tasks` | 294 | architecture | 10 tasks across 3 commits |
| `sdd/palette-suggestions/apply-progress` | 295 | architecture | 156 → 178 tests; Tab confirmed not consumed by `<input>` |
| `sdd/palette-suggestions/verify-report` | 296 | architecture | PASS WITH WARNINGS |
| `sdd/palette-suggestions/archive-report` | 297 | architecture | This report |
| `next-step/palette-chapter-picker` | 298 | decision | Backlog item, deferred to favor roadmap capabilities |

Plus a process discovery from the smoke:
- OpenTUI `<input>` uses DOM semantics for `onChange` (commit only) vs `onInput` (per-keystroke). Always use `onInput` for live-update integration with reducers. This will save a debug cycle on every future controlled-input wiring.

---

## SDD Cycle Complete

The `palette-suggestions` change has been:

- Proposed, specified, designed (via explore), tasked
- Applied (3 commits)
- Verified (PASS WITH WARNINGS)
- Smoke-tested (1 post-verify fix: `onInput` instead of `onChange`)
- Archived (this report)

Cycle closed. No blockers for merge.
