import { describe, it, expect } from "bun:test";
import { readerReducer, initialReaderState, VERSES_PER_PAGE } from "@/tui/reader/reader-reducer";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";
import type { BookSuggestion } from "@/domain/book-suggestions";
import type { Passage } from "@/domain/passage";
import type { RepoError } from "@/domain/errors";
import type { Reference } from "@/domain/reference";
import { chaptersForBook } from "@/domain/book-chapters";

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
  return { kind: "loaded", passage, ref: johnRef, cursorIndex, pageStartIndex, versePicker: null };
}

function dispatch(state: ReaderState, action: ReaderAction): ReaderState {
  return readerReducer(state, action);
}

describe("readerReducer", () => {
  describe("initial state", () => {
    it("starts in awaiting with empty query, no parseError, empty suggestions, and selectedIndex -1", () => {
      expect(initialReaderState).toEqual({
        kind: "awaiting",
        query: "",
        parseError: null,
        suggestions: [],
        selectedIndex: -1,
        phase: "book",
        chapters: [],
        bookChosen: null,
      });
    });
  });

  describe("VERSES_PER_PAGE", () => {
    it("equals 15", () => {
      expect(VERSES_PER_PAGE).toBe(15);
    });
  });

  describe("QueryTyped", () => {
    it("updates query, clears parseError, recomputes suggestions, and resets selectedIndex when awaiting", () => {
      const state: ReaderState = {
        kind: "awaiting",
        query: "",
        parseError: { kind: "empty_input" },
        suggestions: [],
        selectedIndex: 2,
        phase: "book",
        chapters: [],
        bookChosen: null,
      };
      const next = dispatch(state, { type: "QueryTyped", query: "joh" });
      expect(next.kind).toBe("awaiting");
      if (next.kind !== "awaiting") return;
      expect(next.query).toBe("joh");
      expect(next.parseError).toBeNull();
      expect(next.selectedIndex).toBe(-1);
      expect(next.suggestions.length).toBeGreaterThan(0);
    });

    it("populates suggestions matching the query", () => {
      const state: ReaderState = {
        kind: "awaiting",
        query: "",
        parseError: null,
        suggestions: [],
        selectedIndex: -1,
        phase: "book",
        chapters: [],
        bookChosen: null,
      };
      const next = dispatch(state, { type: "QueryTyped", query: "joh" });
      if (next.kind !== "awaiting") return;
      const displayNames = next.suggestions.map((s) => s.displayName);
      expect(displayNames).toContain("John");
    });

    it("is a no-op when not awaiting", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
      const next = dispatch(state, { type: "QueryTyped", query: "genesis 1" });
      expect(next).toBe(state);
    });
  });

  describe("QuerySubmitted", () => {
    it("transitions awaiting → loading when query parses ok", () => {
      const state: ReaderState = { kind: "awaiting", query: "john 3", parseError: null, suggestions: [], selectedIndex: -1, phase: "book", chapters: [], bookChosen: null };
      const next = dispatch(state, { type: "QuerySubmitted" });
      expect(next.kind).toBe("loading");
      if (next.kind !== "loading") return;
      expect(next.ref.book as string).toBe("JHN");
      expect(next.ref.chapter).toBe(3);
    });

    it("stays awaiting with parseError when query is malformed", () => {
      const state: ReaderState = { kind: "awaiting", query: "jhn 3x", parseError: null, suggestions: [], selectedIndex: -1, phase: "book", chapters: [], bookChosen: null };
      const next = dispatch(state, { type: "QuerySubmitted" });
      expect(next.kind).toBe("awaiting");
      if (next.kind !== "awaiting") return;
      expect(next.parseError).not.toBeNull();
      expect(next.parseError?.kind).toBe("malformed_chapter_verse");
    });

    it("stays awaiting with parseError for empty query", () => {
      const state: ReaderState = { kind: "awaiting", query: "", parseError: null, suggestions: [], selectedIndex: -1, phase: "book", chapters: [], bookChosen: null };
      const next = dispatch(state, { type: "QuerySubmitted" });
      expect(next.kind).toBe("awaiting");
      if (next.kind !== "awaiting") return;
      expect(next.parseError?.kind).toBe("empty_input");
    });

    it("is a no-op when not awaiting", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
      const next = dispatch(state, { type: "QuerySubmitted" });
      expect(next).toBe(state);
    });
  });

  describe("PassageFetched", () => {
    it("defaults cursorIndex to 0 when the ref's target verse is not in the passage", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
      const next = dispatch(state, { type: "PassageFetched", passage: mockPassage });
      expect(next).toEqual({
        kind: "loaded",
        passage: mockPassage,
        ref: johnRef,
        cursorIndex: 0,
        pageStartIndex: 0,
        versePicker: null,
      });
    });

    it("positions cursor on the verse matching ref.verses.start (page 2)", () => {
      const passage = makePassage(VERSES_PER_PAGE * 3);
      const targetVerse = VERSES_PER_PAGE + 1;
      const ref: Reference = { ...johnRef, verses: { start: targetVerse, end: targetVerse } };
      const state: ReaderState = { kind: "loading", ref, intent: "view" };
      const next = dispatch(state, { type: "PassageFetched", passage });
      if (next.kind !== "loaded") throw new Error("expected loaded state");
      expect(next.cursorIndex).toBe(targetVerse - 1);
      expect(next.pageStartIndex).toBe(VERSES_PER_PAGE);
    });

    it("places page boundary correctly on the third page", () => {
      const passage = makePassage(VERSES_PER_PAGE * 3);
      const targetVerse = VERSES_PER_PAGE * 2 + 1;
      const ref: Reference = { ...johnRef, verses: { start: targetVerse, end: targetVerse } };
      const state: ReaderState = { kind: "loading", ref, intent: "view" };
      const next = dispatch(state, { type: "PassageFetched", passage });
      if (next.kind !== "loaded") throw new Error("expected loaded state");
      expect(next.cursorIndex).toBe(targetVerse - 1);
      expect(next.pageStartIndex).toBe(VERSES_PER_PAGE * 2);
    });

    it("is a no-op when not loading", () => {
      const state = makeLoaded(mockPassage, 0, 0);
      const next = dispatch(state, { type: "PassageFetched", passage: mockPassage });
      expect(next).toBe(state);
    });
  });

  describe("FetchFailed", () => {
    it("transitions loading → network-error", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
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
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
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
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
      const next = dispatch(state, { type: "ChapterRetreated" });
      expect(next).toBe(state);
    });
  });

  describe("PaletteReopened", () => {
    it("transitions loaded → awaiting with cleared query, empty suggestions, selectedIndex -1", () => {
      const state = makeLoaded(mockPassage, 0, 0);
      const next = dispatch(state, { type: "PaletteReopened" });
      expect(next).toEqual({
        kind: "awaiting",
        query: "",
        parseError: null,
        suggestions: [],
        selectedIndex: -1,
        phase: "book",
        chapters: [],
        bookChosen: null,
      });
    });

    it("transitions network-error → awaiting with cleared query, empty suggestions, selectedIndex -1", () => {
      const state: ReaderState = { kind: "network-error", ref: johnRef, reason: networkError };
      const next = dispatch(state, { type: "PaletteReopened" });
      expect(next).toEqual({
        kind: "awaiting",
        query: "",
        parseError: null,
        suggestions: [],
        selectedIndex: -1,
        phase: "book",
        chapters: [],
        bookChosen: null,
      });
    });

    it("is a no-op from awaiting", () => {
      const next = dispatch(initialReaderState, { type: "PaletteReopened" });
      expect(next).toBe(initialReaderState);
    });

    it("is a no-op from loading", () => {
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
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
      { kind: "awaiting", query: "", parseError: null, suggestions: [], selectedIndex: -1, phase: "book", chapters: [], bookChosen: null },
      { kind: "loading", ref: johnRef, intent: "view" },
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
      const p = makePassage(VERSES_PER_PAGE * 2);
      const state = makeLoaded(p, VERSES_PER_PAGE - 1, 0);
      const next = dispatch(state, { type: "CursorMovedDown" });
      expect(next).toEqual(makeLoaded(p, VERSES_PER_PAGE, VERSES_PER_PAGE));
    });

    it("clamps at last verse of last page", () => {
      const total = VERSES_PER_PAGE + 2;
      const p = makePassage(total);
      const state = makeLoaded(p, total - 1, VERSES_PER_PAGE);
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
      const p = makePassage(VERSES_PER_PAGE * 2);
      const state = makeLoaded(p, VERSES_PER_PAGE, VERSES_PER_PAGE);
      const next = dispatch(state, { type: "CursorMovedUp" });
      expect(next).toEqual(makeLoaded(p, VERSES_PER_PAGE - 1, 0));
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
      const p = makePassage(VERSES_PER_PAGE * 2);
      const state = makeLoaded(p, 3, 0);
      const next = dispatch(state, { type: "PageAdvanced" });
      expect(next).toEqual(makeLoaded(p, VERSES_PER_PAGE, VERSES_PER_PAGE));
    });

    it("clamps at last page", () => {
      const total = VERSES_PER_PAGE + 2;
      const p = makePassage(total);
      const state = makeLoaded(p, total - 1, VERSES_PER_PAGE);
      const next = dispatch(state, { type: "PageAdvanced" });
      expect(next).toBe(state);
    });
  });

  describe("PageRetreated", () => {
    it("retreats to previous page and sets cursorIndex to new pageStartIndex", () => {
      const p = makePassage(VERSES_PER_PAGE * 2);
      const state = makeLoaded(p, VERSES_PER_PAGE + 2, VERSES_PER_PAGE);
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

  const mockSuggestions: BookSuggestion[] = [
    { alias: "john", canonical: "JHN", displayName: "John" },
    { alias: "1john", canonical: "1JN", displayName: "1 John" },
    { alias: "2john", canonical: "2JN", displayName: "2 John" },
    { alias: "3john", canonical: "3JN", displayName: "3 John" },
  ];

  function makeAwaiting(overrides: Partial<{
    query: string;
    parseError: null | { kind: string };
    suggestions: BookSuggestion[];
    selectedIndex: number;
    phase: "book" | "chapter";
    chapters: number[];
    bookChosen: BookSuggestion | null;
  }> = {}): ReaderState {
    return {
      kind: "awaiting",
      query: "",
      parseError: null,
      suggestions: [],
      selectedIndex: -1,
      phase: "book",
      chapters: [],
      bookChosen: null,
      ...overrides,
    } as ReaderState;
  }

  describe("SuggestionMovedDown", () => {
    it("increments selectedIndex from -1 to 0", () => {
      const state = makeAwaiting({ suggestions: mockSuggestions, selectedIndex: -1 });
      const next = dispatch(state, { type: "SuggestionMovedDown" });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.selectedIndex).toBe(0);
    });

    it("clamps at bottom (suggestions.length - 1)", () => {
      const state = makeAwaiting({ suggestions: mockSuggestions, selectedIndex: 3 });
      const next = dispatch(state, { type: "SuggestionMovedDown" });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.selectedIndex).toBe(3);
    });

    it("is a no-op when suggestions is empty", () => {
      const state = makeAwaiting({ suggestions: [], selectedIndex: -1 });
      const next = dispatch(state, { type: "SuggestionMovedDown" });
      expect(next).toBe(state);
    });
  });

  describe("SuggestionMovedUp", () => {
    it("decrements selectedIndex from 2 to 1", () => {
      const state = makeAwaiting({ suggestions: mockSuggestions, selectedIndex: 2 });
      const next = dispatch(state, { type: "SuggestionMovedUp" });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.selectedIndex).toBe(1);
    });

    it("clamps at 0 (does not return to -1)", () => {
      const state = makeAwaiting({ suggestions: mockSuggestions, selectedIndex: 0 });
      const next = dispatch(state, { type: "SuggestionMovedUp" });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.selectedIndex).toBe(0);
    });

    it("is a no-op when suggestions is empty", () => {
      const state = makeAwaiting({ suggestions: [], selectedIndex: -1 });
      const next = dispatch(state, { type: "SuggestionMovedUp" });
      expect(next).toBe(state);
    });
  });

  describe("SuggestionAccepted (book phase)", () => {
    it("transitions to chapter phase with bookChosen, chapters, selectedIndex 0", () => {
      const state = makeAwaiting({ suggestions: mockSuggestions, selectedIndex: 0, phase: "book" });
      const next = dispatch(state, { type: "SuggestionAccepted" });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.phase).toBe("chapter");
      expect(next.bookChosen?.canonical).toBe("JHN");
      expect(next.chapters).toEqual(Array.from({ length: chaptersForBook("JHN") }, (_, i) => i + 1));
      expect(next.selectedIndex).toBe(0);
      expect(next.suggestions).toEqual([]);
      expect(next.query).toBe("John ");
    });

    it("is a no-op when selectedIndex is -1", () => {
      const state = makeAwaiting({ suggestions: mockSuggestions, selectedIndex: -1, phase: "book" });
      const next = dispatch(state, { type: "SuggestionAccepted" });
      expect(next).toBe(state);
    });
  });

  describe("SuggestionAccepted (chapter phase)", () => {
    it("transitions to loading/pick-verse with correct ref", () => {
      const chapters = Array.from({ length: 21 }, (_, i) => i + 1);
      const state = makeAwaiting({
        phase: "chapter",
        bookChosen: { alias: "john", canonical: "JHN", displayName: "John" },
        chapters,
        selectedIndex: 2,
      });
      const next = dispatch(state, { type: "SuggestionAccepted" });
      expect(next.kind).toBe("loading");
      if (next.kind !== "loading") return;
      expect(next.ref.chapter).toBe(3);
      expect(next.intent).toBe("pick-verse");
    });

    it("is a no-op when bookChosen is null", () => {
      const state = makeAwaiting({ phase: "chapter", bookChosen: null, chapters: [1, 2, 3], selectedIndex: 0 });
      const next = dispatch(state, { type: "SuggestionAccepted" });
      expect(next).toBe(state);
    });
  });

  describe("QueryTyped (chapter phase override)", () => {
    it("resets to book phase when the new query no longer starts with the chosen book name", () => {
      const state = makeAwaiting({
        phase: "chapter",
        bookChosen: { alias: "john", canonical: "JHN", displayName: "John" },
        chapters: [1, 2, 3],
        selectedIndex: 1,
      });
      const next = dispatch(state, { type: "QueryTyped", query: "j" });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.phase).toBe("book");
      expect(next.bookChosen).toBeNull();
      expect(next.chapters).toEqual([]);
      expect(next.suggestions.length).toBeGreaterThan(0);
    });

    it("preserves chapter phase when the new query still has the chosen book prefix", () => {
      // Why: OpenTUI's controlled <input> synthesizes onInput when value changes
      // programmatically (e.g. after SuggestionAccepted rewrites query to "John ").
      // Without this preservation the user would be kicked out of chapter mode
      // immediately on every book pick.
      const state = makeAwaiting({
        phase: "chapter",
        bookChosen: { alias: "john", canonical: "JHN", displayName: "John" },
        chapters: [1, 2, 3, 4, 5],
        selectedIndex: 0,
        query: "John ",
      });
      const next = dispatch(state, { type: "QueryTyped", query: "John " });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.phase).toBe("chapter");
      expect(next.bookChosen).not.toBeNull();
      expect(next.chapters).toEqual([1, 2, 3, 4, 5]);
      expect(next.selectedIndex).toBe(0);
    });

    it("preserves chapter phase case-insensitively", () => {
      const state = makeAwaiting({
        phase: "chapter",
        bookChosen: { alias: "john", canonical: "JHN", displayName: "John" },
        chapters: [1, 2, 3],
        selectedIndex: 0,
        query: "JOHN ",
      });
      const next = dispatch(state, { type: "QueryTyped", query: "JOHN 3" });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.phase).toBe("chapter");
    });
  });

  describe("PassageFetched (intent branches)", () => {
    it("opens versePicker when intent is pick-verse", () => {
      const passage = makePassage(21);
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "pick-verse" };
      const next = dispatch(state, { type: "PassageFetched", passage });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker).toEqual({ selectedIndex: 0 });
    });

    it("sets versePicker null when intent is view", () => {
      const passage = makePassage(21);
      const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
      const next = dispatch(state, { type: "PassageFetched", passage });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker).toBeNull();
    });
  });

  describe("VersePickerMovedDown", () => {
    it("increments selectedIndex by 10 (SCENARIO-09, normal)", () => {
      const passage = makePassage(21);
      const state = { ...makeLoaded(passage, 0, 0), versePicker: { selectedIndex: 5 } } as ReaderState;
      const next = dispatch(state, { type: "VersePickerMovedDown" });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker?.selectedIndex).toBe(15);
    });

    it("clamps at passage.verses.length - 1 (SCENARIO-09, clamped)", () => {
      const passage = makePassage(21);
      const state = { ...makeLoaded(passage, 0, 0), versePicker: { selectedIndex: 15 } } as ReaderState;
      const next = dispatch(state, { type: "VersePickerMovedDown" });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker?.selectedIndex).toBe(20);
    });

    it("is a no-op when versePicker is null", () => {
      const state = makeLoaded(makePassage(10), 0, 0);
      const next = dispatch(state, { type: "VersePickerMovedDown" });
      expect(next).toBe(state);
    });
  });

  describe("VersePickerMovedUp", () => {
    it("decrements selectedIndex by 10, clamped to 0 (SCENARIO-10)", () => {
      const passage = makePassage(21);
      const state = { ...makeLoaded(passage, 0, 0), versePicker: { selectedIndex: 3 } } as ReaderState;
      const next = dispatch(state, { type: "VersePickerMovedUp" });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker?.selectedIndex).toBe(0);
    });

    it("is a no-op when versePicker is null", () => {
      const state = makeLoaded(makePassage(10), 0, 0);
      const next = dispatch(state, { type: "VersePickerMovedUp" });
      expect(next).toBe(state);
    });
  });

  describe("VersePickerMovedRight", () => {
    it("increments by 1, clamped to verses.length - 1 (SCENARIO-11)", () => {
      const passage = makePassage(5);
      const state = { ...makeLoaded(passage, 0, 0), versePicker: { selectedIndex: 4 } } as ReaderState;
      const next = dispatch(state, { type: "VersePickerMovedRight" });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker?.selectedIndex).toBe(4);
    });

    it("is a no-op when versePicker is null", () => {
      const state = makeLoaded(makePassage(5), 0, 0);
      const next = dispatch(state, { type: "VersePickerMovedRight" });
      expect(next).toBe(state);
    });
  });

  describe("VersePickerMovedLeft", () => {
    it("decrements by 1, clamped to 0 (SCENARIO-12)", () => {
      const passage = makePassage(5);
      const state = { ...makeLoaded(passage, 0, 0), versePicker: { selectedIndex: 0 } } as ReaderState;
      const next = dispatch(state, { type: "VersePickerMovedLeft" });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker?.selectedIndex).toBe(0);
    });

    it("is a no-op when versePicker is null", () => {
      const state = makeLoaded(makePassage(5), 0, 0);
      const next = dispatch(state, { type: "VersePickerMovedLeft" });
      expect(next).toBe(state);
    });
  });

  describe("VersePickerAccepted", () => {
    it("lands cursor at selectedIndex and closes overlay (SCENARIO-13)", () => {
      const passage = makePassage(21);
      const state = { ...makeLoaded(passage, 0, 0), versePicker: { selectedIndex: 15 } } as ReaderState;
      const next = dispatch(state, { type: "VersePickerAccepted" });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker).toBeNull();
      expect(next.cursorIndex).toBe(15);
      expect(next.pageStartIndex).toBe(Math.floor(15 / VERSES_PER_PAGE) * VERSES_PER_PAGE);
    });

    it("is a no-op when versePicker is null", () => {
      const state = makeLoaded(makePassage(21), 0, 0);
      const next = dispatch(state, { type: "VersePickerAccepted" });
      expect(next).toBe(state);
    });
  });

  describe("VersePickerCancelled", () => {
    it("closes overlay, leaves cursorIndex at 0 (SCENARIO-14)", () => {
      const passage = makePassage(21);
      const state = { ...makeLoaded(passage, 0, 0), versePicker: { selectedIndex: 10 } } as ReaderState;
      const next = dispatch(state, { type: "VersePickerCancelled" });
      if (next.kind !== "loaded") throw new Error("expected loaded");
      expect(next.versePicker).toBeNull();
      expect(next.cursorIndex).toBe(0);
    });

    it("is a no-op when versePicker is null", () => {
      const state = makeLoaded(makePassage(21), 0, 0);
      const next = dispatch(state, { type: "VersePickerCancelled" });
      expect(next).toBe(state);
    });
  });

  describe("PickerBackedOut", () => {
    it("returns from chapter to book phase, restores suggestBooks (SCENARIO-15)", () => {
      const state = makeAwaiting({
        phase: "chapter",
        query: "john ",
        bookChosen: { alias: "john", canonical: "JHN", displayName: "John" },
        chapters: [1, 2, 3],
        selectedIndex: 1,
      });
      const next = dispatch(state, { type: "PickerBackedOut" });
      if (next.kind !== "awaiting") throw new Error("expected awaiting");
      expect(next.phase).toBe("book");
      expect(next.bookChosen).toBeNull();
      expect(next.chapters).toEqual([]);
      expect(next.selectedIndex).toBe(-1);
      expect(next.suggestions.length).toBeGreaterThan(0);
    });

    it("is a no-op when phase is book (SCENARIO-16)", () => {
      const state = makeAwaiting({ phase: "book" });
      const next = dispatch(state, { type: "PickerBackedOut" });
      expect(next).toBe(state);
    });
  });
});
