import { parseReference } from "@/domain/reference";
import type { Reference } from "@/domain/reference";
import type { ParseError, RepoError } from "@/domain/errors";
import type { Passage } from "@/domain/passage";

export const VERSES_PER_PAGE = 8;

export type ReaderState =
  | { kind: "awaiting"; query: string; parseError: ParseError | null }
  | { kind: "loading"; ref: Reference }
  | { kind: "loaded"; passage: Passage; ref: Reference; cursorIndex: number; pageStartIndex: number }
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
  | { type: "PageRetreated" };

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
      ? { kind: "loaded", passage: a.passage, ref: s.ref, cursorIndex: 0, pageStartIndex: 0 }
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
