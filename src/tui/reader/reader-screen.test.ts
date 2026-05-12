import { describe, it, expect } from "bun:test";
import { bottomTitleFor } from "@/tui/reader/reader-screen";
import type { ReaderState } from "@/tui/reader/reader-reducer";
import type { Reference } from "@/domain/reference";
import type { BookSuggestion } from "@/domain/book-suggestions";
import type { Passage } from "@/domain/passage";

const johnRef: Reference = {
  book: "JHN" as import("@/domain/book-id").BookId,
  chapter: 3,
  verses: { start: 1, end: Number.MAX_SAFE_INTEGER },
};

const emptySuggestions: BookSuggestion[] = [];

const mockPassage: Passage = {
  reference: johnRef,
  verses: [{ number: 1, text: "In the beginning" }],
};

describe("bottomTitleFor", () => {
  it("awaiting/book returns hint text with Tab complete, arrows, Enter, and quit", () => {
    const state: ReaderState = {
      kind: "awaiting",
      query: "",
      parseError: null,
      suggestions: emptySuggestions,
      selectedIndex: -1,
      phase: "book",
      chapters: [],
      bookChosen: null,
    };
    expect(bottomTitleFor(state)).toBe(
      " Tab complete  •  ↑↓ suggest  •  Enter open  •  q quit ",
    );
  });

  it("awaiting/chapter returns chapter pick prompt including book name", () => {
    const state: ReaderState = {
      kind: "awaiting",
      query: "John ",
      parseError: null,
      suggestions: emptySuggestions,
      selectedIndex: 0,
      phase: "chapter",
      chapters: [1, 2, 3],
      bookChosen: { alias: "john", canonical: "JHN", displayName: "John" },
    };
    const title = bottomTitleFor(state);
    expect(title).toContain("John");
    expect(title).toContain("chapter");
  });

  it("loading/view returns loading hint text", () => {
    const state: ReaderState = { kind: "loading", ref: johnRef, intent: "view" };
    expect(bottomTitleFor(state)).toBe(" loading…  •  q quit ");
  });

  it("loading/pick-verse returns loading hint text", () => {
    const state: ReaderState = { kind: "loading", ref: johnRef, intent: "pick-verse" };
    expect(typeof bottomTitleFor(state)).toBe("string");
  });

  it("loaded/versePicker null returns navigation hint text", () => {
    const state: ReaderState = {
      kind: "loaded",
      passage: mockPassage,
      ref: johnRef,
      cursorIndex: 0,
      pageStartIndex: 0,
      versePicker: null,
    };
    expect(bottomTitleFor(state)).toBe(
      " ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit ",
    );
  });

  it("loaded/versePicker active returns verse pick prompt", () => {
    const state: ReaderState = {
      kind: "loaded",
      passage: mockPassage,
      ref: johnRef,
      cursorIndex: 0,
      pageStartIndex: 0,
      versePicker: { selectedIndex: 0 },
    };
    const title = bottomTitleFor(state);
    expect(title).toContain("verse");
  });

  it("network-error returns error hint text", () => {
    const state: ReaderState = {
      kind: "network-error",
      ref: johnRef,
      reason: { kind: "network", message: "unreachable" },
    };
    expect(typeof bottomTitleFor(state)).toBe("string");
  });
});
