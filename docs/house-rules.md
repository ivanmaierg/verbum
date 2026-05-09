# House Rules

This codebase follows a **portability-first dialect of TypeScript** designed so that a future port to Go (with Bubble Tea for the TUI) is mechanical translation, not redesign. Every rule below is enforceable in code review — cite by number.

The principles behind the rules:

- **Hexagonal first.** Dependency rule (arrows point inward) is non-negotiable. ([ADR 0002](decisions/0002-hexagonal-architecture.md))
- **Pure domain.** No IO, no framework code, no async in `src/domain/`.
- **Explicit errors.** Throwing is implicit control flow that doesn't port to Go.
- **Symmetric input.** Mouse and keyboard dispatch the same use cases.
- **The TUI is the riskiest port.** Rules 7–10 specifically protect the TUI's state shape so a Bubble Tea port is mechanical.

See [ADR 0009](decisions/0009-language-portable-architecture.md) for the full rationale and revisit triggers.

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

**Go port:** `func parseReference(s string) (Reference, error)` — direct.

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

**Go port:** package-level functions. Methods on structs only when the struct genuinely owns state.

---

## Rule 3 — Ports are interfaces with primitive/struct args, no callbacks

Ports must look like Go interfaces. No event emitters, no observables, no streaming via callbacks.

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

Callbacks become Go channels — different paradigm. If streaming becomes necessary later, it warrants its own architectural decision.

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
  return { ok: true, value: parsed.data }; // shape matches domain Verse
}
```

**Go port:** domain types port directly to structs; the parsing job becomes `encoding/json` + a `Validate() error` method.

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

**Go port:** sealed interface with a `Kind() string` method, or a tagged struct → `switch err.Kind { ... }`.

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

**Go port:** `type BookId string` with a `func NewBookId(s string) (BookId, error)` constructor — same pattern.

---

## Rule 7 — No conditional, mapped, or template-literal types in domain or application

These encode logic in the type system that humans (and Go) can't follow.

```ts
// ❌ AVOID — in src/domain/ or src/application/
type FieldKey<T> = `${string & keyof T}_field`;
type AsyncOf<T> = T extends Promise<infer U> ? U : never;

// ✅ PREFER — explicit types
type ChapterField = "verses" | "footnotes" | "headings";
```

Infrastructure (`src/api/`) **may** use them where Zod ergonomics require — but they must not cross the boundary back into domain or application.

---

## Rule 8 — TUI business state in `useReducer`; `useState` for ephemeral UI noise only

```tsx
// ❌ AVOID
function ReadingView({ ref, translation }: Props) {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  useEffect(() => {
    fetchChapter(ref, translation).then(setChapter);
  }, [ref, translation]);
  // ...
}
```

```tsx
// ✅ PREFER
type State =
  | { kind: "loading"; ref: Reference }
  | { kind: "loaded"; chapter: Chapter }
  | { kind: "error"; err: AppError };

type Action =
  | { type: "ChapterLoaded"; chapter: Chapter }
  | { type: "ChapterFailed"; err: AppError };

function reducer(state: State, action: Action): [State, Effect | null] {
  switch (action.type) {
    case "ChapterLoaded":
      return [{ kind: "loaded", chapter: action.chapter }, null];
    case "ChapterFailed":
      return [{ kind: "error", err: action.err }, null];
  }
}
```

`useState` is fine for: input-field cursor position, modal-open booleans, animation timers, hover state. Anything you'd describe to a teammate at standup belongs in the reducer.

**Go port:** the reducer signature `(state, action) => [state, effect]` is **exactly** Bubble Tea's `Update(msg) → (model, cmd)`. Mechanical.

---

## Rule 9 — No `useEffect` for business logic

Side effects are *described*, not invoked inline. The reducer returns an `Effect` descriptor; a single top-level effect runner executes it.

```tsx
// ❌ AVOID
useEffect(() => {
  saveBookmark(bookmark);
}, [bookmark]);
```

```tsx
// ✅ PREFER — in the reducer:
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
    case "load_chapter": {
      const result = await getPassage(effect.ref);
      dispatch({ type: result.ok ? "ChapterLoaded" : "ChapterFailed", ... });
      break;
    }
    // ...
  }
}
```

`useEffect` is acceptable for: pure DOM/terminal-side effects with no business meaning (e.g. focusing an input on mount, scrolling to top). If the effect calls a use case, parses something, or persists data — it belongs in the effect runner.

**This is the most controversial rule.** It fights React idiom hard. Justification: the TUI is the only layer fully rewritten in a Go port; getting the message/effect shape right *now* is the difference between transcription and redesign.

**Go port:** `Effect` → `tea.Cmd`. Identical concept.

---

## Rule 10 — TUI action names are past-tense facts

Actions describe *what happened*, not *what to do*. They name events, not commands.

```ts
// ❌ AVOID
type Action =
  | { type: "loadChapter"; ref: Reference }
  | { type: "saveBookmark"; bookmark: Bookmark };

// ✅ PREFER
type Action =
  | { type: "ChapterLoaded"; chapter: Chapter }
  | { type: "ChapterFailed"; err: AppError }
  | { type: "KeyPressed"; key: string }
  | { type: "TranslationSwitched"; id: TranslationId }
  | { type: "BookmarkSaved"; id: BookmarkId };
```

User intent — "I want to load this chapter" — becomes an *Effect* (Rule 9), not an Action. Actions are facts about what *did* happen; effects are descriptions of what *should* happen next.

**Go port:** these names port verbatim to Bubble Tea — `type ChapterLoadedMsg struct { Chapter Chapter }`.

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

**Go port:** explicit struct embedding or wrapper structs with the same composition pattern.

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

**Go port:** `func GetPassage(ref Reference) (Passage, error)` — mechanical.

---

## How to apply these rules

In code review, comments cite a rule by number:

> "Rule 9 — fetching here belongs in an Effect, not `useEffect`. Move the call to the reducer's `Effect` return + the effect-runner."

> "Rule 1 — domain function shouldn't throw. Return `Result<Reference, ParseError>` instead."

> "Rule 6 — `as BookId` outside `makeBookId` is a portability risk. Use the factory."

If a rule blocks legitimate work, raise it — rules can be revisited (see [ADR 0009](decisions/0009-language-portable-architecture.md) for revisit triggers). But the default is **enforce, not bend**.

## What this is *not*

- **Not a style guide.** Indentation, naming conventions, file layout — those live elsewhere or follow community defaults.
- **Not a TypeScript tutorial.** Assumes familiarity with discriminated unions, branded types, and `useReducer`.
- **Not a substitute for Hexagonal discipline.** These rules sit *on top of* the layer rules in [ADR 0002](decisions/0002-hexagonal-architecture.md), not in place of them.
