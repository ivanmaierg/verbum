# 0002 — Hexagonal architecture

- Status: accepted
- Date: 2026-05-09

## Context

Two presentation drivers (CLI and TUI) need to share the same business logic and talk to one external service (the Bible API). Caching, persistence, and search are likely to evolve over the roadmap. We need an architecture that:

- Keeps domain logic pure and testable
- Allows swapping the API or rewriting the TUI without touching business logic
- Scales by addition, not modification

## Decision

Adopt **Hexagonal (Ports & Adapters)** with four layers:

1. **Domain** — pure logic, zero IO, zero deps
2. **Application** — use cases that orchestrate domain + ports
3. **Infrastructure** — driven adapters that implement ports (HTTP, filesystem)
4. **Presentation** — driver adapters (TUI, CLI)

The dependency rule: **arrows point inward**. Domain imports nothing.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Flat single-file CLI | Fast to write, but impossible to test domain logic in isolation, and the second presentation (TUI) duplicates everything |
| MVC | Doesn't model "two consumers, one external service" — it's a web pattern |
| Layered (no ports) | Hides the dependency direction; refactors leak between layers because nothing enforces the boundary |

## Consequences

- **Good:** domain testable without mocking HTTP; new features add ports rather than rewrite layers; CLI and TUI share use cases verbatim; refactoring the API client is contained
- **Trade-off:** more files for v1 than a flat structure; discipline required to not let infrastructure types leak into the domain (Zod schemas in particular must stay in `src/api/`)
- **Revisit when:** the indirection genuinely costs more than it saves — currently far from that point because the domain has real complexity (reference parsing, book aliasing, range queries)
