# Tasks: ts-native-architecture

- Status: ready
- Date: 2026-05-11
- Change: ts-native-architecture
- Phase: tasks

---

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~330 (ADR 0010 ~150 + ADR 0009 ~10 + README ~5 + house-rules rewrite ~80 + welcome-reducer.ts ~10 + welcome-reducer.test.ts ~30 + tui-driver.tsx ~15 + archive moves + SUPERSEDED.md ~30) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain (cached YOLO mode) |
| Decision needed before apply | No |

---

## Commit C1 — `docs(adr): add ADR 0010 — TypeScript-native architecture`

Satisfies: REQ-1, REQ-3, SCN-1a, SCN-1b, SCN-3a, SCN-3b

- [x] **T1.1** — Create `docs/decisions/0010-typescript-native-architecture.md`  
  Write verbatim content from design.md Section 1 (the full fenced markdown block). Do not paraphrase any sentence. Verify the file contains: `Status: accepted`, `Supersedes: [0009](...)`, the 12-row rule disposition table with correct KEEP/LOOSEN/RETIRE verdicts, Alternatives considered table, Consequences section, See also link.  
  _REQ-1, SCN-1a, SCN-1b_

- [x] **T1.2** — Update `docs/decisions/README.md` — mark ADR 0009 superseded  
  Change the `0009` row's status column from `accepted` to `superseded by 0010`. Leave all other columns and rows unchanged.  
  _REQ-3, SCN-3b_

- [x] **T1.3** — Update `docs/decisions/README.md` — add ADR 0010 row  
  Insert the new row immediately after the 0009 row:  
  `| [0010](0010-typescript-native-architecture.md) | TypeScript-native architecture (Go-port commitment dropped) | accepted | 2026-05-11 |`  
  _REQ-3, SCN-3a_

- [x] **T1.4** — Verify: read back `docs/decisions/README.md` and confirm both rows (0009 superseded, 0010 accepted) are present and table formatting is intact.  
  _SCN-3a, SCN-3b_

**Commit C1.**

---

## Commit C2 — `docs(adr): mark ADR 0009 superseded by 0010`

Satisfies: REQ-2, SCN-2a, SCN-2b

- [x] **T2.1** — Edit `docs/decisions/0009-language-portable-architecture.md` — Edit 1 (status flip)  
  Change line 3 from `- Status: accepted` to `- Status: superseded by 0010`. Touch nothing else on this pass.  
  _REQ-2, SCN-2a_

- [x] **T2.2** — Edit `docs/decisions/0009-language-portable-architecture.md` — Edit 2 (superseded-by section)  
  Insert the following block immediately after the front-matter (after `- Date: 2026-05-09`) and before the `## Context` heading — no other lines modified:

  ```markdown

  ## Superseded by

  [ADR 0010](0010-typescript-native-architecture.md) — Go-port commitment dropped 2026-05-11. The Bubble Tea parity rules (Rules 7–10 in the original numbering of this ADR) are retired. See ADR 0010 for the full rule disposition.
  ```

  _REQ-2, SCN-2a_

- [x] **T2.3** — Verify: read back the file and confirm (a) `Status: superseded by 0010` on line 3, (b) `## Superseded by` section present before `## Context`, (c) `## Context` through `## See also` unchanged from original (body is IMMUTABLE — no other edits).  
  _REQ-2, SCN-2b_

**Commit C2.**

---

## Commit C3 — `docs(house-rules): align with ADR 0010 (retire rules 9/10, loosen 7/8)`

Satisfies: REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, SCN-4 through SCN-9

> Note: C3 is documentation only — no code change, no TDD required.  
> REQ-10 / SCN-10 is satisfied trivially — design.md Section 8 confirmed zero portability references in `docs/architecture.md`. No edit to that file is needed.

- [x] **T3.1** — Rewrite `docs/house-rules.md` preamble (lines 1–14, from `# House Rules` through the `---` separator)  
  Replace with the exact banner from design.md Section 4 ("Banner" subsection). Confirm the result: no "portability-first dialect", no Go-port or Bubble Tea mandate, references ADR 0010.  
  _REQ-4, SCN-4_

- [x] **T3.2** — Rewrite Rule 1 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 1 — KEEP" subsection. No Go-port footnote present.  
  _REQ-9, SCN-9_

- [x] **T3.3** — Rewrite Rule 2 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 2 — KEEP" subsection.  
  _REQ-9, SCN-9_

- [x] **T3.4** — Rewrite Rule 3 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 3 — KEEP" subsection.  
  _REQ-9, SCN-9_

- [x] **T3.5** — Rewrite Rule 4 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 4 — KEEP" subsection.  
  _REQ-9, SCN-9_

- [x] **T3.6** — Rewrite Rule 5 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 5 — KEEP" subsection.  
  _REQ-9, SCN-9_

- [x] **T3.7** — Rewrite Rule 6 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 6 — KEEP" subsection.  
  _REQ-9, SCN-9_

- [x] **T3.8** — Rewrite Rule 7 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 7 — LOOSEN" subsection. Confirm: "loosened — ADR 0010" tag present, "Go can't follow" absent, judgment-call guidance present.  
  _REQ-5, SCN-5_

- [x] **T3.9** — Rewrite Rule 8 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 8 — KEEP (loosened)" subsection. Confirm: plain `(state, action) => State` example present, no `[State, Effect | null]` tuple example, no Bubble Tea parity note.  
  _REQ-6, SCN-6_

- [x] **T3.10** — Rewrite Rule 9 section in `docs/house-rules.md` — LOCKED TEXT  
  Replace with verbatim content from design.md Section 4 "Rule 9 — RETIRE" subsection. The body MUST contain exactly:  
  > "Retired. `useEffect` is now permitted for async business logic. CONVENTION: `useEffect` must call application use cases, never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern."  
  No paraphrase is acceptable (NFR-4).  
  _REQ-7, SCN-7, NFR-4_

- [x] **T3.11** — Rewrite Rule 10 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 10 — RETIRE" subsection. Confirm: "Retired" present, Bubble Tea parity instruction absent.  
  _REQ-8, SCN-8_

- [x] **T3.12** — Rewrite Rule 11 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 11 — KEEP" subsection.  
  _REQ-9, SCN-9_

- [x] **T3.13** — Rewrite Rule 12 section in `docs/house-rules.md`  
  Replace with verbatim content from design.md Section 4 "Rule 12 — KEEP" subsection.  
  _REQ-9, SCN-9_

- [x] **T3.14** — Update "How to apply these rules" footer section in `docs/house-rules.md`  
  (a) Replace old Rule 9 code review example with: `"Rule 9 (convention) — \`useEffect\` must call the application use case (\`getPassage\`), not the repository port directly."`  
  (b) Replace the ADR 0009 reference in the "default is enforce, not bend" paragraph with ADR 0010 as specified in design.md Section 4 footer subsection.  
  _REQ-4, SCN-4_

- [x] **T3.15** — Verify: run `grep -i "go port\|bubble tea\|portability-first" docs/house-rules.md` — output MUST be empty.  
  _SCN-4_

- [x] **T3.16** — Verify: run `grep -i "go port\|bubble tea\|portability" docs/architecture.md` — output MUST be empty (trivially satisfied — no edits needed per design.md Section 8).  
  _REQ-10, SCN-10_

**Commit C3.**

---

## Commit C4 — `refactor(tui): plain useReducer signature; quit via useKeyboard`

Satisfies: REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, SCN-11a through SCN-17c

> STRICT TDD ORDER — follow Batch 1 → Batch 2 exactly. Do not reorder.

### Batch 1 — Reducer RED → GREEN

- [x] **T4.1** **(RED — test rewrite)** — Rewrite `src/tui/welcome/welcome-reducer.test.ts` to the AFTER version in design.md Section 5b.  
  4 tests; all use `const nextState = welcomeReducer(...)` + `expect(nextState).toBe(initialWelcomeState)`; no tuple destructuring.  
  _REQ-12, SCN-12a_

- [x] **T4.2** **(RED — expect failure)** — Run `bun test src/tui/welcome/welcome-reducer.test.ts`.  
  EXPECTED: 3 of 4 tests FAIL (the three tests that call welcomeReducer with tuple-returning implementation get a tuple back, not the plain state reference). The `initialWelcomeState.kind` test passes. **Do not proceed until you see exactly 3 failures.**

- [x] **T4.3** **(GREEN — reducer rewrite)** — Rewrite `src/tui/welcome/welcome-reducer.ts` to the AFTER version in design.md Section 5a.  
  Signature: `(state: WelcomeState, action: WelcomeAction): WelcomeState`. Remove `Effect` export. All `KeyPressed` cases return `state` unchanged.  
  _REQ-11, SCN-11a_

- [x] **T4.4** **(GREEN — expect pass)** — Run `bun test src/tui/welcome/welcome-reducer.test.ts`.  
  EXPECTED: 4/4 pass. **Do not proceed until all 4 pass.**

- [x] **T4.5** **(FULL SUITE)** — Run `bun test`.  
  EXPECTED: ≥ 99 pass. Note: tui-driver.tsx still imports `type Effect` which is now absent — a TypeScript compile error is expected but does NOT cause test failures (bun test runs JS, not tsc). Proceed to Batch 2.  
  _REQ-15, SCN-15_

### Batch 2 — Driver RED (compile) → GREEN

- [x] **T4.6** **(RED — compile error)** — Run `bun run tsc --noEmit`.  
  EXPECTED: type error on `Effect` import in `src/tui/tui-driver.tsx` (Effect is no longer exported from welcome-reducer.ts). **Confirm the error before rewriting the driver.**

- [x] **T4.7** **(GREEN — driver rewrite)** — Rewrite `src/tui/tui-driver.tsx` to the AFTER version in design.md Section 5c.  
  Remove: `reactReducer` shim, `runEffect` function, `Effect` import, custom dispatch wrapper, double-call pattern.  
  Add: standard `useReducer(welcomeReducer, initialWelcomeState)`, inline `useKeyboard` handler that calls `renderer.destroy() + resolve()` for `q`/`Q`, inline SIGINT teardown.  
  _REQ-13, SCN-13a, SCN-13b, SCN-13c, SCN-13d_

- [x] **T4.8** — Verify `welcome-screen.tsx` dispatch prop type.  
  Read `src/tui/welcome/welcome-screen.tsx` and check whether the `dispatch` prop was typed against the old custom wrapper. If typed as `Dispatch<WelcomeAction>` (React standard type) — no change needed. If typed against a custom type — update the prop type to `Dispatch<WelcomeAction>`. No behavioral change required.  
  _REQ-13 (note in design.md Section 5c)_

- [x] **T4.9** **(GREEN — compile check)** — Run `bun run tsc --noEmit`.  
  EXPECTED: 0 errors. **Do not proceed until clean.**  
  _NFR-5, SCN-11b_

- [x] **T4.10** **(FULL SUITE)** — Run `bun test`.  
  EXPECTED: ≥ 99 pass, exit code 0.  
  _REQ-15, SCN-15, NFR-3_

### Batch 3 — Archive move

- [x] **T4.11** — Create `openspec/changes/archive/` directory if it does not exist. Move `openspec/changes/tui-async-effects/` to `openspec/changes/archive/tui-async-effects/`.  
  _REQ-14, SCN-14a, SCN-14c_

- [x] **T4.12** — Create `openspec/changes/archive/tui-async-effects/SUPERSEDED.md` with the verbatim content from design.md Section 7. Confirm: references `ts-native-architecture`, mentions `useReducer + useEffect + AbortController`, mentions Engram #248.  
  _REQ-14, SCN-14a, SCN-14b_

- [x] **T4.13** — Verify: confirm `openspec/changes/tui-async-effects/` no longer exists at its original path (contents moved, not copied).  
  _SCN-14c_

### Batch 4 — Manual smoke test (PTY-only, not automated)

- [x] **T4.14** **(MANUAL)** — In a TTY terminal ≥ 60×20, run `bun start`. Verify welcome screen renders. Press `q` — confirm process exits cleanly. Press `Q` — same. Send Ctrl+C — same teardown path.  
  Note: this step requires a PTY and cannot be automated. It is the explicit success criterion for REQ-17b/c (accepted test-coverage gap documented in design.md Section 6, Batch 3 note and Section 9).  
  _REQ-17, SCN-17a, SCN-17b, SCN-17c_

**Commit C4.**

---

## Commit C5 — `chore(openspec): archive tui-async-effects`

> Per design.md Section 10, the archive move is folded into C4's file list. C5 is a separate commit boundary only if the reviewer prefers to isolate the openspec housekeeping. If T4.11–T4.13 are committed together with the code changes in C4, this commit is omitted. The single-PR delivery strategy allows either grouping.

- [x] **T5.1** *(conditional)* — If the openspec archive tasks (T4.11–T4.13) were deferred from C4, commit them now under `chore(openspec): archive tui-async-effects change folder`.  
  _REQ-14_

---

## Parallel / Sequential Summary

| Tasks | Execution |
|---|---|
| T1.1 → T1.4 | Sequential within C1 |
| T2.1 → T2.3 | Sequential within C2 |
| T3.1 → T3.16 | Sequential within C3 (rule rewrites can be done in any order within C3; T3.15/T3.16 verify last) |
| C1, C2, C3 | Sequential by commit order (docs commits before code) |
| T4.1 → T4.5 (Batch 1) | Sequential — strict TDD order |
| T4.6 → T4.10 (Batch 2) | Sequential — strict TDD order; must follow Batch 1 |
| T4.11 → T4.13 (Batch 3) | Can run in parallel with Batch 2 if the apply agent uses separate working contexts; otherwise run after T4.10 |
| T4.14 (Batch 4) | Last — manual smoke, after all automated checks pass |

---

## File Checklist

| File | Action | Commit |
|---|---|---|
| `docs/decisions/0010-typescript-native-architecture.md` | CREATE (verbatim from design.md Section 1) | C1 |
| `docs/decisions/README.md` | UPDATE (0009 superseded, add 0010 row) | C1 |
| `docs/decisions/0009-language-portable-architecture.md` | UPDATE (status flip + superseded-by section; body IMMUTABLE) | C2 |
| `docs/house-rules.md` | REWRITE (preamble + all 12 rules; Rule 9 locked text NFR-4) | C3 |
| `docs/architecture.md` | NO CHANGE (zero portability references found; REQ-10 trivially satisfied) | — |
| `src/tui/welcome/welcome-reducer.test.ts` | REWRITE (plain-state assertions; strict TDD RED first) | C4 |
| `src/tui/welcome/welcome-reducer.ts` | REWRITE (tuple → plain State; Effect removed; strict TDD GREEN second) | C4 |
| `src/tui/tui-driver.tsx` | REWRITE (shim removed, standard useReducer, inline quit) | C4 |
| `src/tui/welcome/welcome-screen.tsx` | VERIFY + conditional update (dispatch prop type check only) | C4 |
| `openspec/changes/archive/tui-async-effects/` | CREATE (directory + move) | C4 or C5 |
| `openspec/changes/archive/tui-async-effects/SUPERSEDED.md` | CREATE (verbatim from design.md Section 7) | C4 or C5 |
| `openspec/changes/tui-async-effects/` | REMOVE (moved to archive) | C4 or C5 |
