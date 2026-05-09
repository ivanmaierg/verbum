# 0007 — Output formatters / presenter pattern

- Status: accepted
- Date: 2026-05-09

## Context

The CLI mode needs to support multiple output formats:

- `text` (default, TTY-aware): colors when interactive, plain when piped
- `json`: structured, schema-stable, for scripting and LLM tool use
- `markdown`: paste-friendly for notes, READMEs, or LLM redisplay

We need a way to add formats without scattering format-specific code through the application layer or the CLI entry point. We also want this pattern to extend cleanly into v11 (LLM/MCP integration), which needs to emit MCP-protocol responses for the same use cases.

## Decision

Apply the **Presenter pattern**: introduce an `OutputFormatter` port at the presentation layer.

- Use cases return rich domain data (`Passage`, `Translation`, etc.)
- The CLI entry resolves a formatter based on `--format` (and TTY detection)
- The formatter renders the domain data as text / JSON / markdown
- Formatters live in `src/cli/formatters/` (presentation layer)

```
GetPassage use case → Passage (domain)
                          │
                          ▼
                    OutputFormatter (port)
                          │
              ┌───────────┼────────────┬──────────────┐
              ▼           ▼            ▼              ▼
            TextTty    TextPlain     Json         Markdown
                                                       │
                                              (later) MCP transport
```

The JSON output schema is **stable** — once shipped, it does not break across versions. Adding fields is OK; renaming or removing requires a major version bump. This is what makes the JSON format usable for LLM tool integration in v11.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Switch on `--format` inline in `index.tsx` | Doesn't scale; format-specific logic creeps everywhere; impossible to add MCP without a refactor |
| Format inside the use case | Couples application layer to presentation; violates the dependency rule |
| Single template engine (e.g. Handlebars) | Overkill; we have 4 formats and they're structurally different (especially JSON vs text) |

## Consequences

- **Good:** new formats add a new formatter file with zero domain or application changes; v11 MCP server becomes "just another formatter + transport"; LLM tool integration is enabled by the stable JSON output from day one
- **Trade-off:** small upfront indirection; one more concept (the formatter port) to learn before contributing
- **Revisit when:** we get more than ~6 formats and configuration complexity outgrows simple switch-cases (unlikely) **or** the JSON schema needs a breaking change, in which case we version the format (`--format json:v2`)
