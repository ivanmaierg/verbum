# Architecture

`verbum` is a TUI + CLI Bible reader built on **Hexagonal (Ports & Adapters)** with a **Screaming** top-level structure. The architecture isolates pure domain logic from any framework, runtime, or external service so that swapping the API, rewriting the TUI, or adding new consumers (web, server) is contained — never a redesign.

## Dependency rule

Arrows point inward. The domain knows nothing about HTTP, OpenTUI, the filesystem, or any framework. Infrastructure depends on the domain (it implements its ports). Presentation depends on the application. **Never** the reverse.

## Layers

```
┌──────────────────────────────────────────────────────┐
│ PRESENTATION (drivers)                               │
│   TUI adapter (OpenTUI/React)  •  CLI adapter (argv) │
└─────────────────────┬────────────────────────────────┘
                      │ calls use cases
                      ▼
┌──────────────────────────────────────────────────────┐
│ APPLICATION (use cases)                              │
│   GetPassage  •  ListTranslations                    │
│   RememberLastPosition (orchestrates ports)          │
└─────────────────────┬────────────────────────────────┘
                      │ depends on PORTS only
                      ▼
┌──────────────────────────────────────────────────────┐
│ DOMAIN (the heart)                                   │
│   Reference, Passage, Book, Verse, Translation       │
│   ReferenceParser, BookCatalog                       │
│   Pure. Zero IO. Zero deps.                          │
└──────────────────────────────────────────────────────┘
                      ▲ implements ports
                      │
┌─────────────────────┴────────────────────────────────┐
│ INFRASTRUCTURE (driven adapters)                     │
│   HelloAoBibleRepository (HTTP + Zod)                │
│   FilesystemCache  •  JsonPreferencesStore           │
└──────────────────────────────────────────────────────┘
```

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Bun 1.2.19+ |
| Language | TypeScript |
| TUI | `@opentui/core` + `@opentui/react` |
| Validation | Zod (boundary only — never leaks into domain) |
| Data source | Free Use Bible API (`https://bible.helloao.org`) |
| Distribution | `bun build --compile` → standalone binary |

## Ports

| Port | Responsibility | v1 adapter |
|---|---|---|
| `BibleRepository` | `getTranslations`, `getBooks`, `getChapter` | `HelloAoBibleRepository` (HTTP + Zod parsing) |
| `Cache<K, V>` | Read-through cache for immutable Bible data | `FilesystemCache` (decorates the repository) |
| `PreferencesStore` | Persist last-read passage, default translation | `JsonPreferencesStore` (`~/.config/verbum/preferences.json`) |

## Domain model

| Type | Kind | Notes |
|---|---|---|
| `Reference` | Value object | `{ book: BookId, chapter: int, verses?: Range }` — parsed from "john 3:16" |
| `BookId` | Branded string | `z.string().brand<"BookId">()` — e.g. `"GEN"`, `"JHN"` |
| `BookCatalog` | Pure service | Canonical list + alias map (`"john"` → `"JHN"`, `"1cor"` → `"1CO"`) |
| `Passage` | Aggregate | `{ reference, translation, verses[] }` — what users actually want |
| `Translation` | Value object | `{ id, name, language, ... }` |
| `ReferenceParser` | Pure function | `string → Reference \| ParseError` — the core parsing logic |

## Folder layout

```
verbum/
├── docs/                      # this directory
├── src/
│   ├── index.tsx              # entry — routes between CLI and TUI mode
│   ├── domain/                # pure logic — zero deps
│   ├── application/           # use cases
│   ├── api/                   # Zod schemas + HelloAoBibleRepository
│   ├── infrastructure/        # FilesystemCache, JsonPreferencesStore
│   ├── tui/                   # OpenTUI components
│   └── cli/                   # argv parsing for one-shot mode
├── package.json
├── tsconfig.json
└── README.md
```

## Dual-mode entry

- `verbum` (no args) → launch full TUI
- `verbum <reference>` → print passage and exit (one-shot CLI)

Both modes go through the same use cases. The presentation layer is the only thing that differs.

## Boundary discipline (Zod)

Zod schemas live in `src/api/` only. They parse untrusted JSON from the API into branded domain types. The application and domain layers see plain TypeScript types — never `z.infer<...>` directly. This keeps the validation library replaceable and the domain pure.
