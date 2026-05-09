# Architecture Decision Records

ADRs capture significant architectural decisions, the alternatives considered, and the conditions that would trigger a revisit.

## Index

| ID | Title | Status | Date |
|---|---|---|---|
| [0001](0001-runtime-and-tui-stack.md) | Runtime and TUI stack | accepted | 2026-05-09 |
| [0002](0002-hexagonal-architecture.md) | Hexagonal architecture | accepted | 2026-05-09 |
| [0003](0003-single-package-not-monorepo.md) | Single package, not a monorepo | accepted | 2026-05-09 |
| [0004](0004-bible-api-helloao.md) | Free Use Bible API as data source | accepted | 2026-05-09 |
| [0005](0005-zod-at-boundary.md) | Zod for boundary validation | accepted | 2026-05-09 |
| [0006](0006-caching-strategy.md) | Caching strategy | accepted | 2026-05-09 |
| [0007](0007-output-formatters.md) | Output formatters / presenter pattern | accepted | 2026-05-09 |
| [0008](0008-storage-evolution.md) | Storage evolution: JSON now, SQLite at v4 | accepted | 2026-05-09 |
| [0009](0009-language-portable-architecture.md) | Language-portable architecture (Go-port readiness) | accepted | 2026-05-09 |

## Format

Each ADR follows MADR-lean:

- **Status** — `accepted` | `proposed` | `superseded by NNNN`
- **Context** — forces, constraints, what we're solving
- **Decision** — the chosen option, stated plainly
- **Alternatives considered** — table of options with reasons for rejection
- **Consequences** — good, trade-off, and **revisit when** (the conditions that would trigger re-evaluation)

## Why these exist

Six months from now, when someone asks "why TypeScript instead of Go?" or "why aren't we using a monorepo?", the answer is in the relevant ADR — with the alternatives we weighed and the conditions under which the decision should be reopened. Decisions stay reversible because we wrote down what would change our mind.
