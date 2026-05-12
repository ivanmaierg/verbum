# 0010 — TypeScript-native architecture (Go-port commitment dropped)

- Status: accepted
- Date: 2026-05-11
- Supersedes: [0009](0009-language-portable-architecture.md)

## Context

ADR 0009 (accepted 2026-05-09) placed verbum on a "portability-first dialect of TypeScript." The bet was explicit: accept friction from Rules 7–10 today in exchange for a future mechanical port to Go + Bubble Tea. Rules 7–10 were specifically designed so that the React TUI's state/message/effect shape would mirror Bubble Tea's `Update(msg) (Model, Cmd)` exactly.

That bet is being called off. The user's own words:

> "I believe that we can drop that and we can focus into making a really good TypeScript React application."

The Go-port option is no longer a design motivation. With it gone, Rules 7–10 lose their only justification. Rules 1–6, 11, and 12 stand on TypeScript merit alone and are retained unchanged.

## Decision

Drop the Go-port dialect. Adopt a TypeScript-native dialect that keeps the architectural backbone (hexagonal, `Result<T,E>`, discriminated-union errors, branded IDs, port simplicity) and retires the Bubble Tea parity rules.

Concretely:

- **Rules 9 and 10 are retired.** `useEffect` is now permitted for async business logic. Action naming is free.
- **Rule 8 is loosened.** `useReducer` for business state remains mandatory; the `[State, Effect | null]` tuple return is not. Plain `(state, action) => State` is the new signature.
- **Rule 7 is loosened.** The blanket ban on conditional/mapped/template-literal types in domain and application is lifted. Judgment call: allow where they genuinely simplify the type model; avoid where they obscure intent or leak across layer boundaries.
- **Rules 1, 2, 3, 4, 5, 6, 11, 12 are kept unchanged** in substance; their Go-port footnotes are removed.

The governing convention replacing Rule 9's ban:

> **`useEffect` must call application use cases, never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern.**

## Rule disposition

| # | Rule summary | Verdict | Justification |
|---|---|---|---|
| 1 | Domain functions return `Result<T,E>`, never throw | **KEEP** | Explicit error flow is best-practice TS regardless of Go. |
| 2 | No `class` outside React components | **KEEP** | Factory functions avoid `this`-binding coupling — a TS concern, not a Go one. |
| 3 | Ports are simple interfaces, no callbacks | **KEEP** | Clean hexagonal port definition. Good design in any language. |
| 4 | Zod stays in `src/api/`; domain imports plain TS types | **KEEP** | ADR 0005 territory. Domain purity is a TS/hexagonal concern. |
| 5 | Errors are discriminated unions with `kind` field | **KEEP** | Best-in-class TS error modeling. Exhaustive switch, no inheritance. |
| 6 | Branded IDs via a single factory | **KEEP** | Already in use. `as Cast` outside the factory is a TS anti-pattern. |
| 7 | No conditional/mapped/template-literal types in domain or application | **LOOSEN** | Rationale was "Go can't follow them." Go rationale is gone. Judgment call: avoid where they obscure intent; allow where they genuinely simplify the model. Blanket ban lifted. |
| 8 | TUI business state in `useReducer`; `useState` for ephemeral UI only | **KEEP (loosened)** | `useReducer` for business state is still excellent TS practice. `[State, Effect \| null]` tuple constraint retired — it was Bubble Tea parity. Plain `(state, action) => State` is the new signature. |
| 9 | No `useEffect` for business logic; use Effect descriptors + effect-runner | **RETIRE** | Existed purely for Bubble Tea parity (`Effect → tea.Cmd`). Without that constraint, `useEffect` for async fetch is idiomatic React. Convention replaces the ban: `useEffect` MUST call application use cases, never repository ports or adapters directly. |
| 10 | TUI action names are past-tense facts | **RETIRE** | PascalCase past-tense was for Bubble Tea `tea.Msg` verbatim porting. Use whatever naming reads clearly in TypeScript. |
| 11 | No decorators | **KEEP** | Decorators are still experimental/unstable. Composition via HOF is better TS practice regardless. |
| 12 | Async data functions return `Promise<Result<T,E>>` | **KEEP** | Rule 1 applied to async. Explicit error propagation across async boundaries — zero Go relevance needed. |

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Zustand** (+~1KB gzipped) | Action-method style blurs the boundary between application and presentation. Temptation to put use-case logic inside store actions rather than delegating to `getPassage()`. Architecture erosion risk for no meaningful ergonomic gain given verbum's size. |
| **Effect-TS** (+~20KB gzipped) | Replaces `Promise<Result<T,E>>` with `Effect<A,E,R>` across the entire codebase — a full rewrite of the error model. Learning curve dominates everything else for a solo developer. Overkill for a single-screen TUI with one async operation. |
| **XState v5** (+~17KB gzipped) | First-class state machines are most valuable when transitions are complex and non-obvious. verbum has one screen today, two or three expected. Premature abstraction; steep learning curve for no current gain. |

## Consequences

**Gets simpler:**
- `useEffect` is permitted for async business logic in `src/tui/`. No Effect descriptor, no effect-runner switch.
- Reducer signature is plain `(state, action) => State`. No tuple return, no shim layer in `tui-driver.tsx`.
- Action naming is free — no enforced PascalCase past-tense constraint.
- Advanced TS types (`Conditional<T>`, mapped types, template literals) can be used where they genuinely help, subject to code review judgment.

**Gets a new convention:**
- `useEffect` may only call application use cases (e.g. `getPassage(repo, ref)`), never repository ports or adapters directly. Bypassing the use-case layer in a `useEffect` body is a review-blocker under Rule 9's retirement text.

**Retained intact:**
- Hexagonal architecture (ADR 0002) — dependency rule is non-negotiable.
- `Result<T,E>` across domain and application.
- Discriminated-union errors with `kind` field.
- Branded IDs via factory.
- Port simplicity (no callbacks, no observables).
- `bun test` count: ≥ 99 tests, all passing.

## See also

- [`docs/house-rules.md`](../house-rules.md) — revised with full rule dispositions
- [ADR 0002](0002-hexagonal-architecture.md) — hexagonal architecture, still load-bearing
- [ADR 0009](0009-language-portable-architecture.md) — superseded by this decision
