# Verify Report: tui-reader-screen

**Branch:** `feat/tui-reader-screen`  
**Commits:** 479c996, d214233, 61fab57  
**Date:** 2026-05-11  
**Verdict:** PASS WITH WARNINGS

---

## Build / Test Evidence

| Check | Result | Detail |
|-------|--------|--------|
| `bun test` | PASS | 127/127, 0 failures, 938 expect() calls |
| `bun run tsc --noEmit` | PASS | exits 0, no type errors |
| Test count vs target | PASS | 127 tests (target 115–125; 28 new tests, 2 above ceiling — acceptable) |

---

## Task Completeness

| Task | Spec Status | Code State |
|------|-------------|------------|
| T1.1 RED reference.test.ts | ✓ done | 14 tests in reference.test.ts |
| T1.2 GREEN reference.ts | ✓ done | colonIdx===-1 branch at line 200 |
| T2.1 RED reader-reducer.test.ts | ✓ done | 23 tests (1 initial + 22 transitions) |
| T2.2 GREEN reader-reducer.ts | ✓ done | satisfies handler table, no switch |
| T2.3 IMPL use-passage-fetch.ts | ✓ done | getPassage + cancelled flag |
| T3.1 IMPL reader-screen.tsx | ✓ done | 4-branch render |
| T3.2 IMPL tui-driver.tsx | ✓ done | ReaderApp, repo param, keyboard handlers |
| T3.3 IMPL index.tsx | ✓ done | createHelloAoBibleRepository + tuiDriver(repo) |
| T3.4 VERIFY | ✓ done | 127 pass, tsc clean |

**9/9 tasks complete.**

---

## Spec Compliance Matrix

| REQ | Description | Status | Evidence |
|-----|-------------|--------|----------|
| REQ-1 | No-args routes to ReaderApp, not WelcomeScreen | PASS | index.tsx:11–14; tui-driver.tsx mounts ReaderApp |
| REQ-2 | tuiDriver(repo: BibleRepository); index.tsx wires createHelloAoBibleRepository() | PASS | tui-driver.tsx:44; index.tsx:12–13 |
| REQ-3 | awaiting state renders palette overlay with query; no Reading view | PASS | reader-screen.tsx:29–51 |
| REQ-4 | Palette input focused on mount | PASS | reader-screen.tsx:36 (`focused` prop set) |
| REQ-5 | parseError !== null renders ⚠ inline, overlay stays open | PASS | reader-screen.tsx:43–45 |
| REQ-6 | loaded state renders reading view; no palette | PASS | reader-screen.tsx:79–100 |
| REQ-7 | loading state renders braille spinner with setInterval/useEffect | PASS | reader-screen.tsx:22–27, 53–58 — interval at 80ms (see WARNING W-1) |
| REQ-8 | network-error renders error message; chapter_not_found includes hint | PASS | reader-screen.tsx:61–76 |
| REQ-9 | `]` → ChapterAdvanced: loaded → loading (chapter+1) | PASS | tui-driver.tsx:26–29; reducer handler + test |
| REQ-10 | `[` → ChapterRetreated: loaded → loading (chapter-1); floor at 1 | PASS | tui-driver.tsx:30–33; reducer handler + test |
| REQ-11 | `/` → PaletteReopened: loaded/network-error → awaiting | PASS | tui-driver.tsx:34–37; reducer handler + test |
| REQ-12 | q/Q exits cleanly via useKeyboard; not a reducer action | PASS | tui-driver.tsx:21–25 |
| REQ-13 | cancelled flag in useEffect cleanup; stale results dropped | PASS | use-passage-fetch.ts:16, 20, 33–35 |
| REQ-14 | chapter_not_found includes "last chapter" hint | PASS | reader-screen.tsx:62, 71 ("⚠ last chapter reached") |
| REQ-15 | parseReference("john 3") → { ok:true, verses:{start:1, end:MAX_SAFE_INT} } | PASS | reference.ts:200–217; reference.test.ts:76–82 |
| REQ-16 | Non-integer chapter token (e.g. "3x") → malformed_chapter_verse | PASS | reference.ts:203–207; reference.test.ts:100–105 |
| REQ-17 | handlers object with satisfies; no switch | PASS | reader-reducer.ts:21–63 |
| REQ-18 | useEffect calls getPassage(repo, ref), not repo.getChapter | PASS | use-passage-fetch.ts:3, 19 |
| REQ-19 | Zero new runtime dependencies | PASS | package.json dependencies unchanged (4 entries) |
| REQ-20 | tsc --noEmit exits 0 | PASS | confirmed above |
| REQ-21 | ≥99 pre-existing + new reducer/parseReference tests; target 115–125 | PASS | 127 total (2 above ceiling; not a defect) |
| REQ-22 | No useless comments in new files | PASS (see S-1) | New files have no banners/dividers; 1 borderline comment in use-passage-fetch.ts |

---

## Acceptance Scenario Coverage

| SCN | Description | Test Coverage |
|-----|-------------|---------------|
| SCN-1 | Happy path: palette → fetch → read | reader-reducer.test.ts: QuerySubmitted→loading + PassageFetched→loaded |
| SCN-2 | Chapter forward `]` | reader-reducer.test.ts: ChapterAdvanced transitions |
| SCN-3 | Chapter backward `[` | reader-reducer.test.ts: ChapterRetreated transitions |
| SCN-4 | Chapter retreat floor at 1 (no-op) | reader-reducer.test.ts: "is a no-op when chapter === 1 (floor)" |
| SCN-5 | Palette reopen from loaded `/` | reader-reducer.test.ts: PaletteReopened from loaded |
| SCN-6 | Inline parse error for malformed input | reader-reducer.test.ts: "stays awaiting with parseError when query is malformed" |
| SCN-7 | Last chapter hint on chapter_not_found | PTY-only; visual branch confirmed in reader-screen.tsx:62 |
| SCN-8 | Stale fetch dropped via cancelled flag | PTY-only; code confirmed in use-passage-fetch.ts:16–35 |
| SCN-9 | `q` exits cleanly | PTY-only; tui-driver.tsx:21–25 |
| SCN-10 | Full integration walkthrough | PTY-only (manual smoke required) |
| SCN-11 | parseReference accepts chapter-only format | reference.test.ts: "parses 'john 3' to whole-chapter ref" |
| SCN-12 | parseReference rejects partial numeric+non-numeric | reference.test.ts: "rejects 'jhn 3x'"; "returns malformed for 'john 3abc'" |
| SCN-13 | parseReference existing verse format regression | reference.test.ts: "parses 'john 3:16'" (pre-existing, still passes) |
| SCN-14 | Reducer handler table TS exhaustiveness | reader-reducer.ts: satisfies constraint catches missing keys at compile time |

---

## Design Coherence

| Decision | Compliance |
|----------|------------|
| colonIdx===-1 branch before colon-verse path | PASS — reference.ts:200 |
| useEffect deps use scalar fields not object | PASS — use-passage-fetch.ts:38 |
| getPassage uses DEFAULT_TRANSLATION_ID; translation hard-coded in screen | PASS — reader-screen.tsx:85 |
| Commit plan C1/C2/C3 followed | PASS — git log matches |
| isRepoError narrowing in fetch hook | PASS — use-passage-fetch.ts:25–29 |

---

## Rule Compliance

| Rule | Check | Status |
|------|-------|--------|
| Rule 13 (no switch, satisfies table) | reader-reducer.ts:21–63 uses satisfies object dispatch | PASS |
| Rule 14 (no useless comments) | New files: no banners, no dividers | PASS (see S-1) |
| Rule 9 / ADR 0010 (use case, not port) | use-passage-fetch.ts imports/calls getPassage | PASS |

---

## Deviation Review

| Deviation | Assessment |
|-----------|------------|
| "john 316" test replaced with "john 3abc" | ACCEPTED — logical consequence of REQ-15; "john 316" is now a valid chapter-316 reference; "john 3abc" keeps the malformed-token rejection path covered |

---

## Issues

### WARNINGS

**W-1 — Spinner interval 80ms deviates from spec's ~100ms**  
REQ-7 specifies "~10 fps (~100 ms per tick)". Implementation uses 80ms (~12.5 fps). Both values are approximate by spec wording ("~") and the difference is imperceptible, but it is a spec deviation.  
- File: `src/tui/reader/reader-screen.tsx:25`  
- Severity: WARNING (spec says "~"; visual only; not a correctness issue)

### SUGGESTIONS

**S-1 — Inline comment in use-passage-fetch.ts explaining useEffect deps**  
Line 36: `// ref is an object — spread the scalar fields as deps to avoid stale closure on navigation.`  
Rule 14 prohibits code-paraphrase comments. This comment explains WHY the deps array looks unusual (a non-obvious gotcha), which is generally acceptable. However it is adjacent to an `eslint-disable` directive, which already carries the implicit "something non-obvious here" signal. Consider removing the prose comment and letting the eslint-disable stand alone.  
- File: `src/tui/reader/use-passage-fetch.ts:36`  
- Severity: SUGGESTION

---

## Summary

- CRITICAL: 0
- WARNING: 1 (spinner interval 80ms vs ~100ms)
- SUGGESTION: 1 (inline comment in use-passage-fetch.ts)

**Verdict: PASS WITH WARNINGS**  
Branch is ready for archive. The single warning is cosmetic (visual-only spinner speed within spec's own "approximately" window). No blockers.

**Manual smoke required** (PTY-only scenarios SCN-7, SCN-8, SCN-9, SCN-10): `bun start` → palette → "john 3" Enter → spinner → verses → `]` → `[` → `/` → `q`.
