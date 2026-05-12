# Proposal: ts-native-architecture

- Status: proposed
- Date: 2026-05-11
- Supersedes: ADR 0009 (language-portable-architecture)
- Next ADR: 0010

---

## TL;DR

- Drop ADR 0009's Go-port mandate. The Go/Bubble Tea portability commitment is retired; verbum will be a first-class TypeScript + Bun + OpenTUI/React application.
- Retire the three Bubble Tea parity rules (Rules 8 tuple constraint, 9, 10) and loosen Rule 7. The other nine rules survive on TypeScript merit alone.
- Simplify `welcome-reducer.ts` from `(state, action) => [State, Effect | null]` to plain `(state, action) => State`. The `quit` effect moves inline to the `useKeyboard` handler in `tui-driver.tsx`.
- Write ADR 0010 to formally supersede ADR 0009, flip ADR 0009's status, and update `docs/house-rules.md` with the new rule dispositions.
- Archive the paused `tui-async-effects` openspec change. The problem it was solving is now handled differently.

---

## Why

### The user's own words

> "I'm dropping the Go-port commitment. I want to focus on building a really good TypeScript/React app, not on maintaining portability constraints for a future rewrite I may never do."

### Cost analysis from exploration

ADR 0009 was a bet: accept friction today (Rules 7–10) in exchange for a "mechanical transcription" TUI port later. The rules imposed real costs:

- **Rule 9** was the most controversial — it fights React idiom hard. Every async operation required an Effect descriptor, a dispatch cycle, and a separate effect-runner switch. The current `tui-driver.tsx` already uses a non-standard "double-call" pattern to extract the effect from the reducer return tuple.
- **Rules 8 + 10** locked action naming and reducer signature to Bubble Tea parity (`(Model, Msg) → (Model, Cmd)`) even though verbum has exactly one reducer today with one action.
- The rules added cognitive load for a solo developer with zero team members who would benefit from portability constraints.

The return on that bet is zero if the port never happens. The exploration confirmed: drop the bet, pay the simplification dividend now, keep the rules that improve TypeScript regardless.

---

## What Changes

### New artifacts

| File | Action |
|---|---|
| `docs/decisions/0010-typescript-native-architecture.md` | CREATE — new ADR superseding 0009 |
| `openspec/changes/archive/tui-async-effects/SUPERSEDED.md` | CREATE — archive note pointing to this change |

### Updated files

| File | Change |
|---|---|
| `docs/decisions/0009-language-portable-architecture.md` | Flip `Status: accepted` → `Status: superseded by 0010`; add short superseding-note section at top pointing to 0010. Body stays intact (immutable record). |
| `docs/decisions/README.md` | Add 0010 entry; mark 0009 as superseded. |
| `docs/house-rules.md` | Partial rewrite per rule disposition table below. Retire header preamble about Go portability. Update rule-by-rule bodies for Rules 7, 8, 9, 10. |
| `docs/architecture.md` | Sweep for portability references; update to reflect TypeScript-native stance. |
| `src/tui/welcome/welcome-reducer.ts` | Signature change: `(state, action) => [State, Effect | null]` → `(state, action) => State`. Remove `Effect` type and `quit` effect. |
| `src/tui/welcome/welcome-reducer.test.ts` | Pure rewrite of assertions to match plain `State` return shape. No compatibility shim (solo project, no external consumers). |
| `src/tui/tui-driver.tsx` | Remove `reactReducer` shim and double-call pattern. Use standard `useReducer`. Add `useKeyboard` quit handler that calls `renderer.destroy() + resolve()` directly inline. |

### Moved/archived

| From | To |
|---|---|
| `openspec/changes/tui-async-effects/` | `openspec/changes/archive/tui-async-effects/` |

---

## What Does NOT Change

- **Domain layer** (`src/domain/`) — untouched. Rule 1 (Result\<T,E\>), Rule 5 (discriminated unions), Rule 6 (branded IDs) all stay.
- **Application layer** (`src/application/`) — untouched. `getPassage` signature stays `Promise<Result<Passage, AppError>>`.
- **Infrastructure / API layer** (`src/api/`) — untouched. Rule 4 (Zod boundary) stays.
- **CLI layer** (`src/cli/`, `src/presentation/`) — untouched.
- **Hexagonal architecture** (ADR 0002) — retained in full. Dependency rule (arrows inward) is non-negotiable regardless of Go portability.
- **`Result<T, E>` across the codebase** — retained. It's better TypeScript independent of Go.
- **99 tests** — must stay green. Only `welcome-reducer.test.ts` gets rewritten; all others stay untouched.
- **No new dependencies** added. Zero additions to `package.json`.

---

## Rule-by-Rule Disposition Table

| # | Rule | Verdict | Justification |
|---|---|---|---|
| 1 | Domain functions return `Result<T,E>`, never throw | **KEEP** | Explicit error flow is best-practice TS regardless of Go. |
| 2 | No `class` outside React components | **KEEP** | Factory functions avoid `this`-binding coupling — a TS concern, not a Go one. |
| 3 | Ports are simple interfaces, no callbacks | **KEEP** | Clean hexagonal port definition. Good design in any language. |
| 4 | Zod stays in `src/api/`; domain imports plain TS types | **KEEP** | ADR 0005 territory. Domain purity is a TS/hexagonal concern. |
| 5 | Errors are discriminated unions with `kind` field | **KEEP** | Best-in-class TS error modeling. Exhaustive switch, no inheritance. |
| 6 | Branded IDs via a single factory | **KEEP** | Already in use. Good discipline; `as Cast` outside the factory is a TS anti-pattern. |
| 7 | No conditional/mapped/template-literal types in domain or application | **LOOSEN** | Rationale was "Go can't follow them." Go rationale is gone. Judgment call: avoid where they obscure intent; allow where they genuinely simplify the model. Blanket ban lifted. |
| 8 | TUI business state in `useReducer`; `useState` for ephemeral UI only | **KEEP (loosened)** | `useReducer` for business state is still excellent TS practice. RETIRE the `[State, Effect \| null]` tuple constraint — it was Bubble Tea parity. Plain `(state, action) => State` is the new signature. |
| 9 | No `useEffect` for business logic; use Effect descriptors + effect-runner | **RETIRE** | Existed purely for Bubble Tea parity (`Effect → tea.Cmd`). Without that constraint, `useEffect` for async fetch is idiomatic React. **Convention replaces the ban**: `useEffect` MUST call application use cases (`getPassage(...)`), never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern. *(See retirement note in `house-rules.md`.)* |
| 10 | TUI action names are past-tense facts | **RETIRE** | PascalCase past-tense was for Bubble Tea `tea.Msg` verbatim porting. Use whatever naming reads clearly in TypeScript. |
| 11 | No decorators | **KEEP** | Decorators are still experimental/unstable. Composition via HOF is better TS practice regardless. |
| 12 | Async data functions return `Promise<Result<T,E>>` | **KEEP** | Rule 1 applied to async. Explicit error propagation across async boundaries — zero Go relevance needed. |

### Rule 9 retirement note (exact text for `house-rules.md`)

> **Retired.** `useEffect` is now permitted for async business logic.
>
> CONVENTION: `useEffect` must call application use cases (`getPassage(...)`), never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern.

This text appears in the body of Rule 9 in `house-rules.md`, replacing the current rule content. It is NOT added as a new Rule 13.

---

## `quit` Handling After Reducer Simplification

**Decision (locked):** inline in `useKeyboard` handler — no state pollution.

The reducer becomes a plain `(state, action) => State` with no knowledge of `quit`. The `useKeyboard` hook in `tui-driver.tsx` intercepts the `q` key and calls `renderer.destroy() + resolve()` directly. No `quitting` state flag, no effect descriptor, no dispatch round-trip.

---

## Welcome Reducer Test Migration

**Decision (locked):** pure rewrite. Solo project, no external consumers, no compatibility shim needed. New tests assert plain `State` shape. Old tuple assertions are deleted, not wrapped.

---

## `tui-async-effects` Archive

**Decision (locked):** move `openspec/changes/tui-async-effects/` → `openspec/changes/archive/tui-async-effects/`. Create `SUPERSEDED.md` noting that the problem (async effects in the TUI) is now solved differently via `useReducer + useEffect + AbortController`, and that `ts-native-architecture` is the governing change. Engram observations (#248) stay as informational context.

---

## First Reviewable Cut

This is a **single PR** — docs-heavy, code-minimal.

Estimated size: **150–250 lines changed**.

Breakdown:
- `docs/decisions/0010-typescript-native-architecture.md` (new, ~80 lines)
- `docs/house-rules.md` (partial rewrite of 4 rules + preamble, ~60 lines net diff)
- `docs/decisions/0009-language-portable-architecture.md` (status flip + 5-line note)
- `docs/decisions/README.md` (2-line index update)
- `docs/architecture.md` (sweep, likely ~10 lines)
- `src/tui/welcome/welcome-reducer.ts` (~15 lines removed/changed)
- `src/tui/welcome/welcome-reducer.test.ts` (~20 lines rewritten)
- `src/tui/tui-driver.tsx` (~20 lines simplified)
- `openspec/changes/archive/tui-async-effects/SUPERSEDED.md` (new, ~5 lines)

The welcome reducer simplification is the only runtime-behavior code change. All other code changes are test updates to match the new signature.

---

## Success Criteria

The change is done when ALL of the following are true:

1. `bun test` passes — 99/99 green.
2. `bun start` shows the welcome screen identically to before.
3. Pressing `q` quits cleanly (same observable behavior, different internal path).
4. `docs/decisions/0010-typescript-native-architecture.md` exists with `Status: accepted`.
5. `docs/decisions/0009-language-portable-architecture.md` has `Status: superseded by 0010`.
6. `docs/house-rules.md` Rule 9 body reads "Retired. `useEffect` is now permitted..." per the exact text above.
7. `docs/house-rules.md` Rule 8 body no longer mandates the `[State, Effect | null]` tuple.
8. `openspec/changes/archive/tui-async-effects/SUPERSEDED.md` exists.
9. No new entries in `package.json` dependencies.

---

## Risks

1. **`useEffect` re-introduction risk**: Without enforcement, async `useEffect` calls might bypass the application layer and call the repository port directly. Mitigation: the Rule 9 retirement text makes the convention explicit. Code review enforces it by name — "Rule 9 convention: call the use case, not the repo."

2. **Welcome reducer test migration**: Tuple-asserting tests will fail until rewritten. This is planned work, not a risk. Strict TDD mode means the test rewrite and reducer change ship together.

3. **ADR discipline**: ADR 0009 is referenced from `house-rules.md` preamble and several rule footers. All references must point to 0010 or be updated to reflect the new stance. Easy to miss one.

4. **`tui-async-effects` confusion**: If the archive move is done but someone reads engram observation #248, they will see the old Effect-runner approach without seeing the SUPERSEDED note. Mitigation: `SUPERSEDED.md` in the archived folder, and the archive move happens in the same PR.

---

## Out of Scope

The following are explicitly deferred and will NOT be implemented in this change:

- **TUI reader feature** — palette overlay, passage view, chapter navigation. This change unlocks the pattern; `tui-reader-screen` will implement it.
- **Any new state-management library** — decision is to stay native (`useReducer + useEffect`). No Zustand, XState, Effect-TS, or Jotai.
- **CLI changes** — `run.ts`, `vod.ts`, CLI layer untouched.
- **API / domain / application layer changes** — all stay identical.
- **New test infrastructure** — no new test utilities or helpers. Only `welcome-reducer.test.ts` changes.

---

## Next Steps After This Lands

Once `ts-native-architecture` is merged:

1. Open new SDD change **`tui-reader-screen`** — implement the reader feature using the freed `useReducer + useEffect + AbortController` pattern now codified by ADR 0010. This change is the direct beneficiary of the architectural simplification.
2. `tui-reader-screen` scope will include: reader screen component, `readerReducer` (plain State), passage fetch via `getPassage` from `useEffect`, keyboard navigation, and the passage/chapter display UI.

---

## References

- [ADR 0009](../../docs/decisions/0009-language-portable-architecture.md) — being superseded
- [ADR 0002](../../docs/decisions/0002-hexagonal-architecture.md) — hexagonal foundation retained
- [ADR 0005](../../docs/decisions/0005-zod-at-boundary.md) — Zod boundary rule (Rule 4) retained
- [Exploration artifact](./explore.md) — full option analysis and cost breakdown
- Engram #252 — `sdd/ts-native-architecture/explore`
