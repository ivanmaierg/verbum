# 0003 — Single package, not a monorepo

- Status: accepted
- Date: 2026-05-09

## Context

We have one deployable artifact (the CLI binary). We considered Bun workspaces + Turborepo to separate hypothetical `core`, `tui`, and `cli` packages.

## Decision

Stay as a **single package**. Organize by folders within `src/`. No workspaces, no Turborepo.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Bun workspaces (multi-package) | Adds friction with zero current return — only one consumer of the code today |
| Turborepo | Build orchestration we don't need; CLI builds are simple, no caching pipeline justifies the dependency |

## Consequences

- **Good:** faster setup, simpler dependency graph, easier to refactor across files
- **Trade-off:** when a second consumer emerges (web UI, npm-published client, server) we'll have to extract — but that's a contained refactor (~1 hour) thanks to hexagonal layering
- **Revisit when:** any of:
  - We ship a web UI sharing the domain
  - We want to publish the API client as a standalone npm package
  - We add a server component (sync, multi-device, etc.)

> Note: the user originally suggested "Turbopack" — that's the Vercel bundler, not the monorepo tool. The monorepo equivalent is **Turborepo**. Different products entirely.
