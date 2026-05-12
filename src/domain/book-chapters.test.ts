import { describe, it, expect } from "bun:test";
import { chaptersForBook, BOOK_CHAPTERS } from "@/domain/book-chapters";

describe("BOOK_CHAPTERS", () => {
  it("contains exactly 66 entries", () => {
    expect(Object.keys(BOOK_CHAPTERS).length).toBe(66);
  });
});

describe("chaptersForBook", () => {
  it("returns 21 for JHN", () => {
    expect(chaptersForBook("JHN")).toBe(21);
  });

  it("returns 50 for GEN", () => {
    expect(chaptersForBook("GEN")).toBe(50);
  });

  it("returns 150 for PSA", () => {
    expect(chaptersForBook("PSA")).toBe(150);
  });

  it("returns 22 for REV", () => {
    expect(chaptersForBook("REV")).toBe(22);
  });

  it("returns 0 for unknown key XYZ", () => {
    expect(chaptersForBook("XYZ")).toBe(0);
  });
});
