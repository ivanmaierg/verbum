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
