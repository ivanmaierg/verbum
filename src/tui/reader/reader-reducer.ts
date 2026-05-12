import { parseReference } from "@/domain/reference";
import { suggestBooks } from "@/domain/book-suggestions";
import { chaptersForBook } from "@/domain/book-chapters";
import { bookIdFromCanonical } from "@/domain/book-id";
import type { BookSuggestion } from "@/domain/book-suggestions";
import type { Reference } from "@/domain/reference";
import type { ParseError, RepoError } from "@/domain/errors";
import type { Passage } from "@/domain/passage";

export const VERSES_PER_PAGE = 15;

export type ReaderState =
  | { kind: "awaiting"; query: string; parseError: ParseError | null; suggestions: BookSuggestion[]; selectedIndex: number; phase: "book" | "chapter"; chapters: number[]; bookChosen: BookSuggestion | null }
  | { kind: "loading"; ref: Reference; intent: "view" | "pick-verse" }
  | { kind: "loaded"; passage: Passage; ref: Reference; cursorIndex: number; pageStartIndex: number; versePicker: { selectedIndex: number } | null }
  | { kind: "network-error"; ref: Reference; reason: RepoError };

export type ReaderAction =
  | { type: "QueryTyped"; query: string }
  | { type: "QuerySubmitted" }
  | { type: "PassageFetched"; passage: Passage }
  | { type: "FetchFailed"; ref: Reference; reason: RepoError }
  | { type: "ChapterAdvanced" }
  | { type: "ChapterRetreated" }
  | { type: "PaletteReopened" }
  | { type: "CursorMovedUp" }
  | { type: "CursorMovedDown" }
  | { type: "PageAdvanced" }
  | { type: "PageRetreated" }
  | { type: "SuggestionMovedUp" }
  | { type: "SuggestionMovedDown" }
  | { type: "SuggestionAccepted" }
  | { type: "BookChosen" }
  | { type: "ChapterChosen" }
  | { type: "VersePickerMovedUp" }
  | { type: "VersePickerMovedDown" }
  | { type: "VersePickerMovedLeft" }
  | { type: "VersePickerMovedRight" }
  | { type: "VersePickerAccepted" }
  | { type: "VersePickerCancelled" }
  | { type: "PickerBackedOut" };

const handlers = {
  QueryTyped: (s: ReaderState, a: Extract<ReaderAction, { type: "QueryTyped" }>): ReaderState => {
    if (s.kind !== "awaiting") return s;
    // Stay in chapter phase if the new query still has the chosen book's display
    // name as a prefix. Without this, OpenTUI's controlled <input> kicks us out
    // of chapter mode the instant SuggestionAccepted programmatically rewrites
    // the query, because the value-prop change synthesizes an onInput event.
    if (
      s.phase === "chapter" &&
      s.bookChosen !== null &&
      a.query.toLowerCase().startsWith(`${s.bookChosen.displayName.toLowerCase()} `)
    ) {
      return { ...s, query: a.query, parseError: null };
    }
    return {
      ...s,
      query: a.query,
      parseError: null,
      suggestions: suggestBooks(a.query),
      selectedIndex: -1,
      phase: "book",
      bookChosen: null,
      chapters: [],
    };
  },

  QuerySubmitted: (s: ReaderState, _a: Extract<ReaderAction, { type: "QuerySubmitted" }>): ReaderState => {
    if (s.kind !== "awaiting") return s;
    const result = parseReference(s.query);
    return result.ok
      ? { kind: "loading", ref: result.value, intent: "view" }
      : { ...s, parseError: result.error };
  },

  PassageFetched: (s: ReaderState, a: Extract<ReaderAction, { type: "PassageFetched" }>): ReaderState => {
    if (s.kind !== "loading") return s;
    const targetVerse = s.ref.verses.start;
    const foundIndex = a.passage.verses.findIndex((v) => v.number === targetVerse);
    const cursorIndex = foundIndex >= 0 ? foundIndex : 0;
    const pageStartIndex = Math.floor(cursorIndex / VERSES_PER_PAGE) * VERSES_PER_PAGE;
    const versePicker = s.intent === "pick-verse" ? { selectedIndex: 0 } : null;
    return { kind: "loaded", passage: a.passage, ref: s.ref, cursorIndex, pageStartIndex, versePicker };
  },

  FetchFailed: (s: ReaderState, a: Extract<ReaderAction, { type: "FetchFailed" }>): ReaderState =>
    s.kind === "loading"
      ? { kind: "network-error", ref: a.ref, reason: a.reason }
      : s,

  ChapterAdvanced: (s: ReaderState, _a: Extract<ReaderAction, { type: "ChapterAdvanced" }>): ReaderState =>
    s.kind === "loaded"
      ? { kind: "loading", ref: { ...s.ref, chapter: s.ref.chapter + 1, verses: { start: 1, end: 1 } }, intent: "view" }
      : s,

  ChapterRetreated: (s: ReaderState, _a: Extract<ReaderAction, { type: "ChapterRetreated" }>): ReaderState => {
    if (s.kind !== "loaded") return s;
    if (s.ref.chapter <= 1) return s;
    return { kind: "loading", ref: { ...s.ref, chapter: s.ref.chapter - 1, verses: { start: 1, end: 1 } }, intent: "view" };
  },

  PaletteReopened: (s: ReaderState, _a: Extract<ReaderAction, { type: "PaletteReopened" }>): ReaderState =>
    s.kind === "loaded" || s.kind === "network-error"
      ? { kind: "awaiting", query: "", parseError: null, suggestions: [], selectedIndex: -1, phase: "book", chapters: [], bookChosen: null }
      : s,

  CursorMovedDown: (s: ReaderState, _a: Extract<ReaderAction, { type: "CursorMovedDown" }>): ReaderState => {
    if (s.kind !== "loaded") return s;
    const verses = s.passage.verses;
    const pageEnd = Math.min(s.pageStartIndex + VERSES_PER_PAGE - 1, verses.length - 1);
    if (s.cursorIndex < pageEnd) {
      return { ...s, cursorIndex: s.cursorIndex + 1 };
    }
    const nextPageStart = s.pageStartIndex + VERSES_PER_PAGE;
    if (nextPageStart >= verses.length) return s;
    return { ...s, pageStartIndex: nextPageStart, cursorIndex: nextPageStart };
  },

  CursorMovedUp: (s: ReaderState, _a: Extract<ReaderAction, { type: "CursorMovedUp" }>): ReaderState => {
    if (s.kind !== "loaded") return s;
    if (s.cursorIndex === 0 && s.pageStartIndex === 0) return s;
    if (s.cursorIndex > s.pageStartIndex) {
      return { ...s, cursorIndex: s.cursorIndex - 1 };
    }
    const newPageStart = s.pageStartIndex - VERSES_PER_PAGE;
    const lastVerseOfPage = Math.min(newPageStart + VERSES_PER_PAGE - 1, s.passage.verses.length - 1);
    return { ...s, pageStartIndex: newPageStart, cursorIndex: lastVerseOfPage };
  },

  PageAdvanced: (s: ReaderState, _a: Extract<ReaderAction, { type: "PageAdvanced" }>): ReaderState => {
    if (s.kind !== "loaded") return s;
    const nextPageStart = s.pageStartIndex + VERSES_PER_PAGE;
    if (nextPageStart >= s.passage.verses.length) return s;
    return { ...s, pageStartIndex: nextPageStart, cursorIndex: nextPageStart };
  },

  PageRetreated: (s: ReaderState, _a: Extract<ReaderAction, { type: "PageRetreated" }>): ReaderState => {
    if (s.kind !== "loaded") return s;
    if (s.pageStartIndex === 0) return s;
    const newPageStart = s.pageStartIndex - VERSES_PER_PAGE;
    return { ...s, pageStartIndex: newPageStart, cursorIndex: newPageStart };
  },

  SuggestionMovedDown: (s: ReaderState, _a: Extract<ReaderAction, { type: "SuggestionMovedDown" }>): ReaderState => {
    if (s.kind !== "awaiting" || s.suggestions.length === 0) return s;
    const next = Math.min(s.selectedIndex + 1, s.suggestions.length - 1);
    return { ...s, selectedIndex: next };
  },

  SuggestionMovedUp: (s: ReaderState, _a: Extract<ReaderAction, { type: "SuggestionMovedUp" }>): ReaderState => {
    if (s.kind !== "awaiting" || s.suggestions.length === 0) return s;
    const next = Math.max(s.selectedIndex - 1, 0);
    return { ...s, selectedIndex: next };
  },

  SuggestionAccepted: (s: ReaderState, _a: Extract<ReaderAction, { type: "SuggestionAccepted" }>): ReaderState => {
    if (s.kind !== "awaiting" || s.selectedIndex < 0) return s;
    if (s.phase === "book") {
      const chosen = s.suggestions[s.selectedIndex];
      const n = chaptersForBook(chosen.canonical);
      const chapters = Array.from({ length: n }, (_, i) => i + 1);
      return { ...s, phase: "chapter", bookChosen: chosen, chapters, selectedIndex: 0, suggestions: [], query: `${chosen.displayName} ` };
    }
    if (s.phase === "chapter") {
      if (s.bookChosen === null) return s;
      const chapter = s.chapters[s.selectedIndex];
      return {
        kind: "loading",
        ref: { book: bookIdFromCanonical(s.bookChosen.canonical), chapter, verses: { start: 1, end: 1 } },
        intent: "pick-verse",
      };
    }
    return s;
  },

  BookChosen: (s: ReaderState, _a: Extract<ReaderAction, { type: "BookChosen" }>): ReaderState => {
    if (s.kind !== "awaiting" || s.phase !== "book" || s.selectedIndex < 0) return s;
    const chosen = s.suggestions[s.selectedIndex];
    const n = chaptersForBook(chosen.canonical);
    const chapters = Array.from({ length: n }, (_, i) => i + 1);
    return { ...s, phase: "chapter", bookChosen: chosen, chapters, selectedIndex: 0, suggestions: [], query: `${chosen.displayName} ` };
  },

  ChapterChosen: (s: ReaderState, _a: Extract<ReaderAction, { type: "ChapterChosen" }>): ReaderState => {
    if (s.kind !== "awaiting" || s.phase !== "chapter" || s.bookChosen === null || s.selectedIndex < 0) return s;
    const chapter = s.chapters[s.selectedIndex];
    return {
      kind: "loading",
      ref: { book: bookIdFromCanonical(s.bookChosen.canonical), chapter, verses: { start: 1, end: 1 } },
      intent: "pick-verse",
    };
  },

  VersePickerMovedDown: (s: ReaderState, _a: Extract<ReaderAction, { type: "VersePickerMovedDown" }>): ReaderState => {
    if (s.kind !== "loaded" || s.versePicker === null) return s;
    const max = s.passage.verses.length - 1;
    return { ...s, versePicker: { selectedIndex: Math.min(s.versePicker.selectedIndex + 10, max) } };
  },

  VersePickerMovedUp: (s: ReaderState, _a: Extract<ReaderAction, { type: "VersePickerMovedUp" }>): ReaderState => {
    if (s.kind !== "loaded" || s.versePicker === null) return s;
    return { ...s, versePicker: { selectedIndex: Math.max(s.versePicker.selectedIndex - 10, 0) } };
  },

  VersePickerMovedRight: (s: ReaderState, _a: Extract<ReaderAction, { type: "VersePickerMovedRight" }>): ReaderState => {
    if (s.kind !== "loaded" || s.versePicker === null) return s;
    const max = s.passage.verses.length - 1;
    return { ...s, versePicker: { selectedIndex: Math.min(s.versePicker.selectedIndex + 1, max) } };
  },

  VersePickerMovedLeft: (s: ReaderState, _a: Extract<ReaderAction, { type: "VersePickerMovedLeft" }>): ReaderState => {
    if (s.kind !== "loaded" || s.versePicker === null) return s;
    return { ...s, versePicker: { selectedIndex: Math.max(s.versePicker.selectedIndex - 1, 0) } };
  },

  VersePickerAccepted: (s: ReaderState, _a: Extract<ReaderAction, { type: "VersePickerAccepted" }>): ReaderState => {
    if (s.kind !== "loaded" || s.versePicker === null) return s;
    const cursorIndex = s.versePicker.selectedIndex;
    const pageStartIndex = Math.floor(cursorIndex / VERSES_PER_PAGE) * VERSES_PER_PAGE;
    return { ...s, cursorIndex, pageStartIndex, versePicker: null };
  },

  VersePickerCancelled: (s: ReaderState, _a: Extract<ReaderAction, { type: "VersePickerCancelled" }>): ReaderState => {
    if (s.kind !== "loaded" || s.versePicker === null) return s;
    return { ...s, versePicker: null };
  },

  PickerBackedOut: (s: ReaderState, _a: Extract<ReaderAction, { type: "PickerBackedOut" }>): ReaderState => {
    if (s.kind !== "awaiting" || s.phase !== "chapter") return s;
    return { ...s, phase: "book", bookChosen: null, chapters: [], selectedIndex: -1, suggestions: suggestBooks(s.query) };
  },
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
  suggestions: [],
  selectedIndex: -1,
  phase: "book",
  chapters: [],
  bookChosen: null,
};
