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
