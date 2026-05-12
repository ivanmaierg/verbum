# Design: ts-native-architecture

- Status: accepted
- Date: 2026-05-11
- Change: ts-native-architecture
- Phase: design

---

## Executive Summary

The concrete technical playbook for the apply phase. Three categories of work: (A) documentation surgery — ADR 0010 creation, ADR 0009 status flip, README index, house-rules rewrite; (B) code simplification — welcome-reducer tuple → plain state, tui-driver shim removal, inline quit handler; (C) archive move — tui-async-effects relocated under `openspec/changes/archive/`. All under strict TDD order.

---

## Section 1 — ADR 0010: Full Content

Create `docs/decisions/0010-typescript-native-architecture.md` with the content below (verbatim — apply agent must not paraphrase).

```markdown
# 0010 — TypeScript-native architecture (Go-port commitment dropped)

- Status: accepted
- Date: 2026-05-11
- Supersedes: [0009](0009-language-portable-architecture.md)

## Context

ADR 0009 (accepted 2026-05-09) placed verbum on a "portability-first dialect of TypeScript." The bet was explicit: accept friction from Rules 7–10 today in exchange for a future mechanical port to Go + Bubble Tea. Rules 7–10 were specifically designed so that the React TUI's state/message/effect shape would mirror Bubble Tea's `Update(msg) (Model, Cmd)` exactly.

That bet is being called off. The user's own words:

> "I believe that we can drop that and we can focus into making a really good TypeScript React application."

The Go-port option is no longer a design motivation. With it gone, Rules 7–10 lose their only justification. Rules 1–6, 11, and 12 stand on TypeScript merit alone and are retained unchanged.

## Decision

Drop the Go-port dialect. Adopt a TypeScript-native dialect that keeps the architectural backbone (hexagonal, `Result<T,E>`, discriminated-union errors, branded IDs, port simplicity) and retires the Bubble Tea parity rules.

Concretely:

- **Rules 9 and 10 are retired.** `useEffect` is now permitted for async business logic. Action naming is free.
- **Rule 8 is loosened.** `useReducer` for business state remains mandatory; the `[State, Effect | null]` tuple return is not. Plain `(state, action) => State` is the new signature.
- **Rule 7 is loosened.** The blanket ban on conditional/mapped/template-literal types in domain and application is lifted. Judgment call: allow where they genuinely simplify the type model; avoid where they obscure intent or leak across layer boundaries.
- **Rules 1, 2, 3, 4, 5, 6, 11, 12 are kept unchanged** in substance; their Go-port footnotes are removed.

The governing convention replacing Rule 9's ban:

> **`useEffect` must call application use cases, never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern.**

## Rule disposition

| # | Rule summary | Verdict | Justification |
|---|---|---|---|
| 1 | Domain functions return `Result<T,E>`, never throw | **KEEP** | Explicit error flow is best-practice TS regardless of Go. |
| 2 | No `class` outside React components | **KEEP** | Factory functions avoid `this`-binding coupling — a TS concern, not a Go one. |
| 3 | Ports are simple interfaces, no callbacks | **KEEP** | Clean hexagonal port definition. Good design in any language. |
| 4 | Zod stays in `src/api/`; domain imports plain TS types | **KEEP** | ADR 0005 territory. Domain purity is a TS/hexagonal concern. |
| 5 | Errors are discriminated unions with `kind` field | **KEEP** | Best-in-class TS error modeling. Exhaustive switch, no inheritance. |
| 6 | Branded IDs via a single factory | **KEEP** | Already in use. `as Cast` outside the factory is a TS anti-pattern. |
| 7 | No conditional/mapped/template-literal types in domain or application | **LOOSEN** | Rationale was "Go can't follow them." Go rationale is gone. Judgment call: avoid where they obscure intent; allow where they genuinely simplify the model. Blanket ban lifted. |
| 8 | TUI business state in `useReducer`; `useState` for ephemeral UI only | **KEEP (loosened)** | `useReducer` for business state is still excellent TS practice. `[State, Effect \| null]` tuple constraint retired — it was Bubble Tea parity. Plain `(state, action) => State` is the new signature. |
| 9 | No `useEffect` for business logic; use Effect descriptors + effect-runner | **RETIRE** | Existed purely for Bubble Tea parity (`Effect → tea.Cmd`). Without that constraint, `useEffect` for async fetch is idiomatic React. Convention replaces the ban: `useEffect` MUST call application use cases, never repository ports or adapters directly. |
| 10 | TUI action names are past-tense facts | **RETIRE** | PascalCase past-tense was for Bubble Tea `tea.Msg` verbatim porting. Use whatever naming reads clearly in TypeScript. |
| 11 | No decorators | **KEEP** | Decorators are still experimental/unstable. Composition via HOF is better TS practice regardless. |
| 12 | Async data functions return `Promise<Result<T,E>>` | **KEEP** | Rule 1 applied to async. Explicit error propagation across async boundaries — zero Go relevance needed. |

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Zustand** (+~1KB gzipped) | Action-method style blurs the boundary between application and presentation. Temptation to put use-case logic inside store actions rather than delegating to `getPassage()`. Architecture erosion risk for no meaningful ergonomic gain given verbum's size. |
| **Effect-TS** (+~20KB gzipped) | Replaces `Promise<Result<T,E>>` with `Effect<A,E,R>` across the entire codebase — a full rewrite of the error model. Learning curve dominates everything else for a solo developer. Overkill for a single-screen TUI with one async operation. |
| **XState v5** (+~17KB gzipped) | First-class state machines are most valuable when transitions are complex and non-obvious. verbum has one screen today, two or three expected. Premature abstraction; steep learning curve for no current gain. |

## Consequences

**Gets simpler:**
- `useEffect` is permitted for async business logic in `src/tui/`. No Effect descriptor, no effect-runner switch.
- Reducer signature is plain `(state, action) => State`. No tuple return, no shim layer in `tui-driver.tsx`.
- Action naming is free — no enforced PascalCase past-tense constraint.
- Advanced TS types (`Conditional<T>`, mapped types, template literals) can be used where they genuinely help, subject to code review judgment.

**Gets a new convention:**
- `useEffect` may only call application use cases (e.g. `getPassage(repo, ref)`), never repository ports or adapters directly. Bypassing the use-case layer in a `useEffect` body is a review-blocker under Rule 9's retirement text.

**Retained intact:**
- Hexagonal architecture (ADR 0002) — dependency rule is non-negotiable.
- `Result<T,E>` across domain and application.
- Discriminated-union errors with `kind` field.
- Branded IDs via factory.
- Port simplicity (no callbacks, no observables).
- `bun test` count: ≥ 99 tests, all passing.

## See also

- [`docs/house-rules.md`](../house-rules.md) — revised with full rule dispositions
- [ADR 0002](0002-hexagonal-architecture.md) — hexagonal architecture, still load-bearing
- [ADR 0009](0009-language-portable-architecture.md) — superseded by this decision
```

---

## Section 2 — ADR 0009: Surgical Status Flip

File: `docs/decisions/0009-language-portable-architecture.md`

**Constraint: exactly 3 edits. Body (Context → See also) is IMMUTABLE — do not touch.**

### Edit 1 — Status line (line 3)

Old:
```
- Status: accepted
```

New:
```
- Status: superseded by 0010
```

### Edit 2 — Insert "Superseded by" section

Insert the block below immediately AFTER the front-matter block (after `- Date: 2026-05-09`) and BEFORE the `## Context` heading. No other text around it.

```markdown

## Superseded by

[ADR 0010](0010-typescript-native-architecture.md) — Go-port commitment dropped 2026-05-11. The Bubble Tea parity rules (Rules 7–10 in the original numbering of this ADR) are retired. See ADR 0010 for the full rule disposition.
```

### Edit 3 — None

There is no Edit 3. The entire body from `## Context` to `## See also` (inclusive) remains unchanged. The apply agent must not modify any other line.

---

## Section 3 — README Index Update

File: `docs/decisions/README.md`

**Exact diff — apply agent must reproduce this precisely:**

Change the ADR 0009 row from:
```
| [0009](0009-language-portable-architecture.md) | Language-portable architecture (Go-port readiness) | accepted | 2026-05-09 |
```

To:
```
| [0009](0009-language-portable-architecture.md) | Language-portable architecture (Go-port readiness) | superseded by 0010 | 2026-05-09 |
```

Add a new row for ADR 0010 immediately after the 0009 row:
```
| [0010](0010-typescript-native-architecture.md) | TypeScript-native architecture (Go-port commitment dropped) | accepted | 2026-05-11 |
```

The existing table header and all other rows remain unchanged.

---

## Section 4 — house-rules.md Per-Rule Rewrite Plan

### Banner (top of file, replaces current preamble)

Replace the current preamble (lines 1–14, from `# House Rules` through the `---` separator) with:

```markdown
# House Rules

> **ADR 0010 (2026-05-11):** This file has been updated to reflect the TypeScript-native architecture. The Go-port portability mandate (ADR 0009) is superseded. Rules 9 and 10 are retired; Rules 7 and 8 are loosened. See [ADR 0010](decisions/0010-typescript-native-architecture.md) for the full decision and rationale.

This codebase follows a **TypeScript-native architecture** built on hexagonal foundations. Every rule below is enforceable in code review — cite by number.

The principles behind the rules:

- **Hexagonal first.** Dependency rule (arrows point inward) is non-negotiable. ([ADR 0002](decisions/0002-hexagonal-architecture.md))
- **Pure domain.** No IO, no framework code, no async in `src/domain/`.
- **Explicit errors.** Throwing is implicit control flow. Return `Result<T,E>` instead.
- **Symmetric input.** Mouse and keyboard dispatch the same use cases.

See [ADR 0010](decisions/0010-typescript-native-architecture.md) for the governing architectural decision.

---
```

### Rule 1 — KEEP (remove "Go port" footnote)

Replace the entire Rule 1 section (from `## Rule 1` through the `---` separator before Rule 2) with:

```markdown
## Rule 1 — Domain functions never throw

Domain functions return `Result<T, E>`. Throwing in `src/domain/` is a review-blocker.

```ts
// ❌ AVOID
function parseReference(s: string): Reference {
  if (!s) throw new Error("empty input");
  // ...
}

// ✅ PREFER
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function parseReference(s: string): Result<Reference, ParseError> {
  if (!s) return { ok: false, error: { kind: "empty_input" } };
  // ...
}
```

---
```

### Rule 2 — KEEP (remove "Go port" footnote)

Replace the entire Rule 2 section with:

```markdown
## Rule 2 — No `class` keyword outside React components

Use cases, parsers, repositories, value objects, and adapters are all functions or plain object factories. The only acceptable place for `class` is React component classes in `src/tui/components/` — and even there, prefer function components.

```ts
// ❌ AVOID
class ReferenceParser {
  parse(input: string): Reference { /* ... */ }
}

// ✅ PREFER
export function parseReference(
  input: string,
): Result<Reference, ParseError> {
  // ...
}
```

---
```

### Rule 3 — KEEP (remove "Go port" footnote)

Replace the entire Rule 3 section with:

```markdown
## Rule 3 — Ports are interfaces with primitive/struct args, no callbacks

No event emitters, no observables, no streaming via callbacks.

```ts
// ❌ AVOID
interface BibleRepository {
  streamChapter(
    t: TranslationId,
    b: BookId,
    ch: number,
    onVerse: (v: Verse) => void,
  ): Promise<void>;
}

// ✅ PREFER
interface BibleRepository {
  getTranslations(): Promise<Result<Translation[], RepoError>>;
  getChapter(
    t: TranslationId,
    b: BookId,
    ch: number,
  ): Promise<Result<Chapter, RepoError>>;
}
```

If streaming becomes necessary later, it warrants its own architectural decision.

---
```

### Rule 4 — KEEP (remove "Go port" footnote)

Replace the entire Rule 4 section with:

```markdown
## Rule 4 — Zod stays in `src/api/` — domain imports plain TS types only

```ts
// ❌ AVOID — in src/domain/
import { z } from "zod";
type Verse = z.infer<typeof VerseSchema>;

// ✅ PREFER — in src/domain/
type Verse = {
  number: number;
  text: string;
};
```

```ts
// In src/api/, keep schema and exported domain type aligned by hand:
import { VerseSchema } from "./schemas";
import type { Verse } from "@/domain/verse";

export function parseVerse(raw: unknown): Result<Verse, ParseError> {
  const parsed = VerseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { kind: "invalid_verse" } };
  return { ok: true, value: parsed.data };
}
```

---
```

### Rule 5 — KEEP (remove "Go port" footnote)

Replace the entire Rule 5 section with:

```markdown
## Rule 5 — Errors are discriminated unions with a `kind` field — no error class hierarchies

```ts
// ❌ AVOID
class ParseError extends Error {}
class UnknownBookError extends ParseError {}
class OutOfRangeError extends ParseError {}

// ✅ PREFER
type ParseError =
  | { kind: "unknown_book"; input: string }
  | { kind: "out_of_range"; chapter: number; max: number }
  | { kind: "empty_input" };

function format(err: ParseError): string {
  switch (err.kind) {
    case "unknown_book":
      return `Don't know "${err.input}"`;
    case "out_of_range":
      return `Chapter ${err.chapter} > max ${err.max}`;
    case "empty_input":
      return "Reference cannot be empty";
  }
}
```

Add an exhaustiveness check via `never` if the compiler doesn't enforce it:

```ts
default: {
  const _exhaustive: never = err;
  throw new Error(`unhandled: ${_exhaustive}`);
}
```

---
```

### Rule 6 — KEEP (remove "Go port" footnote)

Replace the entire Rule 6 section with:

```markdown
## Rule 6 — Branded IDs via a single factory — no `as BookId` casts

```ts
// ❌ AVOID
const id = "JHN" as BookId;
```

```ts
// ✅ PREFER — in src/domain/book-id.ts
export type BookId = string & { readonly __brand: "BookId" };

const CANONICAL = new Set(["GEN", "EXO", /* ... */ "REV"]);

export function makeBookId(
  s: string,
): Result<BookId, InvalidBookError> {
  if (!CANONICAL.has(s)) {
    return { ok: false, error: { kind: "invalid_book", input: s } };
  }
  return { ok: true, value: s as BookId }; // the only `as` allowed
}
```

Casts outside the factory are a review-blocker.

---
```

### Rule 7 — LOOSEN (ADR 0010)

Replace the entire Rule 7 section with:

```markdown
## Rule 7 — Conditional, mapped, and template-literal types: judgment call *(loosened — ADR 0010)*

The previous blanket ban on conditional/mapped/template-literal types in `src/domain/` and `src/application/` is lifted. The Go-port justification ("Go can't follow them") no longer applies.

**Guidance:** allow where they genuinely simplify the type model and do not leak across layer boundaries; avoid where they obscure intent or make the type harder to read than the runtime equivalent.

```ts
// ❌ AVOID — obscures intent, leaks complexity
type FieldKey<T> = `${string & keyof T}_field`;
type AsyncOf<T> = T extends Promise<infer U> ? U : never;

// ✅ PREFER — explicit types where the intent is clear
type ChapterField = "verses" | "footnotes" | "headings";
```

Infrastructure (`src/api/`) may continue using them freely where Zod ergonomics require.

---
```

### Rule 8 — KEEP (loosened — ADR 0010)

Replace the entire Rule 8 section with:

```markdown
## Rule 8 — TUI business state in `useReducer`; `useState` for ephemeral UI only *(loosened — ADR 0010)*

`useReducer` for business state is mandatory. The previous `[State, Effect | null]` tuple return constraint is retired — it was Bubble Tea parity, not a TypeScript concern.

**New signature:** plain `(state, action) => State`.

```tsx
// ❌ AVOID — tuple return (retired)
function reducer(state: State, action: Action): [State, Effect | null] {
  switch (action.type) {
    case "ChapterLoaded":
      return [{ kind: "loaded", chapter: action.chapter }, null];
  }
}

// ✅ PREFER — plain state return
type State =
  | { kind: "loading"; ref: Reference }
  | { kind: "loaded"; chapter: Chapter }
  | { kind: "error"; err: AppError };

type Action =
  | { type: "ChapterLoaded"; chapter: Chapter }
  | { type: "ChapterFailed"; err: AppError };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ChapterLoaded":
      return { kind: "loaded", chapter: action.chapter };
    case "ChapterFailed":
      return { kind: "error", err: action.err };
    default:
      return state;
  }
}
```

`useState` is fine for: input-field cursor position, modal-open booleans, animation timers, hover state. Anything you'd describe to a teammate at standup belongs in the reducer.

---
```

### Rule 9 — RETIRE (ADR 0010) — LOCKED TEXT

Replace the entire Rule 9 section with the following. The body text is locked — reproduce verbatim:

```markdown
## Rule 9 — `useEffect` for business logic *(retired — ADR 0010)*

Retired. `useEffect` is now permitted for async business logic. CONVENTION: `useEffect` must call application use cases, never repository ports or adapters directly. Bypassing the use-case layer is the only forbidden pattern.

<details>
<summary>Original rule (historical record)</summary>

Side effects are *described*, not invoked inline. The reducer returns an `Effect` descriptor; a single top-level effect runner executes it.

```tsx
// ❌ AVOID (under the old rule)
useEffect(() => {
  saveBookmark(bookmark);
}, [bookmark]);

// ✅ PREFERRED (under the old rule) — in the reducer:
case "BookmarkRequested":
  return [state, { kind: "save_bookmark", bookmark: action.bookmark }];

// In src/tui/effect-runner.ts:
async function run(effect: Effect, dispatch: Dispatch) {
  switch (effect.kind) {
    case "save_bookmark": {
      const result = await bookmarkStore.save(effect.bookmark);
      dispatch({ type: result.ok ? "BookmarkSaved" : "BookmarkFailed", ... });
      break;
    }
  }
}
```

**Justification (2026-05-09):** The TUI is the only layer fully rewritten in a Go port; getting the message/effect shape right was the difference between transcription and redesign. This rule was retired when the Go-port commitment was dropped (ADR 0010, 2026-05-11).

</details>

---
```

### Rule 10 — RETIRE (ADR 0010)

Replace the entire Rule 10 section with:

```markdown
## Rule 10 — TUI action names *(retired — ADR 0010)*

Retired. The PascalCase past-tense requirement (`ChapterLoaded`, `KeyPressed`) was for Bubble Tea `tea.Msg` verbatim porting. Use whatever naming reads clearly in TypeScript — present-tense imperative or past-tense fact, whichever communicates intent better to the reader.

<details>
<summary>Original rule (historical record)</summary>

Actions describe *what happened*, not *what to do*. They name events, not commands.

```ts
// ❌ AVOID (under the old rule)
type Action =
  | { type: "loadChapter"; ref: Reference }
  | { type: "saveBookmark"; bookmark: Bookmark };

// ✅ PREFERRED (under the old rule)
type Action =
  | { type: "ChapterLoaded"; chapter: Chapter }
  | { type: "ChapterFailed"; err: AppError }
  | { type: "KeyPressed"; key: string };
```

**Justification (2026-05-09):** These names ported verbatim to Bubble Tea `tea.Msg`. Retired when Go-port commitment was dropped (ADR 0010, 2026-05-11).

</details>

---
```

### Rule 11 — KEEP (remove "Go port" footnote)

Replace the entire Rule 11 section with:

```markdown
## Rule 11 — No decorators

```ts
// ❌ AVOID
@Cached
class Repo {
  /* ... */
}
```

```ts
// ✅ PREFER — explicit higher-order functions
function withCache<R extends BibleRepository>(
  repo: R,
  cache: Cache<ChapterKey, Chapter>,
): BibleRepository {
  return {
    ...repo,
    getChapter: async (t, b, ch) => {
      const key = chapterKey(t, b, ch);
      const cached = await cache.get(key);
      if (cached) return { ok: true, value: cached };
      const fresh = await repo.getChapter(t, b, ch);
      if (fresh.ok) await cache.set(key, fresh.value);
      return fresh;
    },
  };
}
```

Composition becomes:

```ts
const repo = withCache(
  new HelloAoBibleRepository(httpClient),
  new FilesystemCache(cacheDir),
);
```

---
```

### Rule 12 — KEEP (remove "Go port" footnote)

Replace the entire Rule 12 section with:

```markdown
## Rule 12 — Every async data function returns `Promise<Result<T, E>>`, never bare `Promise<T>`

```ts
// ❌ AVOID
async function getPassage(ref: Reference): Promise<Passage> {
  // throws on parse error, network error, etc.
}

// ✅ PREFER
async function getPassage(
  ref: Reference,
): Promise<Result<Passage, AppError>> {
  // never throws — returns Result
}
```

The exception is functions that genuinely can't fail (e.g. an in-memory transformation with no IO and validated input) — those can return `Promise<T>` directly. But if there's a network call, file IO, or parsing involved, it's `Result<T, E>`.

---
```

### "How to apply these rules" section — update code review example

Replace the Rule 9 code review example in the footer section. Change:

Old:
```
> "Rule 9 — fetching here belongs in an Effect, not `useEffect`. Move the call to the reducer's `Effect` return + the effect-runner."
```

New:
```
> "Rule 9 (convention) — `useEffect` must call the application use case (`getPassage`), not the repository port directly."
```

Also update the ADR 0009 reference in the "default is enforce, not bend" paragraph at the bottom. Change:

Old:
```
If a rule blocks legitimate work, raise it — rules can be revisited (see [ADR 0009](decisions/0009-language-portable-architecture.md) for revisit triggers). But the default is **enforce, not bend**.
```

New:
```
If a rule blocks legitimate work, raise it — rules can be revisited (see [ADR 0010](decisions/0010-typescript-native-architecture.md) for the current governing decision). But the default is **enforce, not bend**.
```

---

## Section 5 — Welcome Reducer Simplification: Exact Diffs

### 5a. `src/tui/welcome/welcome-reducer.ts` — AFTER

```typescript
// src/tui/welcome/welcome-reducer.ts — pure state machine for the welcome screen.
// Follows house-rules.md Rules 8 (plain useReducer) and ADR 0010 TypeScript-native dialect.
// Zero imports from OpenTUI, React, domain, application, or api.

/** The welcome screen has a single active state for this slice. */
export type WelcomeState = { kind: "active" };

/** Only one action variant needed for this slice. */
export type WelcomeAction = { type: "KeyPressed"; key: string };

/**
 * Pure reducer. Plain (state, action) => State per ADR 0010 (Rule 8 loosened).
 * Quit handling lives in the useKeyboard handler in tui-driver.tsx — not in the reducer.
 * - Any key → returns state unchanged (welcome screen has no state transitions).
 */
export function welcomeReducer(
  state: WelcomeState,
  action: WelcomeAction,
): WelcomeState {
  switch (action.type) {
    case "KeyPressed": {
      return state;
    }
  }
}

/** Initial state. */
export const initialWelcomeState: WelcomeState = { kind: "active" };
```

**Removed exports:** `Effect` type.
**Removed imports:** none (file had no imports before; still none).
**Changed:** return type from `[WelcomeState, Effect | null]` to `WelcomeState`; return statements simplified.

### 5b. `src/tui/welcome/welcome-reducer.test.ts` — AFTER

```typescript
// src/tui/welcome/welcome-reducer.test.ts — unit tests for the welcome screen reducer.
// No OpenTUI imports, no terminal allocation — pure function tests.

import { describe, it, expect } from "bun:test";
import {
  welcomeReducer,
  initialWelcomeState,
} from "./welcome-reducer";

describe("welcomeReducer", () => {
  it('KeyPressed("q") returns initialWelcomeState unchanged', () => {
    const nextState = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "q",
    });
    expect(nextState).toBe(initialWelcomeState);
  });

  it('KeyPressed("Q") returns initialWelcomeState unchanged', () => {
    const nextState = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "Q",
    });
    expect(nextState).toBe(initialWelcomeState);
  });

  it('KeyPressed("x") returns initialWelcomeState unchanged — any key is a no-op', () => {
    const nextState = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "x",
    });
    expect(nextState).toBe(initialWelcomeState);
  });

  it('initialWelcomeState.kind === "active"', () => {
    expect(initialWelcomeState.kind).toBe("active");
  });
});
```

**Per-test case changes:**

| Old test description | New assertion | Notes |
|---|---|---|
| `KeyPressed("q") returns [state, { kind: "quit" }]` | `const nextState = welcomeReducer(...)` → `expect(nextState).toBe(initialWelcomeState)` | Tuple destructuring removed. Effect assertion removed. |
| `KeyPressed("Q") returns [state, { kind: "quit" }]` | Same pattern as q | Same change. |
| `KeyPressed("x") returns [state, null] — any other key is a no-op` | `const nextState = welcomeReducer(...)` → `expect(nextState).toBe(initialWelcomeState)` | Null effect assertion removed. |
| `initialWelcomeState.kind === "active"` | Unchanged | No tuple involved; passes before and after. |

**Removed imports:** none (file already had the minimum imports; `Effect` was never imported here directly).
**Test count change:** 4 tests before → 4 tests after. No tests are deleted; assertions are rewritten.

### 5c. `src/tui/tui-driver.tsx` — AFTER

```typescript
// src/tui/tui-driver.tsx — TUI runtime: renderer lifecycle, Promise exit.
// This is the ONLY file that holds the OpenTUI renderer handle.
// Uses standard useReducer (no shim) per ADR 0010.
// Quit is handled inline in useKeyboard — not via reducer Effect dispatch.
//
// OpenTUI API:
//   createCliRenderer() — async factory, returns Promise<CliRenderer>
//   createRoot(renderer).render(<App/>) — mounts the React tree
//   useReducer — standard React hook (supported by @opentui/react)
//   useKeyboard(handler) — hook from @opentui/react; subscribes to press events
//   KeyEvent.name — the key name string (e.g. "q", "Q", "return")
//   renderer.destroy() — synchronous teardown; restores terminal

import { useReducer } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
  welcomeReducer,
  initialWelcomeState,
  type WelcomeAction,
  type WelcomeState,
} from "./welcome/welcome-reducer";
import { WelcomeScreen } from "./welcome/welcome-screen";
import type { CliRenderer } from "@opentui/core";

// --- Inline <App> component ---

function App({
  renderer,
  resolve,
}: {
  renderer: CliRenderer;
  resolve: () => void;
}) {
  const [state, dispatch] = useReducer(welcomeReducer, initialWelcomeState);

  // useKeyboard hook — quit handled inline per ADR 0010.
  // q/Q → renderer.destroy() + resolve() directly (no reducer round-trip).
  // Other keys → dispatch to reducer (no-op for welcome screen).
  useKeyboard((keyEvent) => {
    if (keyEvent.name === "q" || keyEvent.name === "Q") {
      renderer.destroy();
      resolve();
      return;
    }
    dispatch({ type: "KeyPressed", key: keyEvent.name });
  });

  return <WelcomeScreen state={state} dispatch={dispatch} />;
}

// --- Public API ---

/**
 * Initialises the OpenTUI renderer, mounts the welcome screen, and returns a
 * Promise<void> that resolves when the user quits.
 * Does NOT call process.exit — that is the entry point's responsibility.
 */
export async function tuiDriver(): Promise<void> {
  // Non-TTY guard — exit cleanly without touching the renderer.
  if (!process.stdout.isTTY) {
    process.stderr.write(
      "verbum: interactive TUI requires a TTY — run without piping\n",
    );
    return;
  }

  // Minimum terminal size guard.
  const cols = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;
  if (cols < 60 || rows < 20) {
    process.stderr.write(
      `verbum: terminal too small (minimum 60×20, current ${cols}×${rows})\n`,
    );
    return;
  }

  const renderer = await createCliRenderer({
    exitOnCtrlC: false, // We handle SIGINT ourselves to use the same quit path.
  });

  return new Promise<void>((resolve) => {
    // SIGINT → same teardown path as pressing q.
    const sigintHandler = () => {
      renderer.destroy();
      resolve();
    };
    process.once("SIGINT", sigintHandler);

    // Clean up the SIGINT handler after we resolve so the process can exit normally.
    const wrappedResolve = () => {
      process.off("SIGINT", sigintHandler);
      resolve();
    };

    createRoot(renderer).render(
      <App renderer={renderer} resolve={wrappedResolve} />,
    );
  });
}
```

**Removed from imports:** `type Effect` from `./welcome/welcome-reducer`.
**Removed declarations:** `reactReducer` constant; `runEffect` function; custom `dispatch` wrapper.
**Changed:** `useReducer(reactReducer, initialWelcomeState)` → `useReducer(welcomeReducer, initialWelcomeState)`; `baseDispatch` renamed to `dispatch`; `useKeyboard` handler now intercepts `q`/`Q` inline; SIGINT handler now calls `renderer.destroy() + resolve()` directly (no `runEffect` call).

**Note on `WelcomeScreen` dispatch prop:** `WelcomeScreen` currently receives `dispatch`. After the reducer change, `dispatch` is the standard React dispatch type `(action: WelcomeAction) => void`. If `WelcomeScreen`'s prop type was defined as `Dispatch<WelcomeAction>` (from React), no change is needed there. If it was typed against the custom wrapper, the apply agent must verify and update `welcome-screen.tsx` accordingly — but no behavioral change is required.

---

## Section 6 — Strict-TDD Order

This change is under strict TDD. Apply in this exact sequence:

### Batch 1 — Reducer (RED → GREEN)

**Step 1 (RED):** Rewrite `src/tui/welcome/welcome-reducer.test.ts` to the AFTER version in Section 5b. Run `bun test src/tui/welcome/welcome-reducer.test.ts`. Expected: 3 of 4 tests FAIL (the three tests that previously used tuple destructuring now call `welcomeReducer(...)` and get a tuple back, but assert `.toBe(initialWelcomeState)` directly on it — the tuple is not the same reference as the plain state object; the `initialWelcomeState.kind` test passes because it does not invoke the reducer).

> Verification: confirm red before proceeding.

**Step 2 (GREEN):** Rewrite `src/tui/welcome/welcome-reducer.ts` to the AFTER version in Section 5a. Run `bun test src/tui/welcome/welcome-reducer.test.ts`. Expected: 4/4 pass.

**Step 3 (FULL SUITE):** Run `bun test`. Expected: ≥ 99 pass. (The driver still compiles against the new reducer because TypeScript will catch the type mismatch; do not proceed to batch 2 if the full suite is not green at this point — but note that `tui-driver.tsx` currently imports `Effect` which will now be an absent export; the TypeScript compiler error is expected and is resolved in Batch 2.)

### Batch 2 — Driver (RED → GREEN)

**Step 4 (RED — compile error, not test failure):** The existing `tui-driver.tsx` imports `type Effect` from `welcome-reducer.ts`. After the reducer change, `Effect` is no longer exported. Running `bun run tsc --noEmit` will produce a type error. This is the expected RED signal for the driver change.

**Step 5 (GREEN):** Rewrite `src/tui/tui-driver.tsx` to the AFTER version in Section 5c. Run `bun run tsc --noEmit`. Expected: 0 errors. Run `bun test`. Expected: ≥ 99 pass.

### Batch 3 — useKeyboard quit path

**Note on testability:** the `useKeyboard` quit path (`q` → `renderer.destroy() + resolve()`) requires a PTY to exercise via automated test. This is not unit-testable without a terminal emulator. It is explicitly excluded from the automated test suite. Manual smoke test is the success criterion (REQ-17b):

```
bun start  # in a TTY ≥ 60×20
# press q → process exits cleanly
# press Q → same
# Ctrl+C → same
```

This is noted as an accepted test-coverage gap (see Section 9 — Risks).

---

## Section 7 — tui-async-effects Archival

### Move

```bash
mkdir -p openspec/changes/archive
mv openspec/changes/tui-async-effects openspec/changes/archive/tui-async-effects
```

### Create `openspec/changes/archive/tui-async-effects/SUPERSEDED.md`

```markdown
# SUPERSEDED — tui-async-effects

- Status: superseded
- Date: 2026-05-11
- Superseded by: [ts-native-architecture](../../ts-native-architecture/)

## What happened

This change was paused mid-exploration when ADR 0009 was superseded by [ADR 0010](../../../docs/decisions/0010-typescript-native-architecture.md).

The `tui-async-effects` exploration was built around the Effect-descriptor pattern (Rule 9 of ADR 0009): the reducer returns an `Effect` descriptor; a `makeEffectRunner` factory executes it. That pattern is retired.

## What replaces it

The async effect problem (fetching a passage from the TUI) is now solved via the TypeScript-native pattern:

- Reducer returns plain `State` (no Effect tuple).
- `useEffect` in the screen component calls the application use case (`getPassage(repo, ref)`).
- Stale-request cancellation uses a `cancelled` flag in the `useEffect` cleanup (or `AbortController` for HTTP-layer cancellation).

See the code sketch in `openspec/changes/ts-native-architecture/explore.md` (Deliverable 3) for a concrete example.

## Engram context

Engram observation #248 contains the tui-async-effects exploration in full. It remains informational for understanding why the Effect-descriptor approach was considered — but its concrete implementation artifacts (`makeEffectRunner`, the `Effect` union extension, the `fetch-passage`/`cancel-fetch` variants) are superseded by the ts-native-architecture pattern.

## Governing change

`openspec/changes/ts-native-architecture/` is the replacement direction.
```

---

## Section 8 — docs/architecture.md Sweep

After reading `docs/architecture.md` in full, the portability/Go/Bubble Tea reference inventory is:

| Location | Current text | Status |
|---|---|---|
| File-wide | No mention of Go port, Bubble Tea, or portability as a design motivation | — |
| Tech stack table | TypeScript, Bun, OpenTUI/React, Zod — no Go reference | — |
| Layer descriptions | No portability language | — |

**Finding: zero references.** `docs/architecture.md` contains no mention of Go portability, Bubble Tea, or portability-as-motivation language. REQ-10 is satisfied trivially — no edits required to this file.

---

## Section 9 — Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **PTY-only quit path not covered by automated tests** | Certain (by design — PTY required) | Manual smoke test is the explicit success criterion for REQ-17b/c. Noted in SCN-17b/c as a PTY-dependent scenario. |
| **Apply agent paraphrases Rule 9 retirement text** | Low but non-zero | Rule 9 locked text is quoted verbatim in this design doc (Section 4, Rule 9 subsection) and in the spec (REQ-7/NFR-4). The apply agent must reproduce it character-for-character. Verify agent must check it against the spec's NFR-4 exact sentence. |
| **ADR 0009 body accidentally modified** | Low | Section 2 of this design doc enumerates exactly 3 edits. Edit 3 is explicitly "none." The apply agent must touch only lines 3 (status) and the insertion point (after front-matter, before `## Context`). |
| **house-rules.md Go-port footnote missed in a kept rule** | Medium | All 12 rules have explicit AFTER content in Section 4. Apply agent uses Section 4 text wholesale; no hunting for footnotes required. |
| **`WelcomeScreen` dispatch prop type mismatch** | Low | Noted in Section 5c. Apply agent must check `welcome-screen.tsx` prop type when simplifying tui-driver — if typed against the old custom dispatch, update it. |
| **tui-async-effects engram observation (#248) creates stale context** | Low | SUPERSEDED.md points to the archive and the replacement pattern. The observation itself remains informational; the apply agent is not required to modify or delete engram observations. |

---

## Section 10 — Commit Plan

Single PR. Four commits for reviewer clarity. Commit boundaries are reviewer preference, not contract — a single squash is acceptable.

### C1 — ADR 0010 + README index

```
docs(adr): add ADR 0010 — TypeScript-native architecture
```

Files:
- `docs/decisions/0010-typescript-native-architecture.md` (CREATE)
- `docs/decisions/README.md` (add 0010 row, mark 0009 superseded)

### C2 — ADR 0009 status flip

```
docs(adr): mark ADR 0009 superseded by 0010
```

Files:
- `docs/decisions/0009-language-portable-architecture.md` (status flip + superseded-by section)

### C3 — House rules + architecture sweep

```
docs(house-rules): align with ADR 0010 (retire rules 9/10, loosen 7/8)
```

Files:
- `docs/house-rules.md` (preamble rewrite + all 12 rule updates)
- `docs/architecture.md` (no changes required — sweep confirmed zero portability references)

### C4 — Code simplification + archive

```
refactor(tui): plain useReducer signature; quit via useKeyboard
```

Files:
- `src/tui/welcome/welcome-reducer.ts` (tuple → plain State)
- `src/tui/welcome/welcome-reducer.test.ts` (assertions rewritten)
- `src/tui/tui-driver.tsx` (shim removed, standard useReducer, inline quit)
- `openspec/changes/archive/tui-async-effects/` (move + SUPERSEDED.md)

---

## Spec/Design Tension Flags

No unresolved tensions. One clarification recorded:

**Clarification — `docs/architecture.md`:** The spec (REQ-10) required a sweep for portability references. The sweep found zero references — the file is already TypeScript-native in language. No changes required. This satisfies REQ-10 trivially.

**Clarification — `welcome-reducer.test.ts` test count:** The spec (REQ-12, NFR-3) allowed the test count to change by ±2. The actual change is ±0 — 4 tests before, 4 tests after. The content of 3 tests changes (assertion shape), but the count is stable.

**Clarification — `WelcomeAction` naming:** Rule 10 is retired by ADR 0010. The existing `WelcomeAction = { type: "KeyPressed" }` uses PascalCase past-tense — valid under the old rule. This change does NOT rename it. Renaming is out of scope and would break the existing test unnecessarily. The action name is fine as-is under the loosened Rule 10 ("use whatever reads clearly").
