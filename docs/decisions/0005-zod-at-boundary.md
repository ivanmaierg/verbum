# 0005 — Zod for boundary validation

- Status: accepted
- Date: 2026-05-09

## Context

External JSON from the Bible API needs to enter the domain as trusted, typed data. Two options:

- Manual TypeScript types + `as` casts (no runtime check; types and reality can drift)
- Schema-based parsing at the infrastructure boundary

In a hexagonal app, **the infrastructure adapter is responsible for translating untrusted external data into trusted domain types**. That's a parsing job, not a casting job.

## Decision

Use **Zod** as the boundary parser inside `src/api/` only.

- Define schemas for every API response shape
- Infer TypeScript types from the schemas (`z.infer<typeof BookSchema>`)
- Use **branded types** for IDs: `z.string().brand<"BookId">()`, `z.string().brand<"TranslationId">()` — they cannot be swapped at the type level
- The adapter parses raw JSON → returns domain value objects

**Rule:** Zod schemas never leak out of `src/api/`. The domain layer imports plain TypeScript types only — never `z.infer<...>` directly.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Manual `as` casts | No runtime safety; types and runtime can drift silently; one bad API change can corrupt the entire domain |
| `io-ts` | Functional / fp-ts style is less ergonomic for this codebase; smaller ecosystem |
| `valibot` | Smaller bundle, but Zod's type inference and ecosystem are richer for v1; bundle size doesn't matter for a CLI |
| `arktype` | Powerful but newer; Zod is the safer default for a learning project |

## Consequences

- **Good:** malformed API responses fail loudly at the boundary, never inside the domain; types and validators stay in sync (one source); branded IDs prevent whole categories of bugs (passing a `TranslationId` where a `BookId` is expected fails to compile)
- **Trade-off:** Zod parsing adds runtime cost (negligible at our scale); schemas double as documentation but require updates when the API evolves
- **Revisit when:** API responses become large enough that parse cost matters (well above current scale) **or** we need streaming JSON responses (Zod doesn't stream well)
