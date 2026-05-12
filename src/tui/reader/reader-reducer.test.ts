import { describe, it, expect } from "bun:test";
import { readerReducer, initialReaderState, VERSES_PER_PAGE } from "@/tui/reader/reader-reducer";
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

function makePassage(count: number): Passage {
  return {
    reference: johnRef,
    verses: Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      text: `Verse ${i + 1}`,
    })),
  };
}

function makeLoaded(
  passage: Passage,
  cursorIndex: number,
  pageStartIndex: number,
): ReaderState {
  return { kind: "loaded", passage, ref: johnRef, cursorIndex, pageStartIndex };
}

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

  describe("VERSES_PER_PAGE", () => {
    it("equals 8", () => {
      expect(VERSES_PER_PAGE).toBe(8);
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
    it("defaults cursorIndex to 0 when the ref's target verse is not in the passage", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef };
      const next = dispatch(state, { type: "PassageFetched", passage: mockPassage });
      expect(next).toEqual({
        kind: "loaded",
        passage: mockPassage,
        ref: johnRef,
        cursorIndex: 0,
        pageStartIndex: 0,
      });
    });

    it("positions cursor on the verse matching ref.verses.start", () => {
      // John 3:16 — passage has 36 verses, target verse 16 should land at index 15.
      const passage = makePassage(36);
      const ref: Reference = { ...johnRef, verses: { start: 16, end: 16 } };
      const state: ReaderState = { kind: "loading", ref };
      const next = dispatch(state, { type: "PassageFetched", passage });
      if (next.kind !== "loaded") throw new Error("expected loaded state");
      expect(next.cursorIndex).toBe(15);
      // Verse 16 (index 15) belongs to page 2 (indices 8-15) when VERSES_PER_PAGE === 8.
      expect(next.pageStartIndex).toBe(8);
    });

    it("places page boundary correctly on the third page (verse 17 → index 16, page 3)", () => {
      const passage = makePassage(36);
      const ref: Reference = { ...johnRef, verses: { start: 17, end: 17 } };
      const state: ReaderState = { kind: "loading", ref };
      const next = dispatch(state, { type: "PassageFetched", passage });
      if (next.kind !== "loaded") throw new Error("expected loaded state");
      expect(next.cursorIndex).toBe(16);
      expect(next.pageStartIndex).toBe(16);
    });

    it("is a no-op when not loading", () => {
      const state = makeLoaded(mockPassage, 0, 0);
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
      const state = makeLoaded(mockPassage, 0, 0);
      const next = dispatch(state, { type: "FetchFailed", ref: johnRef, reason: networkError });
      expect(next).toBe(state);
    });
  });

  describe("ChapterAdvanced", () => {
    it("transitions loaded → loading with chapter + 1 and resets ref.verses to {1, 1}", () => {
      // Why: ref.verses comes from the user's original input (e.g. john 3:16). On chapter
      // advance the cursor should land at the top of the new chapter, not at verse 16.
      const stateWithVerse16 = makeLoaded(mockPassage, 0, 0);
      const refWithVerse16 = { ...johnRef, verses: { start: 16, end: 16 } };
      const adjusted = { ...stateWithVerse16, ref: refWithVerse16 } as ReaderState;
      const next = dispatch(adjusted, { type: "ChapterAdvanced" });
      expect(next.kind).toBe("loading");
      if (next.kind !== "loading") return;
      expect(next.ref.chapter).toBe(4);
      expect(next.ref.verses).toEqual({ start: 1, end: 1 });
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

    it("loaded → loading carries no cursorIndex or pageStartIndex", () => {
      const state = makeLoaded(mockPassage, 2, 0);
      const next = dispatch(state, { type: "ChapterAdvanced" });
      expect(next.kind).toBe("loading");
      expect((next as any).cursorIndex).toBeUndefined();
      expect((next as any).pageStartIndex).toBeUndefined();
    });
  });

  describe("ChapterRetreated", () => {
    it("transitions loaded → loading with chapter - 1 when chapter > 1", () => {
      const state = makeLoaded(mockPassage, 0, 0);
      const adjustedState = { ...state, ref: { ...johnRef, chapter: 5 } } as ReaderState;
      const next = dispatch(adjustedState, { type: "ChapterRetreated" });
      expect(next.kind).toBe("loading");
      if (next.kind !== "loading") return;
      expect(next.ref.chapter).toBe(4);
    });

    it("is a no-op when chapter === 1 (floor)", () => {
      const state = makeLoaded(mockPassage, 0, 0);
      const adjustedState = { ...state, ref: { ...johnRef, chapter: 1 } } as ReaderState;
      const next = dispatch(adjustedState, { type: "ChapterRetreated" });
      expect(next).toBe(adjustedState);
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
      const state = makeLoaded(mockPassage, 0, 0);
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

  describe("new actions are no-ops outside loaded", () => {
    const newActions: ReaderAction[] = [
      { type: "CursorMovedUp" },
      { type: "CursorMovedDown" },
      { type: "PageAdvanced" },
      { type: "PageRetreated" },
    ];

    const nonLoadedStates: ReaderState[] = [
      { kind: "awaiting", query: "", parseError: null },
      { kind: "loading", ref: johnRef },
      { kind: "network-error", ref: johnRef, reason: networkError },
    ];

    for (const action of newActions) {
      for (const state of nonLoadedStates) {
        it(`${action.type} is a no-op when state.kind === "${state.kind}"`, () => {
          expect(dispatch(state, action)).toBe(state);
        });
      }
    }
  });

  describe("CursorMovedDown", () => {
    it("increments cursorIndex within page", () => {
      const p = makePassage(10);
      const state = makeLoaded(p, 0, 0);
      const next = dispatch(state, { type: "CursorMovedDown" });
      expect(next).toEqual(makeLoaded(p, 1, 0));
    });

    it("advances page and resets cursor at page boundary", () => {
      const p = makePassage(16);
      const state = makeLoaded(p, 7, 0);
      const next = dispatch(state, { type: "CursorMovedDown" });
      expect(next).toEqual(makeLoaded(p, 8, 8));
    });

    it("clamps at last verse of last page", () => {
      const p = makePassage(10);
      const state = makeLoaded(p, 9, 8);
      const next = dispatch(state, { type: "CursorMovedDown" });
      expect(next).toBe(state);
    });
  });

  describe("CursorMovedUp", () => {
    it("decrements cursorIndex within page", () => {
      const p = makePassage(10);
      const state = makeLoaded(p, 3, 0);
      const next = dispatch(state, { type: "CursorMovedUp" });
      expect(next).toEqual(makeLoaded(p, 2, 0));
    });

    it("retreats page and sets cursor to last verse of retreated page", () => {
      const p = makePassage(16);
      const state = makeLoaded(p, 8, 8);
      const next = dispatch(state, { type: "CursorMovedUp" });
      expect(next).toEqual(makeLoaded(p, 7, 0));
    });

    it("clamps at first verse of first page", () => {
      const p = makePassage(10);
      const state = makeLoaded(p, 0, 0);
      const next = dispatch(state, { type: "CursorMovedUp" });
      expect(next).toBe(state);
    });
  });

  describe("PageAdvanced", () => {
    it("advances to next page and sets cursorIndex to pageStartIndex", () => {
      const p = makePassage(16);
      const state = makeLoaded(p, 3, 0);
      const next = dispatch(state, { type: "PageAdvanced" });
      expect(next).toEqual(makeLoaded(p, 8, 8));
    });

    it("clamps at last page", () => {
      const p = makePassage(10);
      const state = makeLoaded(p, 9, 8);
      const next = dispatch(state, { type: "PageAdvanced" });
      expect(next).toBe(state);
    });
  });

  describe("PageRetreated", () => {
    it("retreats to previous page and sets cursorIndex to new pageStartIndex", () => {
      const p = makePassage(16);
      const state = makeLoaded(p, 10, 8);
      const next = dispatch(state, { type: "PageRetreated" });
      expect(next).toEqual(makeLoaded(p, 0, 0));
    });

    it("clamps at first page", () => {
      const p = makePassage(10);
      const state = makeLoaded(p, 2, 0);
      const next = dispatch(state, { type: "PageRetreated" });
      expect(next).toBe(state);
    });
  });
});
