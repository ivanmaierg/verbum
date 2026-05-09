# 0006 — Caching strategy

- Status: accepted
- Date: 2026-05-09

## Context

Bible chapters are immutable data — once fetched, they never change. The Free Use Bible API has no rate limits, but re-fetching the same chapter every session is wasteful and gives users a worse offline experience.

We have three caching strategies to consider:

1. **Lazy filesystem cache** — fetch on demand, write to disk, hit disk on next read
2. **Eager seed** — download the entire translation on first selection
3. **In-memory only** — re-fetch every session

This decision shapes the `Cache` port's behavior, our offline story, and whether v4 (search) is feasible without re-fetching the whole corpus.

## Decision

**Lazy filesystem cache** at `~/.cache/verbum/{translation}/{book}/{chapter}.json`.

Implementation: `CachingBibleRepository` (decorator pattern) wraps the real `HelloAoBibleRepository`. The application layer is unaware caching exists.

```
Application → BibleRepository (port)
                 ↑ implemented by
              CachingBibleRepository ──delegates miss──→ HelloAoBibleRepository → API
                 │
                 └──reads/writes──→ FilesystemCache
```

## Alternatives considered

| Option | Why not (yet) |
|---|---|
| Eager seed on translation pick | Multi-second first-launch cost solves a problem most users don't have. Can be added later as a `verbum sync <translation>` command — same cache, just pre-populated |
| In-memory only | Wastes API resources; offline never works between sessions; bad UX for no architectural simplification |

## Consequences

- **Good:** trivial to implement (~30 lines for the decorator); pattern leaves the rest of the architecture untouched; works offline for chapters previously read; sets up v4 search index without redesign (we can build the FTS index incrementally from cached chapters)
- **Trade-off:** cold reads still hit the network; rarely-visited chapters keep paying the network cost on first access
- **Cache invalidation is a non-concern:** the Bible doesn't change. The only invalidation we need is a manual `verbum cache clear` command. Most caches die from invalidation complexity — we don't have it.
- **Revisit when:**
  - A user explicitly asks for offline-everywhere → ship `verbum sync` (pre-populates the same cache)
  - v4 search lands and needs the full corpus → seed at index time, same cache
  - Disk usage grows unexpectedly large (very unlikely — chapters are KB each)
