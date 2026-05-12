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

// ✅ PREFER — plain state return + object-with-keys dispatch (see Rule 13)
type State =
  | { kind: "loading"; ref: Reference }
  | { kind: "loaded"; chapter: Chapter }
  | { kind: "error"; err: AppError };

type Action =
  | { type: "ChapterLoaded"; chapter: Chapter }
  | { type: "ChapterFailed"; err: AppError };

const handlers = {
  ChapterLoaded: (_state, action): State => ({
    kind: "loaded",
    chapter: action.chapter,
  }),
  ChapterFailed: (_state, action): State => ({
    kind: "error",
    err: action.err,
  }),
} satisfies {
  [K in Action["type"]]: (
    state: State,
    action: Extract<Action, { type: K }>,
  ) => State;
};

function reducer(state: State, action: Action): State {
  return (handlers[action.type] as (s: State, a: Action) => State)(
    state,
    action,
  );
}
```

`useState` is fine for: input-field cursor position, modal-open booleans, animation timers, hover state. Anything you'd describe to a teammate at standup belongs in the reducer.

---

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

## Rule 13 — Prefer object-with-keys dispatch over `switch` for handler tables

For reducers, event handlers, and effect runners — anything that dispatches on a discriminator field — prefer an object map of handlers over a `switch` statement. Each handler is a named, testable function. Adding a case is a single-key insertion. TypeScript still enforces exhaustiveness via `satisfies` and a mapped type.

```ts
type State =
  | { kind: "loading"; ref: Reference }
  | { kind: "loaded"; chapter: Chapter }
  | { kind: "error"; err: AppError };

type Action =
  | { type: "ChapterLoaded"; chapter: Chapter }
  | { type: "ChapterFailed"; err: AppError };

// ❌ AVOID — switch for handler dispatch
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

// ✅ PREFER — object handler table
const handlers = {
  ChapterLoaded: (_state, action): State => ({
    kind: "loaded",
    chapter: action.chapter,
  }),
  ChapterFailed: (_state, action): State => ({
    kind: "error",
    err: action.err,
  }),
} satisfies {
  [K in Action["type"]]: (
    state: State,
    action: Extract<Action, { type: K }>,
  ) => State;
};

function reducer(state: State, action: Action): State {
  return (handlers[action.type] as (s: State, a: Action) => State)(
    state,
    action,
  );
}
```

The `satisfies` clause keeps each handler's narrow action type intact while guaranteeing every variant of `Action["type"]` has a handler. The cast at the call site is the only TypeScript friction — it's the price of swapping `switch`-based narrowing for table-driven dispatch.

**Where `switch` is still the better tool:** matching on a discriminated union with an exhaustive `never` check (see Rule 5 — formatting a domain error). The compiler-enforced exhaustiveness via `never` is more direct than a handler table. Use `switch` for *narrowing-as-control-flow*; use objects for *handler dispatch*.

```ts
// ✅ switch is appropriate here — narrowing for inline formatting, not dispatching to handlers
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

If a reducer has only one action variant (e.g. a placeholder reducer that returns state unchanged), still use the object form — it sets the slot for future variants without a structural change later.

---

## Rule 14 — Default to no comments; ship only the WHY of non-obvious decisions

Code that restates itself in a comment is noise. Filenames, identifiers, and type signatures already say what the code does. A comment earns its place only when it captures a hidden constraint, a subtle invariant, a workaround for a known bug, or behaviour that would surprise a future reader.

```ts
// ❌ AVOID — header banners and code-paraphrase
// src/tui/foo.ts — pure state machine for foo.
// Zero imports from OpenTUI, React, domain, application, or api.

/** Pure reducer per ADR 0010 — plain (state, action) => State. */
export function fooReducer(state: FooState, action: FooAction): FooState {
  // dispatch on action.type
  return handlers[action.type](state, action);
}
```

```ts
// ✅ PREFER — silent on the obvious, explicit on the surprising
export function fooReducer(state: FooState, action: FooAction): FooState {
  return handlers[action.type](state, action);
}

// exitOnCtrlC: false — we route SIGINT through the same quit path as `q`.
const renderer = await createCliRenderer({ exitOnCtrlC: false });
```

**Keep:** comments that document a non-obvious decision (the `exitOnCtrlC: false` example above), a temporal workaround, an invariant the type system can't capture, or a pointer to logic that lives elsewhere when the reader would expect it here.

**Drop:** file-banner comments, section dividers (`// --- API ---`), rule-citation footnotes (`// per ADR 0010`), restatements of the line below, and TODO comments without a tracked issue.

This rule applies to source files. ADRs, house-rules, and openspec markdown are documentation — they are not bound by it.

---

## How to apply these rules

In code review, comments cite a rule by number:

> "Rule 9 (convention) — `useEffect` must call the application use case (`getPassage`), not the repository port directly."

> "Rule 1 — domain function shouldn't throw. Return `Result<Reference, ParseError>` instead."

> "Rule 6 — `as BookId` outside `makeBookId` is a portability risk. Use the factory."

If a rule blocks legitimate work, raise it — rules can be revisited (see [ADR 0010](decisions/0010-typescript-native-architecture.md) for the current governing decision). But the default is **enforce, not bend**.

## What this is *not*

- **Not a style guide.** Indentation, naming conventions, file layout — those live elsewhere or follow community defaults.
- **Not a TypeScript tutorial.** Assumes familiarity with discriminated unions, branded types, and `useReducer`.
- **Not a substitute for Hexagonal discipline.** These rules sit *on top of* the layer rules in [ADR 0002](decisions/0002-hexagonal-architecture.md), not in place of them.
