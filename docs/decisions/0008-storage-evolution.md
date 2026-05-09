# 0008 — Storage evolution: JSON now, SQLite at v4

- Status: accepted
- Date: 2026-05-09

## Context

Multiple persistence stores are planned across the roadmap:

- **v1** — `PreferencesStore` (last position, default translation, favorite translations)
- **v2** — `BookmarkStore`, `HistoryStore`
- **v4** — `SearchIndex` (requires FTS5)
- **v7** — `NoteStore` (relational queries are valuable here)

Initial instinct was "use SQLite from v2 onward — v4 needs it anyway." That instinct violated one of our core rules: **don't add abstractions beyond what the task requires**.

## Decision

**Use JSON for v1-v3. Migrate to SQLite when v4 lands.**

| Store | v1-v3 | v4+ |
|---|---|---|
| `PreferencesStore` | JSON | JSON (stays — no reason to move) |
| `BookmarkStore` (v2) | JSON | SQLite |
| `HistoryStore` (v2) | JSON | SQLite |
| `SearchIndex` (v4) | — | SQLite FTS5 |
| `NoteStore` (v7) | — | SQLite |

Storage location:

- `~/.config/verbum/preferences.json` — preferences (always JSON)
- `~/.local/share/verbum/bookmarks.json` — bookmarks in v2-v3
- `~/.local/share/verbum/history.json` — history in v2-v3
- `~/.local/share/verbum/data.db` — SQLite database from v4 onward (replaces the JSONs above; FTS5 index, notes, bookmarks, history all live in separate tables)

### Migration at v4

When v4 lands, `BookmarkStore` and `HistoryStore` adapters swap from JSON to SQLite. The migration is contained:

1. Read existing JSON files
2. Write rows to new SQLite tables
3. Atomic swap (rename JSON → `.bak`, activate SQLite)
4. Verify, then delete `.bak`

Estimated implementation: ~50 lines, run-once on first v4 launch. Hexagonal architecture means **use cases don't notice** — the port stays the same, only the adapter swaps.

## Alternatives considered

| Option | Why rejected |
|---|---|
| SQLite from v2 | Forward-engineering; violates "don't add abstractions beyond what the task requires"; introduces schema migration concerns before they pay off |
| JSON forever | v4 search needs FTS5; doing full-text search across thousands of cached chapters with `Array.filter` is a non-starter |
| Multiple SQLite databases (one per store) | More files to manage, no benefit over a single DB with separate tables |
| In-process embedded store (e.g. lowdb, conf) | Adds a dependency for what `JSON.parse` + `Bun.file` already does in 5 lines |

## Consequences

- **Good:** v1-v3 stays radically simple; bookmark file is human-readable and grep-friendly; migration is one contained change at v4; no schema migrations to manage in v2-v3
- **Trade-off:** one-time migration cost at v4 (~50 lines); no rich queries on bookmarks until v4, but `Array.filter` covers what v2 needs (list, filter by book/translation/date)
- **Revisit when:**
  - Bookmarks scale to 100k+ entries (extremely unlikely for a single user)
  - Users start asking for query-driven bookmark views before v4
  - JSON file size on disk becomes a real concern (won't happen at human scale)
