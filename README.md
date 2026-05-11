# verbum

> Read the Bible from your terminal. A TUI + CLI scripture reader, in one binary.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.2+-black?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Architecture](https://img.shields.io/badge/architecture-hexagonal-7C3AED)](docs/architecture.md)
[![Status](https://img.shields.io/badge/status-design%20phase-orange)](#)

A TUI + CLI Bible reader. Built on **Hexagonal (Ports & Adapters)** with a **Screaming** top-level structure, so the API, the TUI, or the runtime can be swapped without touching the domain.

> **Status:** design phase. The architecture, roadmap, user flows, and decision records are complete. Source code lands with v1.

## Two modes, one binary

```bash
verbum                  # launch the full TUI
verbum john 3:16        # one-shot CLI — print passage and exit
verbum john 3:16 --format json
```

Both modes call the same use cases. Only the presentation layer differs.

## Stack

| Layer        | Tech                                                |
|--------------|-----------------------------------------------------|
| Runtime      | Bun 1.2.19+                                         |
| Language     | TypeScript                                          |
| TUI          | `@opentui/core` + `@opentui/react`                  |
| Validation   | Zod (boundary only — never leaks into the domain)   |
| Data         | [Free Use Bible API](https://bible.helloao.org)     |
| Distribution | `bun build --compile` → standalone binary           |

## Architecture in one diagram

```
┌──────────────────────────────────────────────────────┐
│ PRESENTATION (drivers)                               │
│   TUI adapter (OpenTUI/React)  •  CLI adapter (argv) │
└─────────────────────┬────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────────┐
│ APPLICATION (use cases)                              │
│   GetPassage  •  ListTranslations  •  …              │
└─────────────────────┬────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────────┐
│ DOMAIN (the heart) — pure, zero IO, zero deps        │
│   Reference, Passage, Book, Verse, Translation       │
└──────────────────────────────────────────────────────┘
                      ▲ implements ports
┌─────────────────────┴────────────────────────────────┐
│ INFRASTRUCTURE (driven adapters)                     │
│   HelloAoBibleRepository  •  FilesystemCache  •  …   │
└──────────────────────────────────────────────────────┘
```

Arrows point inward. The domain knows nothing about HTTP, OpenTUI, or the filesystem. Full breakdown in [docs/architecture.md](docs/architecture.md).

## Roadmap at a glance

The domain from v1 is meant to keep compiling all the way to v11. New versions **add** ports, adapters, or use cases — they don't rewrite the heart.

| Version | Feature                                                                                |
|---------|----------------------------------------------------------------------------------------|
| v1      | Minimal reader: passages, translations, favorites, last-position memory, format flags  |
| v2      | Bookmarks + reading history                                                            |
| v3      | Reading plans                                                                          |
| v4      | Local full-text search (SQLite FTS5)                                                   |
| v5      | Side-by-side translation comparison                                                    |
| v6      | Cross-references + footnotes                                                           |
| v7      | Personal notes + highlights                                                            |
| v8      | Export/share (markdown, plain, image)                                                  |
| v9      | Audio playback                                                                         |
| v10     | Sync across machines                                                                   |
| v11     | MCP server — expose use cases as LLM tools                                             |

Full details, principles, and the test the roadmap must pass: [docs/roadmap.md](docs/roadmap.md).

## Documentation

| Doc                                        | Purpose                                                                |
|--------------------------------------------|------------------------------------------------------------------------|
| [architecture.md](docs/architecture.md)    | Layers, ports, domain model, tech stack                                |
| [roadmap.md](docs/roadmap.md)              | v1 through v11: what each version adds                                 |
| [user-flow.md](docs/user-flow.md)          | How users move through the app — journeys, intents, modes              |
| [ui-sketches.md](docs/ui-sketches.md)      | ASCII mockups, style legend, layout rules, CLI output formats          |
| [house-rules.md](docs/house-rules.md)      | The 12 enforceable code-review rules that keep the architecture clean  |
| [decisions/](docs/decisions/)              | Architecture Decision Records — the *why* behind every major choice    |

## Reading order

1. **architecture.md** — the shape of the system.
2. **user-flow.md** — how users move through it.
3. **roadmap.md** — where it's going.
4. **house-rules.md** — skim before writing TypeScript.
5. **decisions/** — open when you ask "why was it built this way?".

## License

[MIT](LICENSE)
