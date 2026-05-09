# Roadmap

`verbum` is designed so each version **adds** to the previous — never rewrites the domain. If a future feature would force a domain rewrite, we either got v1 boundaries wrong or the feature belongs in a new bounded context.

## Guiding principles

- **Domain is sacred.** Existing value objects don't get mutated by new features — they get extended or composed with new ones.
- **Adds, not rewrites.** Every new capability is a new port, a new adapter, or a new use case.
- **Single binary throughout.** No matter how many features ship, distribution stays one CLI binary.

## Versions

| Version | Feature | New use cases | New ports | Domain change |
|---|---|---|---|---|
| **v1** | Minimal reader (passages by reference, switch translations, **favorite translations** for quick access, last-position memory, `--format text\|json\|markdown` for one-shot CLI, **mouse + keyboard input**) | `GetPassage`, `ListTranslations`, `ToggleFavoriteTranslation`, `RememberLastPosition` | `BibleRepository`, `Cache`, `PreferencesStore`, `OutputFormatter` | foundational types |
| **v2** | Bookmarks + reading history (JSON-backed) | `AddBookmark`, `ListBookmarks`, `GetHistory` | `BookmarkStore`, `HistoryStore` (JSON adapters) | adds `Bookmark` |
| **v3** | Reading plans (track progress through books or year-long plans) | `StartPlan`, `MarkChapterRead`, `GetPlanProgress` | `ReadingPlanStore` | adds `ReadingPlan`, `PlanProgress` |
| **v4** | Local full-text search across cached chapters; migrate `BookmarkStore` and `HistoryStore` JSON → SQLite (see [ADR 0008](decisions/0008-storage-evolution.md)) | `SearchText` | `SearchIndex` → `SqliteFtsIndex` (FTS5); SQLite adapters for bookmarks/history | adds `SearchQuery`, `SearchResult` |
| **v5** | Multi-translation side-by-side comparison | `GetParallelPassage` | none — composes `BibleRepository` | adds `ParallelPassage` |
| **v6** | Cross-references + footnotes UI | `GetCrossReferences` | extends `BibleRepository` (API already returns these) | adds `CrossReference`, `Footnote` |
| **v7** | Personal notes + highlights | `AddNote`, `HighlightVerse`, `GetNotes` | `NoteStore` (likely SQLite) | adds `Note`, `Highlight` |
| **v8** | Export/share (markdown, plain, image) | `ExportPassage` | `Exporter` → multiple format adapters | adds `ExportFormat` |
| **v9** | Audio playback (helloao.org returns audio links) | `PlayPassageAudio` | `AudioPlayer` → `SystemAudioAdapter` | adds `AudioTrack` |
| **v10** | Sync across machines | `SyncPreferences` | `SyncTransport` (e.g. git-backed) | none — preferences already persisted |
| **v11** | LLM tool integration: `verbum mcp` runs as an MCP server exposing use cases as tools (Claude / agents can look up passages); machine-readable command docs; structured output schema stays stable across versions | `RunAsMcpServer` | `McpTransport` (new presentation adapter) | none — uses existing use cases verbatim |

## What is *not* on this roadmap

- **Web/server version** — different deployment model. If we want it, we extract domain + application + infrastructure into a shared package and add `presentation/web`. *That's* when a monorepo earns its keep.
- **Real-time collab** — not what a CLI is for.
- **Plugin system** — premature. Revisit only if real users ask.

## The test the roadmap must pass

For every new version, the domain types from v1 should still compile and behave the same. If a new feature requires a breaking change to `Reference`, `Passage`, `Book`, `Verse`, or `Translation` — stop and ask whether the architecture got it wrong, or whether the feature is actually a new bounded context.
