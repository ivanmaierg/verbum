# 0009 — Language-portable architecture (Go-port readiness)

- Status: accepted
- Date: 2026-05-09

## Context

`verbum` is built on TypeScript + Bun + OpenTUI/React (see [ADR 0001](0001-runtime-and-tui-stack.md)). The user wants to keep the option to port to Go (with Bubble Tea for the TUI) open as a future possibility. Files would be rewritten, but the architecture, types, and patterns should translate cleanly — **mechanical translation, not redesign**.

Hexagonal (see [ADR 0002](0002-hexagonal-architecture.md)) already gives us most of the win, because it's language-agnostic by design. The risk is that idiomatic TypeScript habits — thrown exceptions, `this`-bound classes, conditional types, async generators, `useEffect`-driven side effects — don't translate to Go and would force a redesign rather than a transcription.

We need to constrain how we write TypeScript so the architecture survives a port.

## Decision

Adopt a **portability-first dialect of TypeScript** across all layers, codified in [`docs/house-rules.md`](../house-rules.md) as 12 enforceable code-review rules.

The dialect's core constraints:

1. **No exceptions** in domain or application — return `Result<T, E>`
2. **No `class`** outside `src/tui/` React components — use functions and plain factories
3. **Ports are simple interfaces** — primitive/struct args, no callbacks, no observables
4. **Zod stays in `src/api/`** — domain imports plain TS types
5. **Errors are discriminated unions** with a `kind` field — no class hierarchies
6. **No advanced TS types** (conditional/mapped/template-literal) in domain or application
7. **TUI business state in `useReducer`** — `useState` is for ephemeral UI noise only
8. **No `useEffect` for business logic** — side effects are reducer-returned `Effect` descriptors run by a top-level effect runner
9. **Action names are past-tense facts** (`ChapterLoaded`, `KeyPressed`) — port verbatim to Bubble Tea `tea.Msg`
10. **No decorators** — composition is explicit higher-order functions
11. **Branded IDs** via a single factory — no `as BookId` casts elsewhere
12. **All async data functions** return `Promise<Result<T, E>>` — never bare `Promise<T>`

Full examples and rationale per rule live in `house-rules.md`.

## Portability assessment per layer

Based on a research investigation:

| Layer | Port effort | Why |
|---|---|---|
| Domain | ~95% mechanical | Pure functions, value objects, branded types map 1:1 to Go |
| Application | ~90% mechanical | Use cases as functions; `Promise<Result<T, E>>` → `(T, error)` is direct |
| Infrastructure | ~80% mechanical | Stdlib swap (`fetch` → `net/http`, Zod → `encoding/json` + `Validate()`) |
| Presentation (CLI) | ~85% mechanical | argv parser swap; output formatters port directly |
| Presentation (TUI) | ~30% mechanical | React → Bubble Tea is paradigm-different, **but with rules 7–10 the *shape* survives** and the rewrite becomes transcription |

The TUI is the only layer that's fully rewritten in a port. Rules 7–10 are specifically designed so that the *state/message/effect shape* of the React TUI matches Bubble Tea's `(Model, Msg) → (Model, Cmd)` exactly. Get that shape right now and the future port is days, not weeks.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Don't constrain — write idiomatic TypeScript | TS idioms (exceptions, `useEffect`, classes, decorators) make the TUI port a redesign, not a transcription. Defeats the whole point. |
| Constrain only the domain, allow idiomatic TS in TUI | The TUI is the *hardest* layer to port. Skipping the constraints there is exactly the wrong place to relax. |
| Just use Go from day one | Defeats the user's stated goal of learning OpenTUI. The right call is to learn OpenTUI **and** keep the option open. |
| Pick a different portability target (Rust, Zig) | Go was named explicitly because of Bubble Tea; rules optimized for Go don't all transfer to other targets. If the target changes, the rules get re-derived. |

## Consequences

- **Good:**
  - Future Go port becomes a transcription job, not a rewrite
  - The `Result<T, E>` discipline produces better TypeScript anyway — explicit errors, no hidden control flow via thrown exceptions
  - The `useReducer` + `Effect` TUI architecture is testable in isolation (no DOM/render needed for state-flow tests)
  - Rules give us a vocabulary for code review — "Rule 9, please" beats long explanations
- **Trade-off:**
  - Writing React this way fights idiom — particularly Rule 9 (no `useEffect` for business logic). Most React devs reach for `useEffect` instinctively.
  - Some upfront friction for new contributors who haven't internalized the dialect
  - The `Result<T, E>` type is one extra concept to teach
- **Revisit when:**
  - OpenTUI ships native Go bindings that make a TUI port trivial regardless of how we wrote the React side (Rule 9 becomes unnecessary)
  - The team explicitly drops the Go-port option (then the dialect can relax)
  - A specific rule turns out to block legitimate work — re-examine the rule rather than ignoring it

## See also

- [`house-rules.md`](../house-rules.md) — the 12 rules with concrete examples per rule
- [ADR 0002](0002-hexagonal-architecture.md) — the Hexagonal foundation this builds on
- [ADR 0005](0005-zod-at-boundary.md) — the "Zod stays in `src/api/`" rule started here, generalized in this ADR
