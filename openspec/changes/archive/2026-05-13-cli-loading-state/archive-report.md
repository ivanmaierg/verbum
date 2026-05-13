# Archive Report — cli-loading-state

**Date**: 2026-05-13
**Status**: ARCHIVED
**Change**: cli-loading-state
**Archive Path**: `openspec/changes/archive/2026-05-13-cli-loading-state/`

---

## Change Summary

Implemented a hand-rolled CLI loading spinner (`withLoading<T>`) that wraps blocking async calls in `run.ts` and `vod.ts`, rendering animated Braille frames to stderr during network fetches. The spinner respects TTY state and env-var overrides (`NO_COLOR`, `FORCE_COLOR`) to remain invisible in piped, redirected, and CI contexts. All requirements met, all tests passing (99/99), zero new dependencies.

---

## Delta Specs Merged

| Domain | Spec File | Action | Details |
|--------|-----------|--------|---------|
| cli | `openspec/specs/cli/spec.md` | Created | First CLI capability spec. 13 REQs (REQ-1 through REQ-13) covering `withLoading` signature, `isSpinnerEnabled` gate, frame rendering, cleanup, integration points, and test surface. |

---

## Archive Contents

| Artifact | Included | Location |
|----------|----------|----------|
| explore.md | Yes | `2026-05-13-cli-loading-state/explore.md` |
| proposal.md | Yes | `2026-05-13-cli-loading-state/proposal.md` |
| spec.md | Yes | `2026-05-13-cli-loading-state/spec.md` |
| design.md | Yes | `2026-05-13-cli-loading-state/design.md` |
| tasks.md | Yes | `2026-05-13-cli-loading-state/tasks.md` |
| verify-report.md | Yes | `2026-05-13-cli-loading-state/verify-report.md` |

---

## Implementation Summary

| Phase | Commits | Tests | Status |
|-------|---------|-------|--------|
| Red (tests) | C1 (`5d0fd96`) | 14 tests fail → import error | Confirmed |
| Green (impl) | C2 (`d477179`) | 14 tests pass | Confirmed |
| Integration | C3 (`74e5f50`) | All tests pass | Confirmed |
| Smoke/Verify | C4 (`f77ab54`) | 99 tests pass | **PASS** |

**Total**: 4 work-unit commits, 13 tasks (T-01 through T-08), ~155 lines added + 2 lines modified, single PR, well under 400-line budget.

---

## Requirement Compliance

All 13 requirements met:

- **REQ-1**: `withLoading<T>` generic signature locked ✓
- **REQ-2**: `isSpinnerEnabled` exported with correct return type ✓
- **REQ-3**: Precedence chain (NO_COLOR → FORCE_COLOR → isTTY) implemented ✓
- **REQ-4**: 10 Braille frames, 80ms default interval, frame-only rendering ✓
- **REQ-5**: No-op when `isTTY=false`, fn result passed through ✓
- **REQ-6**: Writes to stderr only, stdout untouched ✓
- **REQ-7**: Cleanup in `finally`, `\r \r` erase sequence before return ✓
- **REQ-8**: Result transparency, rejection propagates unchanged ✓
- **REQ-9**: `run.ts` integration (1 import + 1 line wrap) ✓
- **REQ-10**: `vod.ts` integration (1 import + 1 line wrap) ✓
- **REQ-11**: No new dependencies in `package.json` ✓
- **REQ-12**: Unit test coverage (fake streams, env-var handling, all gates) ✓
- **REQ-13**: Smoke test (no stderr bytes in non-TTY context) ✓

---

## House Rules Compliance

| Rule | Verdict |
|------|---------|
| R1 (domain never throws) | N/A (presentation) — `withLoading` respects R1 spirit |
| R2 (no class outside TUI) | ✓ Plain functions only |
| R3 (ports have no callbacks) | ✓ N/A — not a port, thunk ≠ event handler |
| R5 (errors as unions) | ✓ No new error types |
| R7 (no mapped/conditional types) | ✓ Single generic `T`, `as const` tuple |
| R11 (no decorators) | ✓ HOF, not decorator |
| R12 (async returns Result) | ✓ Transparent to caller's Result |
| simplify (no unnecessary abstractions) | ✓ `isSpinnerEnabled` duplicated by design |

---

## Findings

**CRITICAL**: None

**WARNING**: W-1 — Smoke test uses overlapping gates (`NO_COLOR=1` + `isTTY:false`); unit tests cover pure `isTTY` path. No correctness defect.

**SUGGESTION**: 
- S-1 — Spec should hardened to mandate synchronous initial frame write before interval
- S-2 — Add stdout spy test for defense-in-depth (stdout-write never happens)

---

## Source of Truth

Main spec created at:
- `openspec/specs/cli/spec.md` (13 REQs, locked down observable behavior)

---

## SDD Cycle Complete

The `cli-loading-state` change has been:
1. Explored (design space, trade-offs)
2. Proposed (scope, decisions, mitigations)
3. Specified (13 clear requirements)
4. Designed (module layout, control flow, test strategy)
5. Tasked (13 tasks across 4 work-unit commits, TDD ordering)
6. Applied (100% implementation, all tests green)
7. Verified (99 passing, zero regressions, spec/rule compliance confirmed)
8. **Archived** (2026-05-13)

Ready for the next change.

---

## Notes for Future

- The `isSpinnerEnabled` duplication (vs sharing with `isColorEnabled`) is intentional; revisit only if a third gate function appears
- Initial synchronous frame write (before `setInterval` starts) is key for responsiveness; do not refactor without understanding user experience impact
- The injectable `interval` parameter for unit tests is the v1 TDD strategy; do not introduce Bun fake timers unless tests become unreliable
- All future CLI animation helpers should follow this same pattern: sign a gate function, inject the interval for testability, rely on fast-resolving fns in smoke tests
