# 0001 — Runtime and TUI stack

- Status: accepted
- Date: 2026-05-09

## Context

`verbum` is a CLI tool with a rich TUI mode. We need to choose:

- A runtime (Node, Bun, Go, Rust)
- A TUI library
- A language that supports clean architecture and ergonomic testing

The user's primary goal for this project is **learning OpenTUI**. Distribution is a secondary concern.

## Decision

- **Runtime:** Bun 1.2.19+
- **Language:** TypeScript
- **TUI:** `@opentui/core` + `@opentui/react`
- **Compile target:** standalone binary via `bun build --compile`

## Alternatives considered

| Option | Why rejected |
|---|---|
| Go + Bubble Tea | Better distribution story (~7 MB static binary, mature ecosystem powering GitHub CLI / Lazygit / Glow) but defeats the learning goal |
| Rust + Ratatui | Smallest and fastest binary, but distribution wasn't the priority and the learning curve is steeper |
| Node + Ink | Solid combination, but the user wanted Bun for the modern-stack experience |

## Consequences

- **Good:** React mental model for the TUI; Zod and `tsx` work natively in Bun; fast HMR for development; no compile step in dev
- **Trade-off:** `bun build --compile` produces a ~50–90 MB binary because it embeds the Bun runtime; OpenTUI is young (~1 year old) and may have rough edges
- **Revisit when:**
  - Distribution becomes the priority (broad public release)
  - OpenTUI development stalls or breaks compatibility
  - A second consumer (web/server) needs to share code, in which case we may also revisit ADR 0003
