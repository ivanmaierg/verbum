# Design: tui-reader-screen

## 1. `<input>` onSubmit verification

Verified from `node_modules/@opentui/react/src/types/components.d.ts` line 45:

```ts
export type InputProps = ComponentProps<InputRenderableOptions, InputRenderable> & {
  focused?: boolean;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
};
```

**Decision:** `onSubmit` receives the current input value as a `string` parameter. The screen does NOT need to accumulate value via `onChange` into a local ref — the submitted string arrives directly in the handler. Pattern locked:

```tsx
<input
  focused
  value={state.query}
  onChange={(v) => dispatch({ type: "QueryTyped", query: v })}
  onSubmit={(v) => dispatch({ type: "QuerySubmitted" })}
/>
```

`onChange` keeps `state.query` in sync (drives the controlled display); `onSubmit` triggers the submission. `QuerySubmitted` reads `state.query` from the reducer state — the `v` parameter in `onSubmit` is redundant but harmless; omitting its use avoids a lint warning.

---

## 2. parseReference extension — exact diff

### src/domain/reference.ts — before/after

The file currently rejects chapter-only input at `colonIdx === -1` (line 199) with `malformed_chapter_verse`. The extension adds a branch before the colon check.

**Before** (lines 197–231):

```ts
  // Parse <chapter>:<verse>.
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) {
    return {
      ok: false,
      error: { kind: "malformed_chapter_verse", input: rest },
    };
  }

  const rawChapter = rest.slice(0, colonIdx);
  const rawVerse = rest.slice(colonIdx + 1);

  const chapter = parseInt(rawChapter, 10);
  const verse = parseInt(rawVerse, 10);

  if (
    !Number.isInteger(chapter) || chapter < 1 ||
    !Number.isInteger(verse) || verse < 1 ||
    rawChapter !== String(chapter) ||
    rawVerse !== String(verse)
  ) {
    return {
      ok: false,
      error: { kind: "malformed_chapter_verse", input: rest },
    };
  }

  return {
    ok: true,
    value: {
      book: bookResult.value,
      chapter,
      verses: { start: verse, end: verse },
    },
  };
}
```

**After**:

```ts
  // Parse <chapter>:<verse> or <chapter> (whole-chapter).
  const colonIdx = rest.indexOf(":");

  if (colonIdx === -1) {
    // No colon: accept whole-chapter refs (<book> <chapter>).
    const chapter = parseInt(rest, 10);
    if (!Number.isInteger(chapter) || chapter < 1 || rest !== String(chapter)) {
      return {
        ok: false,
        error: { kind: "malformed_chapter_verse", input: rest },
      };
    }
    return {
      ok: true,
      value: {
        book: bookResult.value,
        chapter,
        verses: { start: 1, end: Number.MAX_SAFE_INTEGER },
      },
    };
  }

  const rawChapter = rest.slice(0, colonIdx);
  const rawVerse = rest.slice(colonIdx + 1);

  const chapter = parseInt(rawChapter, 10);
  const verse = parseInt(rawVerse, 10);

  if (
    !Number.isInteger(chapter) || chapter < 1 ||
    !Number.isInteger(verse) || verse < 1 ||
    rawChapter !== String(chapter) ||
    rawVerse !== String(verse)
  ) {
    return {
      ok: false,
      error: { kind: "malformed_chapter_verse", input: rest },
    };
  }

  return {
    ok: true,
    value: {
      book: bookResult.value,
      chapter,
      verses: { start: verse, end: verse },
    },
  };
}
```

**Convention note:** whole-chapter refs use `verses: { start: 1, end: Number.MAX_SAFE_INTEGER }` — consistent with the proposal and the existing `VerseRange` invariant documented in `reference.ts` ("Invariant: 1 <= start <= end"). `getPassage` slices with `v.number >= start && v.number <= end`, so `Number.MAX_SAFE_INTEGER` as the upper bound admits all verses without a static chapter-count map.

**Also update the file-level comment** on line 161 — change `"no whole-chapter (D4)"` to `"<book> <chapter> or <book> <chapter>:<verse>"`. The D4 constraint was a v1 scope note, now superseded.

---

### src/domain/reference.test.ts — additions (RED-first)

Append after the existing `describe` block's last test. These tests must be written BEFORE the parser extension.

```ts
  it("parses 'john 3' to whole-chapter ref", () => {
    const result = parseReference("john 3");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book as string).toBe("JHN");
    expect(result.value.chapter).toBe(3);
    expect(result.value.verses).toEqual({ start: 1, end: Number.MAX_SAFE_INTEGER });
  });

  it("parses 'john 3 ' (trailing space) to whole-chapter ref", () => {
    const result = parseReference("john 3 ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.chapter).toBe(3);
    expect(result.value.verses).toEqual({ start: 1, end: Number.MAX_SAFE_INTEGER });
  });

  it("parses 'JOHN 3' case-insensitively to whole-chapter ref", () => {
    const result = parseReference("JOHN 3");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book as string).toBe("JHN");
    expect(result.value.chapter).toBe(3);
  });

  it("rejects 'jhn 3x' with malformed_chapter_verse", () => {
    const result = parseReference("jhn 3x");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("malformed_chapter_verse");
  });

  it("rejects 'john 0' — chapter must be ≥1", () => {
    const result = parseReference("john 0");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("malformed_chapter_verse");
  });
```

**Regression coverage:** all existing tests (including `"john 316"` → `malformed_chapter_verse`) continue to pass unchanged — the colon-bearing path is untouched.

---

## 3. reader-reducer.ts — full content

File: `src/tui/reader/reader-reducer.ts`

```ts
import { parseReference } from "@/domain/reference";
import type { Reference } from "@/domain/reference";
import type { ParseError, RepoError } from "@/domain/errors";
import type { Passage } from "@/domain/passage";

export type ReaderState =
  | { kind: "awaiting"; query: string; parseError: ParseError | null }
  | { kind: "loading"; ref: Reference }
  | { kind: "loaded"; passage: Passage; ref: Reference }
  | { kind: "network-error"; ref: Reference; reason: RepoError };

export type ReaderAction =
  | { type: "QueryTyped"; query: string }
  | { type: "QuerySubmitted" }
  | { type: "PassageFetched"; passage: Passage }
  | { type: "FetchFailed"; ref: Reference; reason: RepoError }
  | { type: "ChapterAdvanced" }
  | { type: "ChapterRetreated" }
  | { type: "PaletteReopened" };

const handlers = {
  QueryTyped: (s: ReaderState, a: Extract<ReaderAction, { type: "QueryTyped" }>): ReaderState =>
    s.kind === "awaiting" ? { ...s, query: a.query, parseError: null } : s,

  QuerySubmitted: (s: ReaderState, _a: Extract<ReaderAction, { type: "QuerySubmitted" }>): ReaderState => {
    if (s.kind !== "awaiting") return s;
    const result = parseReference(s.query);
    return result.ok
      ? { kind: "loading", ref: result.value }
      : { ...s, parseError: result.error };
  },

  PassageFetched: (s: ReaderState, a: Extract<ReaderAction, { type: "PassageFetched" }>): ReaderState =>
    s.kind === "loading"
      ? { kind: "loaded", passage: a.passage, ref: s.ref }
      : s,

  FetchFailed: (s: ReaderState, a: Extract<ReaderAction, { type: "FetchFailed" }>): ReaderState =>
    s.kind === "loading"
      ? { kind: "network-error", ref: a.ref, reason: a.reason }
      : s,

  ChapterAdvanced: (s: ReaderState, _a: Extract<ReaderAction, { type: "ChapterAdvanced" }>): ReaderState =>
    s.kind === "loaded"
      ? { kind: "loading", ref: { ...s.ref, chapter: s.ref.chapter + 1 } }
      : s,

  ChapterRetreated: (s: ReaderState, _a: Extract<ReaderAction, { type: "ChapterRetreated" }>): ReaderState => {
    if (s.kind !== "loaded") return s;
    if (s.ref.chapter <= 1) return s;
    return { kind: "loading", ref: { ...s.ref, chapter: s.ref.chapter - 1 } };
  },

  PaletteReopened: (s: ReaderState, _a: Extract<ReaderAction, { type: "PaletteReopened" }>): ReaderState =>
    s.kind === "loaded" || s.kind === "network-error"
      ? { kind: "awaiting", query: "", parseError: null }
      : s,
} satisfies {
  [K in ReaderAction["type"]]: (
    state: ReaderState,
    action: Extract<ReaderAction, { type: K }>,
  ) => ReaderState;
};

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  return (handlers[action.type] as (s: ReaderState, a: ReaderAction) => ReaderState)(
    state,
    action,
  );
}

export const initialReaderState: ReaderState = {
  kind: "awaiting",
  query: "",
  parseError: null,
};
```

---

## 4. reader-reducer.test.ts — full content

File: `src/tui/reader/reader-reducer.test.ts`

```ts
import { describe, it, expect } from "bun:test";
import { readerReducer, initialReaderState } from "@/tui/reader/reader-reducer";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";
import type { Passage } from "@/domain/passage";
import type { RepoError } from "@/domain/errors";
import type { Reference } from "@/domain/reference";

const johnRef: Reference = {
  book: "JHN" as import("@/domain/book-id").BookId,
  chapter: 3,
  verses: { start: 1, end: Number.MAX_SAFE_INTEGER },
};

const mockPassage: Passage = {
  reference: johnRef,
  verses: [{ number: 16, text: "For God so loved the world..." }],
};

const networkError: RepoError = { kind: "network", message: "unreachable" };

function dispatch(state: ReaderState, action: ReaderAction): ReaderState {
  return readerReducer(state, action);
}

describe("readerReducer", () => {
  describe("initial state", () => {
    it("starts in awaiting with empty query and no parseError", () => {
      expect(initialReaderState).toEqual({
        kind: "awaiting",
        query: "",
        parseError: null,
      });
    });
  });

  describe("QueryTyped", () => {
    it("updates query and clears parseError when awaiting", () => {
      const state: ReaderState = { kind: "awaiting", query: "", parseError: { kind: "empty_input" } };
      const next = dispatch(state, { type: "QueryTyped", query: "john 3" });
      expect(next).toEqual({ kind: "awaiting", query: "john 3", parseError: null });
    });

    it("is a no-op when not awaiting", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef };
      const next = dispatch(state, { type: "QueryTyped", query: "genesis 1" });
      expect(next).toBe(state);
    });
  });

  describe("QuerySubmitted", () => {
    it("transitions awaiting → loading when query parses ok", () => {
      const state: ReaderState = { kind: "awaiting", query: "john 3", parseError: null };
      const next = dispatch(state, { type: "QuerySubmitted" });
      expect(next.kind).toBe("loading");
      if (next.kind !== "loading") return;
      expect(next.ref.book as string).toBe("JHN");
      expect(next.ref.chapter).toBe(3);
    });

    it("stays awaiting with parseError when query is malformed", () => {
      const state: ReaderState = { kind: "awaiting", query: "jhn 3x", parseError: null };
      const next = dispatch(state, { type: "QuerySubmitted" });
      expect(next.kind).toBe("awaiting");
      if (next.kind !== "awaiting") return;
      expect(next.parseError).not.toBeNull();
      expect(next.parseError?.kind).toBe("malformed_chapter_verse");
    });

    it("stays awaiting with parseError for empty query", () => {
      const state: ReaderState = { kind: "awaiting", query: "", parseError: null };
      const next = dispatch(state, { type: "QuerySubmitted" });
      expect(next.kind).toBe("awaiting");
      if (next.kind !== "awaiting") return;
      expect(next.parseError?.kind).toBe("empty_input");
    });

    it("is a no-op when not awaiting", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef };
      const next = dispatch(state, { type: "QuerySubmitted" });
      expect(next).toBe(state);
    });
  });

  describe("PassageFetched", () => {
    it("transitions loading → loaded", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef };
      const next = dispatch(state, { type: "PassageFetched", passage: mockPassage });
      expect(next).toEqual({ kind: "loaded", passage: mockPassage, ref: johnRef });
    });

    it("is a no-op when not loading", () => {
      const state: ReaderState = { kind: "loaded", passage: mockPassage, ref: johnRef };
      const next = dispatch(state, { type: "PassageFetched", passage: mockPassage });
      expect(next).toBe(state);
    });
  });

  describe("FetchFailed", () => {
    it("transitions loading → network-error", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef };
      const next = dispatch(state, { type: "FetchFailed", ref: johnRef, reason: networkError });
      expect(next).toEqual({ kind: "network-error", ref: johnRef, reason: networkError });
    });

    it("is a no-op when not loading", () => {
      const state: ReaderState = { kind: "loaded", passage: mockPassage, ref: johnRef };
      const next = dispatch(state, { type: "FetchFailed", ref: johnRef, reason: networkError });
      expect(next).toBe(state);
    });
  });

  describe("ChapterAdvanced", () => {
    it("transitions loaded → loading with chapter + 1", () => {
      const state: ReaderState = { kind: "loaded", passage: mockPassage, ref: johnRef };
      const next = dispatch(state, { type: "ChapterAdvanced" });
      expect(next.kind).toBe("loading");
      if (next.kind !== "loading") return;
      expect(next.ref.chapter).toBe(4);
    });

    it("is a no-op from awaiting", () => {
      const next = dispatch(initialReaderState, { type: "ChapterAdvanced" });
      expect(next).toBe(initialReaderState);
    });

    it("is a no-op from loading", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef };
      const next = dispatch(state, { type: "ChapterAdvanced" });
      expect(next).toBe(state);
    });

    it("is a no-op from network-error", () => {
      const state: ReaderState = { kind: "network-error", ref: johnRef, reason: networkError };
      const next = dispatch(state, { type: "ChapterAdvanced" });
      expect(next).toBe(state);
    });
  });

  describe("ChapterRetreated", () => {
    it("transitions loaded → loading with chapter - 1 when chapter > 1", () => {
      const state: ReaderState = {
        kind: "loaded",
        passage: mockPassage,
        ref: { ...johnRef, chapter: 5 },
      };
      const next = dispatch(state, { type: "ChapterRetreated" });
      expect(next.kind).toBe("loading");
      if (next.kind !== "loading") return;
      expect(next.ref.chapter).toBe(4);
    });

    it("is a no-op when chapter === 1 (floor)", () => {
      const state: ReaderState = {
        kind: "loaded",
        passage: mockPassage,
        ref: { ...johnRef, chapter: 1 },
      };
      const next = dispatch(state, { type: "ChapterRetreated" });
      expect(next).toBe(state);
    });

    it("is a no-op from awaiting", () => {
      const next = dispatch(initialReaderState, { type: "ChapterRetreated" });
      expect(next).toBe(initialReaderState);
    });

    it("is a no-op from loading", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef };
      const next = dispatch(state, { type: "ChapterRetreated" });
      expect(next).toBe(state);
    });
  });

  describe("PaletteReopened", () => {
    it("transitions loaded → awaiting with cleared query", () => {
      const state: ReaderState = { kind: "loaded", passage: mockPassage, ref: johnRef };
      const next = dispatch(state, { type: "PaletteReopened" });
      expect(next).toEqual({ kind: "awaiting", query: "", parseError: null });
    });

    it("transitions network-error → awaiting with cleared query", () => {
      const state: ReaderState = { kind: "network-error", ref: johnRef, reason: networkError };
      const next = dispatch(state, { type: "PaletteReopened" });
      expect(next).toEqual({ kind: "awaiting", query: "", parseError: null });
    });

    it("is a no-op from awaiting", () => {
      const next = dispatch(initialReaderState, { type: "PaletteReopened" });
      expect(next).toBe(initialReaderState);
    });

    it("is a no-op from loading", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef };
      const next = dispatch(state, { type: "PaletteReopened" });
      expect(next).toBe(state);
    });
  });
});
```

---

## 5. use-passage-fetch.ts — full content

File: `src/tui/reader/use-passage-fetch.ts`

```ts
import { useEffect } from "react";
import type { Dispatch } from "react";
import { getPassage } from "@/application/get-passage";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { RepoError } from "@/domain/errors";
import { isRepoError } from "@/domain/errors";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";

export function usePassageFetch(
  state: ReaderState,
  dispatch: Dispatch<ReaderAction>,
  repo: BibleRepository,
): void {
  useEffect(() => {
    if (state.kind !== "loading") return;

    let cancelled = false;
    const ref = state.ref;

    getPassage(repo, ref).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: "PassageFetched", passage: result.value });
      } else {
        const err = result.error;
        if (isRepoError(err)) {
          dispatch({ type: "FetchFailed", ref, reason: err });
        } else {
          dispatch({ type: "FetchFailed", ref, reason: { kind: "network", message: "parse error on response" } });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  // ref is an object — spread the scalar fields as deps to avoid stale closure on navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, state.kind === "loading" ? state.ref.book : null, state.kind === "loading" ? state.ref.chapter : null]);
}
```

**Design note on deps array:** `state.kind`, `state.ref.book`, and `state.ref.chapter` are the true dependency signals. Using `state.ref` (object reference) would cause a stale equality comparison; spreading the scalars is precise and avoids re-fetching unless the book or chapter actually changed.

---

## 6. reader-screen.tsx — full content

File: `src/tui/reader/reader-screen.tsx`

```tsx
import { useState, useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { SPINNER_FRAMES } from "@/cli/loading";
import { ACCENT_HEX } from "@/presentation/colors";
import { usePassageFetch } from "@/tui/reader/use-passage-fetch";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";
import type { Dispatch } from "react";

const DIM = TextAttributes.DIM;
const BOLD = TextAttributes.BOLD;

type ReaderScreenProps = {
  state: ReaderState;
  dispatch: Dispatch<ReaderAction>;
  repo: BibleRepository;
};

export function ReaderScreen({ state, dispatch, repo }: ReaderScreenProps) {
  usePassageFetch(state, dispatch, repo);

  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (state.kind !== "loading") return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, [state.kind]);

  if (state.kind === "awaiting") {
    return (
      <box flexDirection="column">
        <text attributes={DIM}>{"╭───────────────────────────────────────╮"}</text>
        <text>
          <span attributes={DIM}>{"│ ▶ "}</span>
          <input
            focused
            value={state.query}
            onChange={(v) => dispatch({ type: "QueryTyped", query: v })}
            onSubmit={() => dispatch({ type: "QuerySubmitted" })}
          />
          <span attributes={DIM}>{" │"}</span>
        </text>
        {state.parseError !== null && (
          <text fg={"\x1b[31m"}>{`│ ⚠ couldn't parse "${state.query}"`.padEnd(41) + "│"}</text>
        )}
        <text attributes={DIM}>{"╰───────────────────────────────────────╯"}</text>
        <text>{" "}</text>
        <text attributes={DIM}>{"  Enter open  •  Esc cancel  •  q quit"}</text>
      </box>
    );
  }

  if (state.kind === "loading") {
    return (
      <box flexDirection="column">
        <text attributes={DIM}>{`  ${SPINNER_FRAMES[frame]} loading…`}</text>
      </box>
    );
  }

  if (state.kind === "network-error") {
    const isLastChapter = state.reason.kind === "chapter_not_found";
    return (
      <box flexDirection="column">
        <text>
          <span attributes={DIM}>{"┌─ "}</span>
          <span fg={ACCENT_HEX} attributes={BOLD}>{`${state.ref.book} ${state.ref.chapter}`}</span>
          <span attributes={DIM}>{" ─────────────────────────────────────┐"}</span>
        </text>
        <text>{" "}</text>
        <text>{isLastChapter ? "  ⚠ last chapter reached" : "  ⚠ could not load — network unreachable"}</text>
        <text>{" "}</text>
        <text attributes={DIM}>{"└──────────────────────────────────────────────────────────────────┘"}</text>
        <text attributes={DIM}>{"  / palette  •  q quit"}</text>
      </box>
    );
  }

  const { passage, ref } = state;
  return (
    <box flexDirection="column">
      <text>
        <span attributes={DIM}>{"┌─ "}</span>
        <span fg={ACCENT_HEX} attributes={BOLD}>{`${ref.book} ${ref.chapter}`}</span>
        <span attributes={DIM}>{" ─ Berean Standard Bible ─────────────────────────────┐"}</span>
      </text>
      <text attributes={DIM}>{"│"}</text>
      {passage.verses.map((v) => (
        <text key={v.number}>
          <span attributes={DIM}>{`│  ${String(v.number).padStart(3)}  `}</span>
          {v.text}
          <span attributes={DIM}>{"  │"}</span>
        </text>
      ))}
      <text attributes={DIM}>{"│"}</text>
      <text attributes={DIM}>{"├──────────────────────────────────────────────────────────────────┤"}</text>
      <text attributes={DIM}>{"│  ] next ch  •  [ prev ch  •  / palette  •  q quit               │"}</text>
      <text attributes={DIM}>{"└──────────────────────────────────────────────────────────────────┘"}</text>
    </box>
  );
}
```

**Visual identity mapping (docs/ui-sketches.md):**
- Reference header: `fg={ACCENT_HEX}` + `BOLD` — accent token
- Border chrome: `attributes={DIM}` — muted token
- Verse numbers: `attributes={DIM}` — muted token
- Verse text: default fg, no attributes — text token
- Error `⚠` line: ANSI 31 red (`"\x1b[31m"`) — error token

**Palette scope:** The palette overlay in PR 1 is a plain single-input field — no result list sections. This satisfies REQ-3 through REQ-5 and matches the spec's `awaiting` state shape.

---

## 7. tui-driver.tsx — full diff

**Before:**

```tsx
import { useReducer } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
  welcomeReducer,
  initialWelcomeState,
} from "./welcome/welcome-reducer";
import { WelcomeScreen } from "./welcome/welcome-screen";
import type { CliRenderer } from "@opentui/core";

function App({
  renderer,
  resolve,
}: {
  renderer: CliRenderer;
  resolve: () => void;
}) {
  const [state, dispatch] = useReducer(welcomeReducer, initialWelcomeState);

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

// Resolves when the user quits. Does NOT call process.exit — that's the entry point's job.
export async function tuiDriver(): Promise<void> {
  // ... (TTY checks + renderer setup unchanged)
}
```

**After:**

```tsx
import { useReducer } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { readerReducer, initialReaderState } from "./reader/reader-reducer";
import { ReaderScreen } from "./reader/reader-screen";
import type { CliRenderer } from "@opentui/core";
import type { BibleRepository } from "@/application/ports/bible-repository";

function ReaderApp({
  renderer,
  resolve,
  repo,
}: {
  renderer: CliRenderer;
  resolve: () => void;
  repo: BibleRepository;
}) {
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);

  useKeyboard((keyEvent) => {
    if (keyEvent.name === "q" || keyEvent.name === "Q") {
      renderer.destroy();
      resolve();
      return;
    }
    if (keyEvent.name === "]") {
      dispatch({ type: "ChapterAdvanced" });
      return;
    }
    if (keyEvent.name === "[") {
      dispatch({ type: "ChapterRetreated" });
      return;
    }
    if (keyEvent.name === "/") {
      dispatch({ type: "PaletteReopened" });
      return;
    }
  });

  return <ReaderScreen state={state} dispatch={dispatch} repo={repo} />;
}

// Resolves when the user quits. Does NOT call process.exit — that's the entry point's job.
export async function tuiDriver(repo: BibleRepository): Promise<void> {
  if (!process.stdout.isTTY) {
    process.stderr.write(
      "verbum: interactive TUI requires a TTY — run without piping\n",
    );
    return;
  }

  const cols = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;
  if (cols < 60 || rows < 20) {
    process.stderr.write(
      `verbum: terminal too small (minimum 60×20, current ${cols}×${rows})\n`,
    );
    return;
  }

  // exitOnCtrlC: false — we route SIGINT through the same quit path as `q`.
  const renderer = await createCliRenderer({ exitOnCtrlC: false });

  return new Promise<void>((resolve) => {
    const sigintHandler = () => {
      renderer.destroy();
      resolve();
    };
    process.once("SIGINT", sigintHandler);

    // wrappedResolve detaches the SIGINT listener so the process can exit normally after a q-quit.
    const wrappedResolve = () => {
      process.off("SIGINT", sigintHandler);
      resolve();
    };

    createRoot(renderer).render(
      <ReaderApp renderer={renderer} resolve={wrappedResolve} repo={repo} />,
    );
  });
}
```

**Changes summary:**
- `welcomeReducer` + `WelcomeScreen` imports removed
- `BibleRepository` port type imported
- `App` component renamed to `ReaderApp`, receives `repo` prop
- `useKeyboard` gains `]`/`[`/`/` handlers that dispatch reducer actions
- `tuiDriver` signature: `(): Promise<void>` → `(repo: BibleRepository): Promise<void>`
- TTY/size guards and renderer/SIGINT plumbing unchanged

---

## 8. index.tsx — full diff

**Before:**

```tsx
import { run } from "./cli/run";
import { tuiDriver } from "./tui/tui-driver";

const argv = Bun.argv.slice(2);

if (argv.length === 0) {
  await tuiDriver();
  process.exit(0);
}

const exitCode = await run(argv);
process.exit(exitCode);
```

**After:**

```tsx
import { run } from "./cli/run";
import { tuiDriver } from "./tui/tui-driver";
import { createHelloAoBibleRepository } from "@/api/hello-ao-bible-repository";

const argv = Bun.argv.slice(2);

if (argv.length === 0) {
  const repo = createHelloAoBibleRepository();
  await tuiDriver(repo);
  process.exit(0);
}

const exitCode = await run(argv);
process.exit(exitCode);
```

**Changes:** one import added, `tuiDriver()` becomes `tuiDriver(repo)` with inline `createHelloAoBibleRepository()` construction — mirrors `src/cli/run.ts:39` pattern exactly.

---

## 9. Strict-TDD order

```
1. RED   src/domain/reference.test.ts         — chapter-only tests fail (parser not extended yet)
2. GREEN src/domain/reference.ts              — extend parser to accept <book> <chapter>
         bun test src/domain/reference.test.ts — all pass including regression suite
3. RED   src/tui/reader/reader-reducer.test.ts — all transition tests fail (file doesn't exist)
4. GREEN src/tui/reader/reader-reducer.ts      — implement reducer + handler table
         bun test src/tui/reader/reader-reducer.test.ts — all pass
5. IMPL  src/tui/reader/use-passage-fetch.ts   — no automated test (PTY hook); reducer tests
         cover the dispatch shape it produces
6. IMPL  src/tui/reader/reader-screen.tsx      — no automated test (PTY-only render)
7. IMPL  src/tui/tui-driver.tsx                — update imports, signature, keyboard handlers
8. IMPL  src/index.tsx                         — wire createHelloAoBibleRepository() + tuiDriver(repo)
9. VERIFY bun test                             — full suite: 99 pre-existing + reducer tests
                                                 + parseReference chapter-only tests pass
         bun run tsc --noEmit                  — exits 0
         manual: bun start → palette → "john 3" Enter → spinner → verses → ] → [ → / → q
```

---

## 10. Commit plan

```
C1  feat(domain): parseReference accepts chapter-only refs
    Files: src/domain/reference.ts, src/domain/reference.test.ts

C2  feat(tui): reader reducer and async passage fetch hook
    Files: src/tui/reader/reader-reducer.ts, src/tui/reader/reader-reducer.test.ts,
           src/tui/reader/use-passage-fetch.ts

C3  feat(tui): reader screen replaces welcome on no-args
    Files: src/tui/reader/reader-screen.tsx, src/tui/tui-driver.tsx, src/index.tsx
```

Commit boundaries are reviewer preference. Single squash acceptable if the team prefers one logical diff per feature.

---

## 11. Risks & mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `<input>` onSubmit signature | **Resolved** | Verified at design time: `onSubmit?: (value: string) => void` (line 45, components.d.ts). Screen reads submitted value from `onSubmit(value)` — but implementation opts to use `state.query` from reducer for consistency; both approaches are valid. |
| `useEffect` deps array stale ref | Medium | Deps are `[state.kind, state.ref.book, state.ref.chapter]` — scalar fields, not the object reference. This is explicit in use-passage-fetch.ts and documented with a comment. |
| Reading view word-wrap | Low | Not addressed in PR 1. Verse text renders as single string per verse — terminal wraps naturally. Word-aware wrapping is a known follow-up (noted in ui-sketches.md). |
| PTY-only smoke for `bun start` | Low | Manual reviewer step. Reducer unit tests cover all state transitions. Integration path is: index.tsx → tuiDriver → ReaderApp → ReaderScreen → usePassageFetch → getPassage. |
| `getPassage` returns `AppError` (ParseError \| RepoError) | Low | `use-passage-fetch.ts` narrows via `isRepoError` and synthesizes a fallback `network` error for the ParseError branch. This path is not exercised in normal operation — whole-chapter refs always produce valid verse ranges. |
| Translation hard-coded to BSB | Known | `getPassage` uses `DEFAULT_TRANSLATION_ID`. Translation picker is out of scope for PR 1. Reference header in reader-screen.tsx hard-codes "Berean Standard Bible" — accept for PR 1. |
