# verbum — Documentation

This directory holds the design and decision history for `verbum`.

## Where to find things

| Doc | Purpose |
|---|---|
| [architecture.md](architecture.md) | The current design — layers, ports, domain model, tech stack |
| [roadmap.md](roadmap.md) | v1 through v10: what each version adds |
| [user-flow.md](user-flow.md) | How users interact with the app — journeys, intents, modes |
| [ui-sketches.md](ui-sketches.md) | Visual design — ASCII mockups, style legend, layout rules, CLI output formats |
| [house-rules.md](house-rules.md) | The 12 enforceable code-review rules that keep the architecture portable to Go |
| [decisions/](decisions/) | Architecture Decision Records (ADRs) — the *why* behind every major choice |

## Reading order

1. Start with **architecture.md** for the shape of the system.
2. Read **user-flow.md** to see how users move through it.
3. Open **roadmap.md** to see where it's going.
4. Skim **house-rules.md** before writing TypeScript — these constraints keep a future Go port mechanical.
5. Dive into **decisions/** when you ask "why was it built this way?".
