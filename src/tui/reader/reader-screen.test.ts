import { describe, it, expect } from "bun:test";
import { bottomTitleFor } from "@/tui/reader/reader-screen";
import type { ReaderState } from "@/tui/reader/reader-reducer";
import type { Reference } from "@/domain/reference";
import type { BookSuggestion } from "@/domain/book-suggestions";

const johnRef: Reference = {
  book: "JHN" as import("@/domain/book-id").BookId,
  chapter: 3,
  verses: { start: 1, end: Number.MAX_SAFE_INTEGER },
};

const emptySuggestions: BookSuggestion[] = [];

describe("bottomTitleFor", () => {
  it("awaiting returns hint text with Tab complete, arrows, Enter, and quit", () => {
    const state: ReaderState = {
      kind: "awaiting",
      query: "",
      parseError: null,
      suggestions: emptySuggestions,
      selectedIndex: -1,
    };
    expect(bottomTitleFor(state)).toBe(
      " Tab complete  •  ↑↓ suggest  •  Enter open  •  q quit ",
    );
  });

  it("loading returns loading hint text", () => {
    const state: ReaderState = { kind: "loading", ref: johnRef };
    expect(bottomTitleFor(state)).toBe(" loading…  •  q quit ");
  });

  it("loaded returns navigation hint text", () => {
    const mockPassage = {
      reference: johnRef,
      verses: [{ number: 1, text: "In the beginning" }],
    };
    const state: ReaderState = {
      kind: "loaded",
      passage: mockPassage,
      ref: johnRef,
      cursorIndex: 0,
      pageStartIndex: 0,
    };
    expect(bottomTitleFor(state)).toBe(
      " ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit ",
    );
  });
});
