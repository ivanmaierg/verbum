# Tasks: visual-identity-v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180 (135 logic + 14 generated + 30 docs) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All 5 commits | PR 1 | Sequential commits, single PR, well under 400-line budget |

---

## Phase 1: Foundation — Presentation Constants (C1)

- [x] T-1.1 Create `src/presentation/colors.ts` — single named export `ACCENT_HEX = "#5BA0F2"`, zero imports, no logic. Satisfies I1, I2, I3 (R4 compliant).
  - Commit: 60d8103

---

## Phase 2: Core ANSI Layer (C2) — Strict TDD: test first, code second, single commit

- [x] T-2.1 Write `src/cli/ansi.test.ts` first (RED). 18 tests covering full 9-row truth table + all helpers.
- [x] T-2.2 Implement `src/cli/ansi.ts` (GREEN). All 18 tests pass.
  - Commit: b3a9b9c

---

## Phase 3: Two-Tone Banner (C3) — Atomic commit

- [x] T-3.1 Update `scripts/generate-banner.ts` — dual figlet with per-half parity guard and padEnd.
- [x] T-3.2 Run `bun run generate:banner` — banner.ts regenerated with BANNER_DIM_PART + BANNER_ACCENT_PART + BANNER_WIDTH.
- [x] T-3.3 Update `src/tui/welcome/welcome-screen.tsx` — two adjacent <span> siblings.
- [x] T-3.4 Atomic commit of all three files.
  - Commit: 203641f

---

## Phase 4: Error Rendering (C4) — Strict TDD: test first, code second, single commit

- [x] T-4.1 Extend `src/cli/render.test.ts` — baseline fixtures + color-gated tests (RED: 2 fail, 4 pass).
- [x] T-4.2 Update `src/cli/render.ts` — extract formatters, wrap with error(), isColorEnabled (GREEN: 6 pass).
  - Commit: 9a34b28

---

## Phase 5: Docs Reconciliation (C5)

- [x] T-5.1 Edit `docs/ui-sketches.md` — removed "no hue, ever", added three-tier table + accent/error tokens.
  - Commit: 84e2450

---

## Risks for Apply Phase

All resolved. See apply-progress observation #210 for deviations.
