# 0004 — Free Use Bible API as data source

- Status: accepted
- Date: 2026-05-09

## Context

We need a Bible data source that:

- Is free with no auth requirements (this is a learning project)
- Has a permissive license (no copyright friction now or later)
- Supports multiple translations
- Returns clean JSON

## Decision

Use the **Free Use Bible API** by AO Lab — `https://bible.helloao.org`.

Endpoints:

- `GET /api/available_translations.json` — list all translations
- `GET /api/{translation}/books.json` — list books for a translation
- `GET /api/{translation}/{book}/{chapter}.json` — chapter content with verses + footnotes

There is **no per-verse endpoint** — chapter responses are filtered client-side for verse-range queries.

## Alternatives considered

| Option | Why rejected |
|---|---|
| `wldeh/bible-api` | Static JSON files served from GitHub; works but the request shape isn't a real REST API and updates are slower |
| `bible-api.com` | Public-domain translations only (KJV, ASV, etc.); rate-limited to 15 req / 30s; too narrow a catalog |
| `api.esv.org` | Requires API key; ESV-only; commercial restrictions limit reusability |

## Consequences

- **Good:** 1000+ translations, no auth, no rate limits, no copyright friction (commercial use OK), AWS-hosted with global low latency, audio links and cross-references included in responses (relevant for v6 and v9)
- **Trade-off:** no per-verse endpoint — chapter response must be filtered client-side for ranges; relatively young project (active development through 2026)
- **Revisit when:**
  - helloao.org goes down or significantly degrades
  - We need translations the API doesn't carry
  - Per-verse latency becomes a problem (currently negligible because of caching)
